import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../config/supabase';
import {
  getCachedStopImages,
  setCachedStopImagesBatch,
  hasSeenMapBefore,
  markMapSeenBefore,
} from '../config/cookies';
import '../styles/MapComponent.css';

const MapComponent = React.memo(({
  center,
  routeCoordinates,
  stops,
  nearbyStops = [],
  onNearbyStopSelect,
  onMapMoved,
  mapMode = 'normal',
  isComposite = false,
  onLayerChange,
  userLocation,
  primaryColor = '#6b21a8',
  currentUserId = null,
  volunteerMode = false,
  onMapTap,
  recenterUserTrigger = 0,
  recenterRouteTrigger = 0,
}) => {
  const iframeRef = useRef(null);
  const mapReadyRef = useRef(false);

  // Tracks whether the map inside the iframe has finished loading,
  // and whether it's taking unusually long (> 3s) so we can reassure the user
  const [isMapReady, setIsMapReady] = useState(false);
  const [isMapSlow, setIsMapSlow] = useState(false);
  // Only the very first time this device ever loads the map do we show the
  // "Loading map..." overlay; on every visit after that (within the 30-day
  // cache window) the map is considered a known-fast load and we skip it,
  // even though the iframe is still technically loading behind the scenes.
  const hasSeenMapRef = useRef(hasSeenMapBefore());

  // ── Stop photos ───────────────────────────────────────────────────────────
  // Keyed by stop id → array of { id, url, approved, mine }. Only approved
  // images (or the current user's own pending uploads) ever land in here —
  // unapproved photos from other users are never fetched into this map.
  const [stopImagesByStop, setStopImagesByStop] = useState({});

  // Pushes the current photo data into the iframe without reloading the map
  // (a full HTML regeneration would reset zoom/pan/bearing on every upload).
  const syncStopImages = useCallback((images) => {
    if (!mapReadyRef.current || !iframeRef.current?.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage({ type: 'STOP_IMAGES_SYNC', images }, '*');
    } catch (e) {}
  }, []);

  // Pushes a fresh location fix (or null) into the iframe without reloading
  // the map — a full HTML regeneration on every location update would reset
  // zoom/pan/bearing and cause a jarring "flash" every time the device's
  // GPS fix refreshes.
  const syncUserLocation = useCallback((location) => {
    if (!mapReadyRef.current || !iframeRef.current?.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage({ type: 'USER_LOCATION_UPDATE', location: location || null }, '*');
    } catch (e) {}
  }, []);

  // Sends the map a message to fly/pan to the user-location marker. If this
  // fires before the map has finished loading (e.g. a cached location
  // resolves faster than the map tiles/JS do), it's queued in
  // pendingRecenterRef and flushed once MAP_READY comes in instead of being
  // dropped silently.
  const pendingRecenterRef = useRef(false);
  const flyToUser = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage({ type: 'FLY_TO_USER' }, '*');
    } catch (e) {}
  }, []);

  // Same idea as flyToUser above, but fits the map to the whole route
  // (using the bounds already computed when the route was drawn) instead
  // of centering on a single point.
  const pendingRecenterRouteRef = useRef(false);
  const flyToRoute = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage({ type: 'FLY_TO_ROUTE' }, '*');
    } catch (e) {}
  }, []);

  // Load approved (+ own pending) photos for the stops currently on screen
  useEffect(() => {
    let cancelled = false;

    const loadImages = async () => {
      const stopIds = (stops || []).map((s) => s.id).filter(Boolean);
      if (stopIds.length === 0) {
        setStopImagesByStop({});
        return;
      }

      // Cache-first: pull whatever we already have on-device (30-day TTL),
      // and only ask Supabase for the stops that are missing or stale.
      // NOTE: a stop's cached photo list won't pick up someone else's
      // newly-approved photo for up to 30 days on this device.
      const grouped = {};
      const staleStopIds = [];
      stopIds.forEach((id) => {
        const cached = getCachedStopImages(id);
        if (cached) {
          grouped[id] = cached;
        } else {
          staleStopIds.push(id);
        }
      });

      if (staleStopIds.length === 0) {
        setStopImagesByStop(grouped);
        syncStopImages(grouped);
        return;
      }

      const { data, error } = await supabase
        .from('stop_images')
        .select('id, stop_id, url, approved, uploaded_by, created_at')
        .in('stop_id', staleStopIds)
        .order('created_at', { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error('Error loading stop images:', error);
        setStopImagesByStop(grouped);
        syncStopImages(grouped);
        return;
      }

      // Stops that came back with zero rows still need a `[]` cache entry
      // so we don't keep re-querying them every render.
      staleStopIds.forEach((id) => { grouped[id] = []; });

      (data || []).forEach((img) => {
        // Belt-and-suspenders: only ever surface approved photos, or photos
        // the current user uploaded themselves (shown to them as "pending").
        if (!img.approved && img.uploaded_by !== currentUserId) return;
        if (!grouped[img.stop_id]) grouped[img.stop_id] = [];
        grouped[img.stop_id].push({
          id: img.id,
          url: img.url,
          approved: img.approved,
          mine: img.uploaded_by === currentUserId,
        });
      });

      const freshEntries = {};
      staleStopIds.forEach((id) => { freshEntries[id] = grouped[id]; });
      setCachedStopImagesBatch(freshEntries);

      setStopImagesByStop(grouped);
      syncStopImages(grouped);
    };

    loadImages();
    return () => { cancelled = true; };
  }, [stops, currentUserId, syncStopImages]);

  // Whenever React's userLocation changes (a fresh GPS fix, permission
  // newly granted, etc.), push it into the already-running map instead of
  // rebuilding the iframe from scratch.
  useEffect(() => {
    syncUserLocation(userLocation);
  }, [userLocation, syncUserLocation]);

  // Uploads a new stop photo (pending approval) and updates local + iframe state.
  // No sign-in required — anyone can contribute a photo of a stop; it just
  // won't be visible to others until an admin approves it.
  const handleStopImageUpload = useCallback(async (stopId, dataUrl, fileName, mimeType) => {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const ext = (fileName?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const leaf = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const path = `${stopId}/${leaf}.${ext}`;

      const { error: uploadError } = await supabase
        .storage
        .from('stop-images')
        .upload(path, blob, { contentType: mimeType || blob.type || 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from('stop-images').getPublicUrl(path);
      const publicUrl = publicData?.publicUrl;

      // Note: we don't .select() the row back — an anonymous (or even a
      // signed-in) uploader isn't allowed to re-select their own pending row
      // under RLS, since that policy is only guaranteed for signed-in owners.
      // We already know everything we need to update the UI locally.
      const { error: insertError } = await supabase
        .from('stop_images')
        .insert({
          stop_id: stopId,
          url: publicUrl,
          uploaded_by: currentUserId || null,
          approved: false,
        });
      if (insertError) throw insertError;

      setStopImagesByStop((prev) => {
        const next = { ...prev };
        const list = next[stopId] ? [...next[stopId]] : [];
        // Locally-known id so React can key the list; the real row's id
        // isn't needed client-side since we never look this entry up by id.
        list.unshift({ id: `local-${leaf}`, url: publicUrl, approved: false, mine: true });
        next[stopId] = list;
        syncStopImages(next);
        // Keep the on-device cache in step so a reload doesn't briefly show
        // the pre-upload photo list for this stop.
        setCachedStopImagesBatch({ [stopId]: list });
        return next;
      });

      iframeRef.current?.contentWindow?.postMessage(
        { type: 'STOP_IMAGE_UPLOAD_RESULT', stopId, success: true },
        '*'
      );
    } catch (err) {
      console.error('Error uploading stop image:', err);
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'STOP_IMAGE_UPLOAD_RESULT', stopId, success: false, error: 'Upload failed. Please try again.' },
        '*'
      );
    }
  }, [currentUserId, syncStopImages]);

  // ── Nearby-stop spawning ────────────────────────────────────────────────
  // As the user pans the map and HomeScreen fetches more stops for the new
  // area, only the *newly-seen* stops get pushed into the live iframe (it
  // draws them where they are, without touching zoom/pan or removing dots
  // already on screen, and without any full-map reload). The iframe always
  // starts with zero nearby-stop dots; the current full set is sent once the
  // map reports ready, and knownNearbyKeysRef tracks everything already
  // sent so nothing is ever resent/duplicated.
  const nearbyStopsRef = useRef(nearbyStops);
  const knownNearbyKeysRef = useRef(new Set());

  const nearbyStopKey = (s) => (s.id != null ? String(s.id) : `${s.lat},${s.lng}`);

  const sendNearbyStops = useCallback((stopsToSend) => {
    if (!stopsToSend.length || !iframeRef.current?.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage(
        { type: 'NEARBY_STOPS_ADD', stops: stopsToSend },
        '*'
      );
    } catch (e) {}
  }, []);

  useEffect(() => {
    nearbyStopsRef.current = nearbyStops;
    const fresh = (nearbyStops || []).filter((s) => !knownNearbyKeysRef.current.has(nearbyStopKey(s)));
    if (fresh.length === 0) return;
    fresh.forEach((s) => knownNearbyKeysRef.current.add(nearbyStopKey(s)));
    if (mapReadyRef.current) sendNearbyStops(fresh);
    // if the map isn't ready yet, these are covered by the MAP_READY
    // full-send below (it reads nearbyStopsRef.current, which is already updated)
  }, [nearbyStops, sendNearbyStops]);

  // A fresh blobUrl means a brand-new iframe with zero dots on it, so the
  // "already sent" set resets — the MAP_READY handler will resend the full
  // current list once that new iframe finishes loading. NOTE: userLocation
  // is intentionally excluded — it's synced live via postMessage (see
  // syncUserLocation below) rather than triggering a full iframe rebuild.
  useEffect(() => {
    knownNearbyKeysRef.current = new Set();
  }, [center, routeCoordinates, stops, primaryColor, volunteerMode]);

  // Listen for layer-change / map-ready / stop-photo messages from the iframe
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'MAP_LAYER_CHANGE' && onLayerChange) {
        onLayerChange(e.data.layer);
      }
      if (e.data?.type === 'MAP_READY') {
        setIsMapReady(true);
        mapReadyRef.current = true;
        if (!hasSeenMapRef.current) {
          hasSeenMapRef.current = true;
          markMapSeenBefore();
        }
        syncStopImages(stopImagesByStop);
        syncUserLocation(userLocation);
        if (pendingRecenterRef.current) {
          pendingRecenterRef.current = false;
          flyToUser();
        }
        if (pendingRecenterRouteRef.current) {
          pendingRecenterRouteRef.current = false;
          flyToRoute();
        }
        // Fresh iframe always starts with zero nearby-stop dots — send the
        // full current list now that it's ready to receive them.
        const currentNearby = nearbyStopsRef.current || [];
        currentNearby.forEach((s) => knownNearbyKeysRef.current.add(nearbyStopKey(s)));
        sendNearbyStops(currentNearby);
      }
      if (e.data?.type === 'STOP_IMAGE_UPLOAD') {
        handleStopImageUpload(e.data.stopId, e.data.dataUrl, e.data.fileName, e.data.mimeType);
      }
      if (e.data?.type === 'MAP_TAP' && onMapTap) {
        onMapTap(e.data.lat, e.data.lng);
      }
      if (e.data?.type === 'NEARBY_STOP_DBLTAP' && onNearbyStopSelect) {
        onNearbyStopSelect(e.data.name, e.data.lat, e.data.lng);
      }
      if (e.data?.type === 'MAP_MOVED' && onMapMoved) {
        onMapMoved(e.data.lat, e.data.lng, e.data.bounds);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onLayerChange, stopImagesByStop, syncStopImages, userLocation, syncUserLocation, flyToUser, flyToRoute, handleStopImageUpload, onMapTap, onNearbyStopSelect, onMapMoved, sendNearbyStops]);

  // Skip the very first render (trigger starts at 0) — only fire when the
  // parent actually bumps the counter in response to a tap (or the
  // one-time auto-center-on-open effect).
  const isFirstRecenterRef = useRef(true);
  useEffect(() => {
    if (isFirstRecenterRef.current) {
      isFirstRecenterRef.current = false;
      return;
    }
    if (mapReadyRef.current) {
      flyToUser();
    } else {
      pendingRecenterRef.current = true;
    }
  }, [recenterUserTrigger, flyToUser]);

  // Same skip-first-render guard as above, for the "recenter on route" button.
  const isFirstRecenterRouteRef = useRef(true);
  useEffect(() => {
    if (isFirstRecenterRouteRef.current) {
      isFirstRecenterRouteRef.current = false;
      return;
    }
    if (mapReadyRef.current) {
      flyToRoute();
    } else {
      pendingRecenterRouteRef.current = true;
    }
  }, [recenterRouteTrigger, flyToRoute]);

  const generateHTML = useCallback(() => {
    const lat = center[0];
    const lng = center[1];

    // Tile-thumbnail helpers (used for the layer-toggle button thumbnail)
    const Z = 10;
    const tX = Math.floor(((lng + 180) / 360) * Math.pow(2, Z));
    const rawY = (1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2;
    const tY = Math.floor(rawY * Math.pow(2, Z));

    const SAT_THUMB = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${Z}/${tY}/${tX}`;
    const OSM_THUMB = `https://tile.openstreetmap.org/${Z}/${tX}/${tY}.png`;

    const stopsJSON = JSON.stringify(stops);
    const routeJSON = JSON.stringify(routeCoordinates);
    const userLocationJSON = JSON.stringify(userLocation || null);
    // Always starts empty — nearby stops are streamed in live via
    // postMessage (NEARBY_STOPS_ADD) once the map reports MAP_READY, so a
    // pan-triggered fetch never has to reload/regenerate the whole map.
    const nearbyStopsJSON = '[]';
    // Pass the current map layer so the iframe preserves it when route data changes
    const initialLayer = mapMode === 'satellite' ? 'satellite' : 'normal';
    const volunteerModeFlag = volunteerMode ? 'true' : 'false';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"><\/script>
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
    #map{height:100vh;width:100vw}
    .map-controls{
      position:absolute;bottom:30px;left:12px;
      display:flex;flex-direction:column;gap:8px;z-index:100
    }
    @media (max-width: 768px) {
      .map-controls{
        bottom: 80px;
      }
    }
    .ctrl-btn{
      width:44px;height:44px;border-radius:50%;
      border:2.5px solid #fff;
      box-shadow:0 2px 10px rgba(0,0,0,0.45);
      cursor:pointer;overflow:hidden;background:#fff;
      display:flex;align-items:center;justify-content:center;
      -webkit-tap-highlight-color:transparent;user-select:none
    }
    .ctrl-btn img{width:100%;height:100%;object-fit:cover;display:block}
    #compassSvg{transition:transform 0.15s ease-out;display:block}
    .maplibregl-ctrl-bottom-right,.maplibregl-ctrl-bottom-left,
    .maplibregl-ctrl-top-right,.maplibregl-ctrl-top-left{display:none}
    .stop-popup .maplibregl-popup-content{
      padding:14px 16px;border-radius:16px;background:#fff;
      box-shadow:0 8px 32px rgba(0,0,0,0.16),0 2px 8px rgba(0,0,0,0.08);
      border:1px solid #F1F5F9;min-width:180px;max-width:240px
    }
    .stop-popup.maplibregl-popup-anchor-bottom .maplibregl-popup-tip{border-top-color:#fff}
    .stop-popup.maplibregl-popup-anchor-top    .maplibregl-popup-tip{border-bottom-color:#fff}
    .stop-popup.maplibregl-popup-anchor-left   .maplibregl-popup-tip{border-right-color:#fff}
    .stop-popup.maplibregl-popup-anchor-right  .maplibregl-popup-tip{border-left-color:#fff}

    /* ── Nearby-stop popup — solid black, 70% opacity ── */
    .nearby-stop-popup .maplibregl-popup-content{
      background:rgba(0,0,0,0.7);color:#fff;border-radius:10px;
      padding:9px 13px;box-shadow:0 4px 16px rgba(0,0,0,0.3);
      min-width:0;max-width:220px;
    }
    .nearby-stop-popup-name{
      font-family:-apple-system,BlinkMacSystemFont,sans-serif;
      font-size:13px;font-weight:700;color:#fff;margin-bottom:2px;
    }
    .nearby-stop-popup-hint{
      font-family:-apple-system,BlinkMacSystemFont,sans-serif;
      font-size:11px;font-weight:500;color:rgba(255,255,255,0.85);
    }
    .nearby-stop-popup.maplibregl-popup-anchor-bottom .maplibregl-popup-tip{border-top-color:rgba(0,0,0,0.7) !important;}
    .nearby-stop-popup.maplibregl-popup-anchor-top    .maplibregl-popup-tip{border-bottom-color:rgba(0,0,0,0.7) !important;}
    .nearby-stop-popup.maplibregl-popup-anchor-left   .maplibregl-popup-tip{border-right-color:rgba(0,0,0,0.7) !important;}
    .nearby-stop-popup.maplibregl-popup-anchor-right  .maplibregl-popup-tip{border-left-color:rgba(0,0,0,0.7) !important;}

    /* ── Toast — brief confirmation banner (e.g. photo upload success) ── */
    .map-toast{
      position:absolute;left:50%;top:28px;
      transform:translateX(-50%) translateY(12px);
      background:rgba(17,24,39,0.92);color:#fff;
      font-family:-apple-system,BlinkMacSystemFont,sans-serif;
      font-size:13px;font-weight:600;
      padding:11px 18px;border-radius:24px;
      box-shadow:0 6px 20px rgba(0,0,0,0.28);
      display:flex;align-items:center;gap:8px;
      opacity:0;transition:opacity 0.25s ease,transform 0.25s ease;
      z-index:5000;pointer-events:none;white-space:nowrap;
    }
    .map-toast.map-toast-visible{
      opacity:1;transform:translateX(-50%) translateY(0);
    }
    .map-toast-check{
      width:16px;height:16px;border-radius:50%;
      background:#10B981;flex-shrink:0;
      display:flex;align-items:center;justify-content:center;
    }

    /* ── Stop photo badge — small square "pin" pointing at each stop ── */
    .stop-photo-badge{
      width:34px;height:34px;border-radius:9px;
      background-color:#fff;background-position:center;background-size:cover;background-repeat:no-repeat;
      border:1.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);
      cursor:pointer;display:flex;align-items:center;justify-content:center;
      -webkit-tap-highlight-color:transparent;
    }
    .stop-photo-badge::after{
      content:'';position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);
      width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;
      border-top:7px solid #fff;
    }
    .stop-photo-badge.empty{ background-color:${primaryColor}; }
    .stop-photo-plus{ color:#fff;font-size:19px;font-weight:700;line-height:1;pointer-events:none; margin-top: -5px;}
    .stop-photo-count{
      position:absolute;bottom:-4px;right:-4px;background:#1E293B;color:#fff;
      font-size:9px;font-weight:700;border-radius:8px;padding:1px 4px;line-height:1.35;
    }
    .stop-photo-pending-dot{
      position:absolute;top:-4px;right:-4px;width:10px;height:10px;border-radius:50%;
      background:#F59E0B;border:2px solid #fff;
    }
    .stop-photo-badge.uploading{ opacity:0.55;pointer-events:none; }
    .stop-photo-badge.uploading::before{
      content:'';position:absolute;width:16px;height:16px;border-radius:50%;
      border:2.5px solid rgba(255,255,255,0.55);border-top-color:#fff;
      animation:photo-spin 0.8s linear infinite;
    }
    @keyframes photo-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}

    /* ── Full-screen photo lightbox ── */
    .photo-lightbox-overlay{
      position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.92);
      z-index:1000;display:flex;align-items:center;justify-content:center;
    }
    .photo-lightbox-img{ margin-top: -200px;
    max-width:88vw;
    max-height:50vh;
    border-radius:8px;
    object-fit:contain; 
    }
    .photo-lightbox-caption{
      position:absolute;bottom:270px;left:0;right:0;text-align:center;color:#fff;
      font-size:13px;font-weight:600;padding:0 16px;
    }
    .photo-lightbox-nav{
      position:absolute;top:50%;transform:translateY(-50%);color:#fff;font-size:38px;
      cursor:pointer;padding:0 18px;user-select:none;-webkit-tap-highlight-color:transparent;
    }
    .photo-lightbox-prev{ left:2px; }
    .photo-lightbox-next{ right:2px; }
    .photo-lightbox-add{
      position:absolute;bottom:220px;left:50%;transform:translateX(-50%);
      background:${primaryColor};color:#fff;border-radius:20px;padding:8px 18px;
      font-size:13px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;
    }
  </style>
</head>
<body>
<div id="map"></div>
<input type="file" id="stopPhotoInput" accept="image/*" style="display:none" />
<div id="mapToast" class="map-toast"></div>


<div class="map-controls">
  <!-- Compass / north reset -->
  <div class="ctrl-btn" id="northBtn" onclick="resetBearing()" title="Reset North">
    <svg id="compassSvg" viewBox="0 0 40 40" width="50" height="50" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(0,0,0,0.08)" stroke-width="0"/>
      <path d="M20 4 L23.5 20 L20 18 L16.5 20 Z" fill="#e84040"/>
      <path d="M20 36 L23.5 20 L20 22 L16.5 20 Z" fill="#9ca3af"/>
      <circle cx="20" cy="20" r="3" fill="#1e293b"/>
      <circle cx="20" cy="20" r="1.5" fill="white"/>
    </svg>
  </div>
  <!-- Layer toggle -->
  <div class="ctrl-btn" id="layerBtn" onclick="toggleLayer()" title="Toggle map layer">
    <img id="layerThumb" src="" alt="layer"/>
  </div>
</div>

<script>
// ── Styles ───────────────────────────────────────────────────────────────────
var NORMAL_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
var SATELLITE_STYLE = {
  version:8,
  sources:{
    satellite:{
      type:'raster',
      tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize:256, maxzoom:19,
      attribution:'© Esri, Maxar, Earthstar Geographics'
    }
  },
  layers:[{id:'sat', type:'raster', source:'satellite', paint:{'raster-opacity':1}}]
};

var SAT_THUMB = '${SAT_THUMB}';
var OSM_THUMB = '${OSM_THUMB}';
var PRIMARY_COLOR = '${primaryColor}';
var VOLUNTEER_MODE = ${volunteerModeFlag};

// ── State ────────────────────────────────────────────────────────────────────
var currentLayer    = '${initialLayer}';
var mapReady        = false;
var routeBounds     = null;
var stopMarkers     = [];
var nearbyMarkers   = [];
var photoMarkers    = [];
var photoBadgeEls   = {};
var stopsById       = {};
var lastRoadGeoJSON = null;
var lastWalkArcGeoJSON = null;

// ── Data from React ──────────────────────────────────────────────────────────
var allStops    = ${stopsJSON};
var routeCoords = ${routeJSON};
var userLoc     = ${userLocationJSON};
var nearbyStopsData = ${nearbyStopsJSON};
var userLocMarker = null;
// Populated (without a full map reload) via STOP_IMAGES_SYNC postMessage from React
var stopImagesMap = {};
var pendingUploadStopId = null;
// Per-stop manual show/hide override, toggled by tapping the stop marker.
// Undefined = default (visible only if the stop has an approved photo).
var badgeOverride = {};

allStops.forEach(function(s) { if (s.id) stopsById[s.id] = s; });

// Walk-segment indices: stop i → i+1 is a walk when fare_to_next === 0
var walkSegsSet = new Set(
  allStops.reduce(function(acc, s, i) {
    if (i < allStops.length - 1 && s.fare_to_next === 0) acc.push(i);
    return acc;
  }, [])
);

// ── Map init — starts on the layer that was active in the parent app ──────────
var initialStyle = currentLayer === 'satellite' ? SATELLITE_STYLE : NORMAL_STYLE;
var map = new maplibregl.Map({
  container:'map',
  style: initialStyle,
  center:[${lng}, ${lat}],
  zoom:13, pitch:45, bearing:0,
  antialias:true, attributionControl:false
});

// Thumbnail shows the OTHER layer (what you'll switch TO)
document.getElementById('layerThumb').src = currentLayer === 'satellite' ? OSM_THUMB : SAT_THUMB;

map.on('load', function() {
  mapReady = true;

  // 3-D buildings only on normal (OpenFreeMap) style
  if (currentLayer === 'normal') {
    try {
      if (map.getSource('openmaptiles')) {
        map.addLayer({
          id:'3d-buildings', source:'openmaptiles', 'source-layer':'building',
          type:'fill-extrusion', minzoom:14,
          paint:{
            'fill-extrusion-color':'#ddd',
            'fill-extrusion-height':['get','render_height'],
            'fill-extrusion-base':['get','render_min_height'],
            'fill-extrusion-opacity':0.5
          }
        });
      }
    } catch(e) {}
  }

  if (allStops.length >= 2) drawRouteWithRoads();
  drawStops();
  redrawAllNearbyMarkers();
  drawStopPhotoBadges();
  drawUserLocation();

  if (VOLUNTEER_MODE) {
    map.getCanvas().style.cursor = 'crosshair';
  }
  // Tapping the map background (not a marker/control) while in volunteer
  // mode reports the tapped coordinates back to React, which opens the
  // "name this stop" form.
  map.on('click', function(e) {
    if (!VOLUNTEER_MODE) return;
    try {
      window.parent.postMessage({ type: 'MAP_TAP', lat: e.lngLat.lat, lng: e.lngLat.lng }, '*');
    } catch (err) {}
  });

  try { window.parent.postMessage({ type: 'MAP_READY' }, '*'); } catch(e) {}
  reportViewport();
});

// ── Report map viewport to the parent app ─────────────────────────────────
// Sent on load and whenever panning/zooming finishes, so React knows both
// where the map is centered (to fetch/cache stops for that area) and the
// current visible bounds (to know whether the user-location dot is on screen).
function reportViewport() {
  if (!mapReady) return;
  var c = map.getCenter();
  var b = map.getBounds();
  try {
    window.parent.postMessage({
      type: 'MAP_MOVED',
      lat: c.lat, lng: c.lng,
      bounds: { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() }
    }, '*');
  } catch (e) {}
}
map.on('moveend', reportViewport);

// ── Compass — rotates opposite to map bearing ─────────────────────────────────
function updateCompass() {
  var needle = document.getElementById('compassSvg');
  if (needle) needle.style.transform = 'rotate(' + (-map.getBearing()) + 'deg)';
}
map.on('rotate', updateCompass);
map.on('rotateend', updateCompass);

// ── North / bearing reset ─────────────────────────────────────────────────────
function resetBearing() {
  map.easeTo({ bearing:0, pitch:45, duration:400 });
}

// ── Layer toggle ──────────────────────────────────────────────────────────────
function toggleLayer() {
  if (currentLayer === 'normal') {
    // Switch TO satellite
    map.setStyle(SATELLITE_STYLE);
    currentLayer = 'satellite';
    document.getElementById('layerThumb').src = OSM_THUMB;
    // Notify parent React app of layer change
    try { window.parent.postMessage({ type: 'MAP_LAYER_CHANGE', layer: 'satellite' }, '*'); } catch(e) {}
    map.once('styledata', function() { mapReady = true; redrawAfterStyleChange(); });
  } else {
    // Switch back TO normal
    map.setStyle(NORMAL_STYLE);
    currentLayer = 'normal';
    document.getElementById('layerThumb').src = SAT_THUMB;
    // Notify parent React app of layer change
    try { window.parent.postMessage({ type: 'MAP_LAYER_CHANGE', layer: 'normal' }, '*'); } catch(e) {}
    map.once('styledata', function() {
      mapReady = true;
      map.setPitch(45);
      try {
        if (map.getSource('openmaptiles')) {
          map.addLayer({
            id:'3d-buildings', source:'openmaptiles', 'source-layer':'building',
            type:'fill-extrusion', minzoom:14,
            paint:{
              'fill-extrusion-color':'#ddd',
              'fill-extrusion-height':['get','render_height'],
              'fill-extrusion-base':['get','render_min_height'],
              'fill-extrusion-opacity':0.5
            }
          });
        }
      } catch(e) {}
      redrawAfterStyleChange();
    });
  }
}

// Re-add route lines and stop markers after a style change
// (sources/layers are lost when the style is swapped)
function redrawAfterStyleChange() {
  if (lastRoadGeoJSON) addRouteLayer(lastRoadGeoJSON, lastWalkArcGeoJSON);
  drawStops();
  redrawAllNearbyMarkers();
  drawStopPhotoBadges();
  drawUserLocation();
}

// ── Road routing via OSRM ─────────────────────────────────────────────────────
function drawRouteWithRoads() {
  if (!mapReady) return;

  var groups = [];
  var cur = [0];
  for (var si = 0; si < allStops.length - 1; si++) {
    if (walkSegsSet.has(si)) {
      if (cur.length >= 1) groups.push({ type:'road', indices:cur.slice() });
      groups.push({ type:'walk', indices:[si, si + 1] });
      cur = [si + 1];
    } else {
      cur.push(si + 1);
    }
  }
  if (cur.length > 0) groups.push({ type:'road', indices:cur.slice() });

  var roadFetches = groups.map(function(g) {
    if (g.type !== 'road' || g.indices.length < 2) return Promise.resolve({ group:g, coords:[] });
    var waypoints = g.indices
      .map(function(idx) { return allStops[idx].lng + ',' + allStops[idx].lat; })
      .join(';');
    var url = 'https://router.project-osrm.org/route/v1/driving/' + waypoints
            + '?overview=full&geometries=geojson&steps=false';
    return fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.routes && d.routes[0]) return { group:g, coords:d.routes[0].geometry.coordinates };
        return { group:g, coords:g.indices.map(function(i) { return [allStops[i].lng, allStops[i].lat]; }) };
      })
      .catch(function() {
        return { group:g, coords:g.indices.map(function(i) { return [allStops[i].lng, allStops[i].lat]; }) };
      });
  });

  Promise.all(roadFetches).then(function(results) {
    var roadLines = [];
    results.forEach(function(r) {
      if (r.group.type === 'road' && r.coords.length > 0) roadLines.push(r.coords);
    });

    var walkArcFeatures = [];
    groups.forEach(function(g) {
      if (g.type !== 'walk') return;
      var from = allStops[g.indices[0]];
      var to   = allStops[g.indices[1]];
      if (from.fare_to_next !== 0) return;
      // The walk arc is a real 3-D extruded dash trail with true elevation,
      // so it reads as going over-and-above from every bearing/pitch angle
      walkArcFeatures = walkArcFeatures.concat(
        buildWalkArcPolygons([from.lat, from.lng], [to.lat, to.lng], 40)
      );
    });

    var roadGeoJSON = roadLines.length > 0
      ? { type:'Feature', geometry:{ type:'MultiLineString', coordinates:roadLines } }
      : null;
    var walkArcGeoJSON = walkArcFeatures.length > 0
      ? { type:'FeatureCollection', features:walkArcFeatures }
      : null;

    lastRoadGeoJSON = roadGeoJSON;
    lastWalkArcGeoJSON = walkArcGeoJSON;
    addRouteLayer(roadGeoJSON, walkArcGeoJSON);

    var allCoords = allStops.map(function(s) { return [s.lng, s.lat]; });
    roadLines.forEach(function(line) { line.forEach(function(c) { allCoords.push(c); }); });
    if (allCoords.length > 0) {
      var bounds = allCoords.reduce(
        function(b, c) { return b.extend(c); },
        new maplibregl.LngLatBounds(allCoords[0], allCoords[0])
      );
      routeBounds = bounds;
      map.fitBounds(bounds, { padding:60, animate:true, duration:800 });
    }
  });
}

function addRouteLayer(roadGeoJSON, walkArcGeoJSON) {
  ['route-line', 'walk-arc-layer'].forEach(function(id) { if (map.getLayer(id))  map.removeLayer(id); });
  ['route-src',  'walk-arc-src' ].forEach(function(id) { if (map.getSource(id)) map.removeSource(id); });

  if (roadGeoJSON) {
    map.addSource('route-src', { type:'geojson', data:roadGeoJSON });
    map.addLayer({
      id:'route-line', type:'line', source:'route-src',
      layout:{ 'line-join':'round', 'line-cap':'round' },
      paint:{ 'line-color':'#6b21a8', 'line-width':6, 'line-opacity':0.9 }
    });
  }

  // The real 3-D arc: a trail of small extruded dashes with true elevation
  // (base/height in metres), so its "over-and-above" shape is a genuine 3-D
  // object rather than a lat/lng offset — it reads correctly from any
  // bearing or pitch, with no flat line underneath it.
  if (walkArcGeoJSON) {
    map.addSource('walk-arc-src', { type:'geojson', data:walkArcGeoJSON });
    map.addLayer({
      id:'walk-arc-layer', type:'fill-extrusion', source:'walk-arc-src',
      paint:{
        'fill-extrusion-color':'#10B981',
        'fill-extrusion-base':['get', 'base'],
        'fill-extrusion-height':['get', 'height'],
        'fill-extrusion-opacity':0.9
      }
    });
  }
}

// Great-circle-ish straight-line distance in metres between two lat/lng points
function haversineMeters(a, b) {
  var R = 6371000, toRad = Math.PI / 180;
  var dLat = (b[0] - a[0]) * toRad;
  var dLng = (b[1] - a[1]) * toRad;
  var la1 = a[0] * toRad, la2 = b[0] * toRad;
  var h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Builds a trail of small, separated extruded dash-blocks that step up and
// back down between "from" and "to", tracing a parabolic height profile.
// Because each dash's elevation is real 3-D (fill-extrusion-base/height in
// metres) rather than a horizontal lat/lng offset, the dashed arc keeps its
// "over-and-above" silhouette no matter how the map is rotated or pitched.
function buildWalkArcPolygons(from, to, n) {
  var distM   = haversineMeters(from, to);
  var maxH    = Math.min(Math.max(distM * 0.25, 12), 60); // clamp: 12–60 m peak
  var widthM  = 4.5;    // dash width, metres (a little bigger than before)
  var dashFrac = 0.45;  // fraction of each step that is solid dash (rest is gap)
  var latM    = 111320;
  var lngM    = 111320 * Math.cos(((from[0] + to[0]) / 2) * Math.PI / 180);

  function pointAt(t) {
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  }
  function heightAt(t) {
    return maxH * Math.sin(Math.PI * t);
  }

  // Builds a rounded "capsule" (stadium-shaped) footprint between p1 and p2 —
  // a rectangle with semicircular caps on both ends — so each dash reads as a
  // soft rounded pill rather than a sharp-cornered block.
  function buildCapsulePolygon(p1, p2, r) {
    var dxM = (p2[1] - p1[1]) * lngM;
    var dyM = (p2[0] - p1[0]) * latM;
    var len = Math.sqrt(dxM * dxM + dyM * dyM) || 0.0001;
    var dirX = dxM / len, dirY = dyM / len;
    var perpX = -dirY, perpY = dirX;
    var steps = 8;

    function toLngLat(anchor, offXm, offYm) {
      return [anchor[1] + offXm / lngM, anchor[0] + offYm / latM];
    }

    var pts = [];
    pts.push(toLngLat(p1, perpX * r, perpY * r));
    pts.push(toLngLat(p2, perpX * r, perpY * r));
    // Round cap around p2, sweeping outward (away from p1)
    for (var k = 1; k < steps; k++) {
      var ang = (k / steps) * Math.PI;
      var ox = perpX * Math.cos(ang) + dirX * Math.sin(ang);
      var oy = perpY * Math.cos(ang) + dirY * Math.sin(ang);
      pts.push(toLngLat(p2, ox * r, oy * r));
    }
    pts.push(toLngLat(p2, -perpX * r, -perpY * r));
    pts.push(toLngLat(p1, -perpX * r, -perpY * r));
    // Round cap around p1, sweeping outward (away from p2)
    for (var k2 = 1; k2 < steps; k2++) {
      var ang2 = (k2 / steps) * Math.PI;
      var ox2 = -perpX * Math.cos(ang2) - dirX * Math.sin(ang2);
      var oy2 = -perpY * Math.cos(ang2) - dirY * Math.sin(ang2);
      pts.push(toLngLat(p1, ox2 * r, oy2 * r));
    }
    pts.push(toLngLat(p1, perpX * r, perpY * r)); // close the ring
    return pts;
  }

  var features = [];
  for (var j = 0; j < n; j++) {
    var t0 = j / n;
    var t1 = t0 + (1 / n) * dashFrac; // dash occupies only part of the step, leaving a gap

    var p1 = pointAt(t0), p2 = pointAt(t1);
    var ring = buildCapsulePolygon(p1, p2, widthM / 2);

    var h1 = heightAt(t0), h2 = heightAt(t1);
    var base = Math.min(h1, h2);
    var top  = Math.max(h1, h2);
    if (top - base < 2) top = base + 2; // keep even near-flat dashes visibly 3-D

    features.push({
      type:'Feature',
      properties:{ base:base, height:top },
      geometry:{ type:'Polygon', coordinates:[ring] }
    });
  }
  return features;
}

// Small hex→rgba helper (used for the pulse ring around the user location dot)
function hexToRgba(hex, alpha) {
  var h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(function(c) { return c + c; }).join('');
  var r = parseInt(h.substring(0, 2), 16);
  var g = parseInt(h.substring(2, 4), 16);
  var b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return 'rgba(107,33,168,' + alpha + ')';
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

// ── User location marker ("you are here") ──────────────────────────────────
function drawUserLocation() {
  if (userLocMarker) { userLocMarker.remove(); userLocMarker = null; }
  if (!mapReady || !userLoc) return;

  var wrap = document.createElement('div');
  wrap.style.cssText = 'width:22px;height:22px;position:relative;';

  var pulse = document.createElement('div');
  pulse.style.cssText =
    'position:absolute;top:50%;left:50%;width:22px;height:22px;' +
    'transform:translate(-50%,-50%);border-radius:50%;' +
    'background:' + hexToRgba(PRIMARY_COLOR, 0.35) + ';animation:userLocPulse 1.8s ease-out infinite;';

  var dot = document.createElement('div');
  dot.style.cssText =
    'position:absolute;top:50%;left:50%;width:14px;height:14px;' +
    'transform:translate(-50%,-50%);border-radius:50%;' +
    'background:' + PRIMARY_COLOR + ';border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);';

  wrap.appendChild(pulse);
  wrap.appendChild(dot);

  if (!document.getElementById('userLocPulseStyle')) {
    var styleEl = document.createElement('style');
    styleEl.id = 'userLocPulseStyle';
    styleEl.textContent =
      '@keyframes userLocPulse {' +
      '0% { transform:translate(-50%,-50%) scale(0.6); opacity:0.9; }' +
      '100% { transform:translate(-50%,-50%) scale(2.2); opacity:0; }' +
      '}';
    document.head.appendChild(styleEl);
  }

  var popup = new maplibregl.Popup();

  userLocMarker = new maplibregl.Marker({ element:wrap })
    .setLngLat([userLoc.lng, userLoc.lat])
    .setPopup(popup)
    .addTo(map);
}

// ── Stop markers ──────────────────────────────────────────────────────────────
function drawStops() {
  stopMarkers.forEach(function(m) { m.remove(); });
  stopMarkers = [];
  if (!mapReady) return;

  allStops.forEach(function(stop, i) {
    var isFirst = i === 0;
    var isLast  = i === allStops.length - 1;
    var isXfer  = stop.isTransfer === true;

    var color  = isFirst ? '#10B981' : isLast ? '#EF4444' : isXfer ? '#F59E0B' : '#6b21a8';
    var border = isFirst ? '#D1FAE5' : isLast ? '#FEE2E2' : isXfer ? '#FEF3C7' : '#EDE9FE';
    var size   = (isFirst || isLast) ? 18 : 14;

    var el = document.createElement('div');
    el.style.cssText =
      'width:' + size + 'px;height:' + size + 'px;border-radius:50%;' +
      'background:' + color + ';border:3px solid ' + border + ';' +
      'box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer';

    var m = new maplibregl.Marker({ element:el })
      .setLngLat([stop.lng, stop.lat])
      .addTo(map);
    stopMarkers.push(m);

    // Tapping a stop toggles its photo badge: shows it if hidden (whether
    // that reveals an existing photo or the "+" add-photo prompt), hides it
    // again on the next tap.
    if (stop.id) {
      el.addEventListener('click', function() {
        toggleStopBadge(stop.id);
      });
    }
  });
}

// ── Nearby-stops layer ────────────────────────────────────────────────────────
// Solid black dots marking every approved stop within range of the user's
// location. Tap once to see the stop's name; tap again quickly (or
// double-click) to send it back to the app to pre-fill the "start" field.
//
// Visibility rules (all handled by updateNearbyStopVisibility, never by
// removing/recreating markers, so nothing ever looks like a "refresh"):
//   1. Hidden completely whenever a route is on screen (allStops.length >= 2)
//      — including while panning the map around with that route showing.
//   2. Otherwise, only dots within SPOTLIGHT_RADIUS_PX of the pointer are
//      shown, so the screen doesn't fill up with dots the user isn't near.
//   3. On top of that, dots are bucketed into 4 declutter "tiers" (stable
//      per-stop, via a hash of its key) and fewer tiers are allowed through
//      as the map zooms out, so a wide zoomed-out view doesn't get dense.
var ROUTE_ACTIVE = allStops.length >= 2;
var SPOTLIGHT_RADIUS_PX = 320;
var mousePx = null; // {x,y} in map-canvas pixel space, or null (no pointer yet / touch)

// Tracks which nearby stops already have a marker on the map, keyed the same
// way React keys them (id if present, else "lat,lng") so a stop is never
// drawn twice even if the same batch is sent more than once.
var nearbyStopKeys = new Set();
// { stop, el, tier } for every nearby marker currently on the map — used by
// updateNearbyStopVisibility to decide show/hide without touching the DOM
// elements' existence, only their opacity.
var nearbyMarkerEntries = [];

function nearbyKeyFor(stop) {
  return stop.id != null ? String(stop.id) : (stop.lat + ',' + stop.lng);
}

// Cheap, stable string hash so the same stop always lands in the same
// declutter tier (0-3) instead of flickering between shown/hidden sets
// as data comes in different order.
function tierForKey(key) {
  var hash = 0;
  for (var i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 4;
}

// Higher zoom = more tiers allowed through = more dots visible.
function allowedTierForZoom(zoom) {
  if (zoom >= 15) return 3; // show every tier
  if (zoom >= 13) return 2;
  if (zoom >= 11) return 1;
  return 0; // most zoomed out: sparsest tier only
}

function updateNearbyStopVisibility() {
  if (!nearbyMarkerEntries.length) return;

  if (ROUTE_ACTIVE) {
    nearbyMarkerEntries.forEach(function(entry) {
      entry.el.style.opacity = '0';
      entry.el.style.pointerEvents = 'none';
    });
    return;
  }

  var allowedTier = allowedTierForZoom(map.getZoom());

  nearbyMarkerEntries.forEach(function(entry) {
    var visible = entry.tier <= allowedTier;

    if (visible && mousePx) {
      var pt = map.project([entry.stop.lng, entry.stop.lat]);
      var dx = pt.x - mousePx.x;
      var dy = pt.y - mousePx.y;
      if (Math.sqrt(dx * dx + dy * dy) > SPOTLIGHT_RADIUS_PX) visible = false;
    }

    entry.el.style.opacity = visible ? '1' : '0';
    entry.el.style.pointerEvents = visible ? 'auto' : 'none';
  });
}

function createNearbyStopMarker(stop) {
  var el = document.createElement('div');
  el.style.cssText =
    'width:11px;height:11px;border-radius:50%;' +
    'background:#000;' +
    'box-shadow:0 0 0 1.5px rgba(255,255,255,0.6),0 1px 4px rgba(0,0,0,0.4);' +
    'cursor:pointer;touch-action:none;';
  // Newly-spawned dots ease in/out rather than popping.
  el.style.opacity = '0';
  el.style.transition = 'opacity 0.35s ease-out';

  var popup = new maplibregl.Popup({
    offset: 12,
    closeButton: false,
    closeOnClick: false,
    className: 'nearby-stop-popup'
  }).setHTML(
    '<div class="nearby-stop-popup-name">' + (stop.name || 'Stop') + '</div>' +
    '<div class="nearby-stop-popup-hint">Double tap marker to start with this location</div>'
  );

  var m = new maplibregl.Marker({ element: el })
    .setLngLat([stop.lng, stop.lat])
    .addTo(map);
  nearbyMarkers.push(m);

  nearbyMarkerEntries.push({ stop: stop, el: el, tier: tierForKey(nearbyKeyFor(stop)) });

  var lastTapAt = 0;
  var DOUBLE_TAP_MS = 350;

  function handleTap(e) {
    if (e) e.stopPropagation();
    var now = Date.now();

    if (now - lastTapAt < DOUBLE_TAP_MS) {
      // Second tap within the window — treat as a double tap/click.
      lastTapAt = 0;
      popup.remove();
      try {
        window.parent.postMessage(
          { type: 'NEARBY_STOP_DBLTAP', name: stop.name, lat: stop.lat, lng: stop.lng },
          '*'
        );
      } catch (err) {}
      return;
    }

    lastTapAt = now;
    if (popup.isOpen()) {
      popup.remove();
    } else {
      popup.setLngLat([stop.lng, stop.lat]).addTo(map);
    }
  }

  // On touch devices, a rapid pair of taps on this dot is otherwise
  // intercepted by MapLibre's own double-tap-to-zoom gesture (it listens
  // for touchstart/touchend on the map canvas, which these events would
  // bubble up to) — so the map zooms in instead of the second "click"
  // ever reaching this element. Stopping propagation on touchstart keeps
  // the map's handler from ever seeing the gesture, and handling the tap
  // directly off touchend (with preventDefault, which also suppresses the
  // browser's native double-tap-to-zoom and the synthetic "click" that
  // would otherwise follow) makes double-tap detection reliable on mobile.
  el.addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: true });
  el.addEventListener('touchend', function(e) {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    handleTap(e);
  }, { passive: false });

  // Desktop mouse clicks (no preceding touch) still go through here.
  el.addEventListener('click', handleTap);
}

// Spawns markers only for stops not already on the map — used for both the
// initial full send (right after MAP_READY) and every later batch that
// comes in as the user pans. Never clears/redraws what's already there, so
// panning to reveal new stops never looks like a map "refresh". No-op
// entirely while a route is on screen, since nearby dots stay hidden then.
function addNearbyStopsIncremental(newStops) {
  if (!mapReady || ROUTE_ACTIVE || !newStops || !newStops.length) return;
  newStops.forEach(function(stop) {
    if (typeof stop.lat !== 'number' || typeof stop.lng !== 'number') return;
    var key = nearbyKeyFor(stop);
    if (nearbyStopKeys.has(key)) return;
    nearbyStopKeys.add(key);
    nearbyStopsData.push(stop);
    createNearbyStopMarker(stop);
  });
  updateNearbyStopVisibility();
}

// Full clear-and-redraw of every nearby stop seen so far — only used after a
// style/layer swap, since that can drop marker DOM that isn't part of the
// new style. Everyday panning never calls this; it uses the incremental
// spawn above so existing dots are left alone.
function redrawAllNearbyMarkers() {
  nearbyMarkers.forEach(function(m) { m.remove(); });
  nearbyMarkers = [];
  nearbyMarkerEntries = [];
  if (!mapReady || ROUTE_ACTIVE) return;
  nearbyStopsData.forEach(function(stop) {
    if (typeof stop.lat !== 'number' || typeof stop.lng !== 'number') return;
    createNearbyStopMarker(stop);
  });
  updateNearbyStopVisibility();
}

// Recompute on every pan/zoom (screen positions and the zoom-tier cutoff
// both change) and on pointer movement (spotlight follows the mouse).
map.on('move', updateNearbyStopVisibility);
map.on('zoom', updateNearbyStopVisibility);
map.getCanvasContainer().addEventListener('mousemove', function(e) {
  var rect = map.getCanvasContainer().getBoundingClientRect();
  mousePx = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  updateNearbyStopVisibility();
});
map.getCanvasContainer().addEventListener('mouseleave', function() {
  mousePx = null;
  updateNearbyStopVisibility();
});

// ── Stop photo badges ────────────────────────────────────────────────────────
// A small square "pin" sits just above each stop, showing that stop's first
// approved photo (click to open the full-size lightbox), or a "+" button to
// add one when there isn't an approved photo yet.
function imagesForStop(stopId) {
  return stopImagesMap[stopId] || [];
}
function approvedImagesForStop(stopId) {
  return imagesForStop(stopId).filter(function(img) { return img.approved; });
}
function hasMinePendingForStop(stopId) {
  return imagesForStop(stopId).some(function(img) { return img.mine && !img.approved; });
}

function buildPhotoBadgeEl(stop) {
  var approved = approvedImagesForStop(stop.id);
  var el = document.createElement('div');
  el.className = 'stop-photo-badge';

  if (approved.length > 0) {
    el.style.backgroundImage = "url('" + approved[0].url + "')";
    el.onclick = function(e) { e.stopPropagation(); openLightbox(stop); };
    if (approved.length > 1) {
      var countEl = document.createElement('span');
      countEl.className = 'stop-photo-count';
      countEl.textContent = '+' + (approved.length - 1);
      el.appendChild(countEl);
    }
  } else {
    el.classList.add('empty');
    var plus = document.createElement('span');
    plus.className = 'stop-photo-plus';
    plus.textContent = '+';
    el.appendChild(plus);
    el.title = 'Add a photo of this stop';
    if (hasMinePendingForStop(stop.id)) {
      var dot = document.createElement('span');
      dot.className = 'stop-photo-pending-dot';
      el.appendChild(dot);
      el.title = 'Your photo is pending approval — add another';
    }
    el.onclick = function(e) { e.stopPropagation(); triggerFileInput(stop.id); };
  }
  return el;
}

function isStopBadgeVisible(stopId) {
  if (Object.prototype.hasOwnProperty.call(badgeOverride, stopId)) return badgeOverride[stopId];
  return approvedImagesForStop(stopId).length > 0;
}

function toggleStopBadge(stopId) {
  badgeOverride[stopId] = !isStopBadgeVisible(stopId);
  drawStopPhotoBadges();
}

function drawStopPhotoBadges() {
  photoMarkers.forEach(function(m) { m.remove(); });
  photoMarkers = [];
  photoBadgeEls = {};
  if (!mapReady) return;

  allStops.forEach(function(stop, i) {
    if (!stop.id) return; // can't attach/upload photos without a real stop id
    if (!isStopBadgeVisible(stop.id)) return;

    var isFirst = i === 0;
    var isLast  = i === allStops.length - 1;
    var dotSize = (isFirst || isLast) ? 18 : 14;

    var el = buildPhotoBadgeEl(stop);
    photoBadgeEls[stop.id] = el;

    var m = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -(dotSize / 2 + 12)] })
      .setLngLat([stop.lng, stop.lat])
      .addTo(map);
    photoMarkers.push(m);
  });
}

function setBadgeUploading(stopId, isUploading) {
  var el = photoBadgeEls[stopId];
  if (!el) return;
  el.classList.toggle('uploading', isUploading);
}

function refreshBadgeForStop(stopId) {
  // A maplibre Marker holds a reference to its own root element for
  // positioning, so we can't safely swap that element out in place —
  // just redraw all badges, which is cheap for the handful of stops on screen.
  drawStopPhotoBadges();
}

// ── Brief confirmation toast (e.g. "Image sent successfully") ──────────────
var toastHideTimer = null;
function showToast(message) {
  var toastEl = document.getElementById('mapToast');
  if (!toastEl) return;
  toastEl.innerHTML =
    '<span class="map-toast-check">' +
    '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="20 6 9 17 4 12"></polyline></svg></span>' +
    '<span>' + message + '</span>';
  toastEl.classList.add('map-toast-visible');
  if (toastHideTimer) clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(function() {
    toastEl.classList.remove('map-toast-visible');
  }, 2600);
}

// ── Add-photo flow (file picker; mobile browsers offer camera or gallery) ───
function triggerFileInput(stopId) {
  pendingUploadStopId = stopId;
  var input = document.getElementById('stopPhotoInput');
  input.value = '';
  input.click();
}

document.getElementById('stopPhotoInput').addEventListener('change', function(e) {
  var file = e.target.files && e.target.files[0];
  var stopId = pendingUploadStopId;
  if (!file || !stopId) return;

  var reader = new FileReader();
  reader.onload = function() {
    setBadgeUploading(stopId, true);
    try {
      window.parent.postMessage({
        type: 'STOP_IMAGE_UPLOAD',
        stopId: stopId,
        dataUrl: reader.result,
        fileName: file.name,
        mimeType: file.type
      }, '*');
    } catch (err) {}
  };
  reader.readAsDataURL(file);
});

// ── Full-size photo lightbox ────────────────────────────────────────────────
function openLightbox(stop) {
  var images = approvedImagesForStop(stop.id);
  if (images.length === 0) return;
  var idx = 0;

  var overlay = document.createElement('div');
  overlay.className = 'photo-lightbox-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) close(); };

  var img = document.createElement('img');
  img.className = 'photo-lightbox-img';

  var caption = document.createElement('div');
  caption.className = 'photo-lightbox-caption';

  var addBtn = document.createElement('div');
  addBtn.className = 'photo-lightbox-add';
  addBtn.textContent = '+ Add photo';
  addBtn.onclick = function(e) { e.stopPropagation(); close(); triggerFileInput(stop.id); };

  overlay.appendChild(img);
  overlay.appendChild(caption);
  overlay.appendChild(addBtn);

  if (images.length > 1) {
    var prevBtn = document.createElement('div');
    prevBtn.className = 'photo-lightbox-nav photo-lightbox-prev';
    prevBtn.innerHTML = '&#8249;';
    prevBtn.onclick = function(e) { e.stopPropagation(); idx = (idx - 1 + images.length) % images.length; render(); };

    var nextBtn = document.createElement('div');
    nextBtn.className = 'photo-lightbox-nav photo-lightbox-next';
    nextBtn.innerHTML = '&#8250;';
    nextBtn.onclick = function(e) { e.stopPropagation(); idx = (idx + 1) % images.length; render(); };

    overlay.appendChild(prevBtn);
    overlay.appendChild(nextBtn);
  }

  function render() {
    img.src = images[idx].url;
    caption.textContent = stop.name + (images.length > 1 ? ' (' + (idx + 1) + '/' + images.length + ')' : '');
  }
  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  render();
  document.body.appendChild(overlay);
}

// ── Messages from React (photo data sync + upload results) ──────────────────
window.addEventListener('message', function(e) {
  if (!e.data) return;
  if (e.data.type === 'FLY_TO_USER') {
    if (userLoc && mapReady) {
      map.flyTo({ center: [userLoc.lng, userLoc.lat], zoom: Math.max(map.getZoom(), 15), essential: true });
    }
  }
  if (e.data.type === 'FLY_TO_ROUTE') {
    if (routeBounds && mapReady) {
      map.fitBounds(routeBounds, { padding: 60, animate: true, duration: 800 });
    }
  }
  if (e.data.type === 'USER_LOCATION_UPDATE') {
    userLoc = e.data.location || null;
    drawUserLocation();
  }
  if (e.data.type === 'STOP_IMAGES_SYNC') {
    stopImagesMap = e.data.images || {};
    drawStopPhotoBadges();
  }
  if (e.data.type === 'NEARBY_STOPS_ADD') {
    addNearbyStopsIncremental(e.data.stops || []);
  }
  if (e.data.type === 'STOP_IMAGE_UPLOAD_RESULT') {
    setBadgeUploading(e.data.stopId, false);
    if (e.data.success) {
      refreshBadgeForStop(e.data.stopId);
      showToast('Image sent successfully');
    } else if (e.data.error) {
      alert(e.data.error);
    }
  }
});
</script>
</body>
</html>`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center, routeCoordinates, stops, primaryColor, volunteerMode]);
  // NOTE: `userLocation` is intentionally left out of this dependency list
  // too, for the same reason as `nearbyStops` below — embedding it only
  // seeds the iframe's *initial* user-location dot; after that, updates are
  // pushed in live via syncUserLocation/USER_LOCATION_UPDATE instead of
  // rebuilding the whole map (which used to reset zoom/pan/bearing and
  // cause a visible "flash" every time a fresh GPS fix came in).
  // NOTE: `nearbyStops` is intentionally left out of this dependency list.
  // Embedding it only seeds the iframe's *initial* set of nearby-stop dots;
  // after that, new stops are pushed in live via postMessage (see the
  // NEARBY_STOPS_ADD effect below) instead of rebuilding the whole map HTML,
  // which used to blow away zoom/pan and look like a "refresh" every time
  // the user panned somewhere new.

  const html = useMemo(() => generateHTML(), [generateHTML]);

  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    // A fresh map/iframe is loading — reset the ready/slow flags
    setIsMapReady(false);
    setIsMapSlow(false);
    return () => URL.revokeObjectURL(url);
  }, [html]);

  // If the map hasn't reported ready within 3s, let the user know it's still on its way
  useEffect(() => {
    if (isMapReady) {
      setIsMapSlow(false);
      return;
    }
    const timer = setTimeout(() => setIsMapSlow(true), 3000);
    return () => clearTimeout(timer);
  }, [isMapReady, blobUrl]);

  return (
    <div className="map-wrapper" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <iframe
        ref={iframeRef}
        src={blobUrl || 'about:blank'}
        className="map-container"
        style={{ border: 'none', width: '100%', height: '100%', display: 'block' }}
        title="Ghana Trotro Transit Map"
        allow="geolocation"
      />
      {!isMapReady && !hasSeenMapRef.current && (
        <div className="map-loading-overlay">
          <div className="map-loading-spinner"></div>
          <p className="map-loading-text">Loading map...</p>
          {isMapSlow && (
            <p className="map-loading-subtext">
              This is taking longer than usual. Hang tight, it doesn&apos;t normally take this long.
              <p>You might have a poor internet connection. Check that.</p>
            </p>
          )}
        </div>
      )}
    </div>
  );
});

MapComponent.displayName = 'MapComponent';
export default MapComponent;