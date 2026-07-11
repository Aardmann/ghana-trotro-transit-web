import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../styles/MapComponent.css';

const MapComponent = React.memo(({
  center,
  routeCoordinates,
  stops,
  mapMode = 'normal',
  isComposite = false,
  onLayerChange,
}) => {
  const iframeRef = useRef(null);

  // Tracks whether the map inside the iframe has finished loading,
  // and whether it's taking unusually long (> 3s) so we can reassure the user
  const [isMapReady, setIsMapReady] = useState(false);
  const [isMapSlow, setIsMapSlow] = useState(false);

  // Listen for layer-change / map-ready messages from the iframe
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'MAP_LAYER_CHANGE' && onLayerChange) {
        onLayerChange(e.data.layer);
      }
      if (e.data?.type === 'MAP_READY') {
        setIsMapReady(true);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onLayerChange]);

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
    // Pass the current map layer so the iframe preserves it when route data changes
    const initialLayer = mapMode === 'satellite' ? 'satellite' : 'normal';

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
  </style>
</head>
<body>
<div id="map"></div>

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

// ── State ────────────────────────────────────────────────────────────────────
var currentLayer    = '${initialLayer}';
var mapReady        = false;
var routeBounds     = null;
var stopMarkers     = [];
var lastRoadGeoJSON = null;
var lastWalkGeoJSON = null;

// ── Data from React ──────────────────────────────────────────────────────────
var allStops    = ${stopsJSON};
var routeCoords = ${routeJSON};

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

  try { window.parent.postMessage({ type: 'MAP_READY' }, '*'); } catch(e) {}
});

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
  if (lastRoadGeoJSON) addRouteLayer(lastRoadGeoJSON, lastWalkGeoJSON);
  drawStops();
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

    var walkLines = [];
    groups.forEach(function(g) {
      if (g.type !== 'walk') return;
      var from = allStops[g.indices[0]];
      var to   = allStops[g.indices[1]];
      if (from.fare_to_next !== 0) return;
      var arc = buildArc([from.lat, from.lng], [to.lat, to.lng], 40);
      walkLines.push(arc.map(function(p) { return [p[1], p[0]]; }));
    });

    var roadGeoJSON = roadLines.length > 0
      ? { type:'Feature', geometry:{ type:'MultiLineString', coordinates:roadLines } }
      : null;
    var walkGeoJSON = walkLines.length > 0
      ? { type:'Feature', geometry:{ type:'MultiLineString', coordinates:walkLines } }
      : null;

    lastRoadGeoJSON = roadGeoJSON;
    lastWalkGeoJSON = walkGeoJSON;
    addRouteLayer(roadGeoJSON, walkGeoJSON);

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

function addRouteLayer(roadGeoJSON, walkGeoJSON) {
  ['route-line','walk-line'].forEach(function(id) { if (map.getLayer(id))  map.removeLayer(id); });
  ['route-src', 'walk-src' ].forEach(function(id) { if (map.getSource(id)) map.removeSource(id); });

  if (roadGeoJSON) {
    map.addSource('route-src', { type:'geojson', data:roadGeoJSON });
    map.addLayer({
      id:'route-line', type:'line', source:'route-src',
      layout:{ 'line-join':'round', 'line-cap':'round' },
      paint:{ 'line-color':'#6b21a8', 'line-width':6, 'line-opacity':0.9 }
    });
  }

  if (walkGeoJSON) {
    map.addSource('walk-src', { type:'geojson', data:walkGeoJSON });
    map.addLayer({
      id:'walk-line', type:'line', source:'walk-src',
      layout:{ 'line-join':'round', 'line-cap':'round' },
      paint:{ 'line-color':'#10B981', 'line-width':5, 'line-opacity':0.9, 'line-dasharray':[2,2] }
    });
  }
}

// Quadratic Bézier arc between two lat/lng points
function buildArc(from, to, n) {
  var mLat = (from[0] + to[0]) / 2;
  var mLng = (from[1] + to[1]) / 2;
  var d    = Math.sqrt(Math.pow(to[0] - from[0], 2) + Math.pow(to[1] - from[1], 2));
  var h    = Math.max(d * 0.2, 0.001);
  var pts  = [];
  for (var i = 0; i <= n; i++) {
    var t = i / n, t1 = 1 - t;
    pts.push([
      t1 * t1 * from[0] + 2 * t1 * t * (mLat + h) + t * t * to[0],
      t1 * t1 * from[1] + 2 * t1 * t *  mLng       + t * t * to[1]
    ]);
  }
  return pts;
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

    var roleLabel = isFirst ? 'Start' : isLast ? 'Destination' : isXfer ? 'Transfer' : ('Stop ' + i);
    var roleBg    = isFirst ? '#D1FAE5' : isLast ? '#FEE2E2' : isXfer ? '#FEF3C7' : '#EDE9FE';
    var roleColor = isFirst ? '#065F46' : isLast ? '#991B1B' : isXfer ? '#92400E' : '#5B21B6';

    var fareHtml = '';
    if (!isLast) {
      if (stop.fare_to_next === 0) {
        fareHtml = '<span style="display:inline-flex;align-items:center;gap:4px;'
          + 'background:#D1FAE5;border:1px solid #A7F3D0;border-radius:12px;'
          + 'padding:3px 10px;font-size:11px;font-weight:700;color:#065F46;">'
          + '<i style="width:6px;height:6px;border-radius:50%;background:#10B981;'
          + 'display:inline-block;font-style:normal;"></i>Walk to next</span>';
      } else if (stop.fare_to_next != null) {
        fareHtml = '<span style="display:inline-block;background:#EDE9FE;'
          + 'border:1px solid #DDD6FE;border-radius:12px;padding:3px 10px;'
          + 'font-size:11px;font-weight:700;color:#5B21B6;">'
          + 'GH&#8373; ' + stop.fare_to_next + '</span>';
      }
    }

    var distHtml = '';
    if (!isLast && stop.distance_to_next != null) {
      distHtml = '<span style="display:inline-block;background:#F1F5F9;'
        + 'border:1px solid #E2E8F0;border-radius:12px;padding:3px 10px;'
        + 'font-size:11px;font-weight:600;color:#475569;">'
        + stop.distance_to_next + ' km</span>';
    }

    var badgesHtml = (fareHtml || distHtml)
      ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">' + fareHtml + distHtml + '</div>'
      : '';

    var html =
      '<div style="font-family:system-ui,-apple-system,sans-serif;">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">' +
          '<i style="width:8px;height:8px;border-radius:50%;background:' + color +
            ';display:inline-block;font-style:normal;flex-shrink:0;"></i>' +
          '<span style="font-size:11px;font-weight:700;color:' + roleColor +
            ';background:' + roleBg + ';border-radius:20px;padding:2px 8px;">' + roleLabel + '</span>' +
        '</div>' +
        '<div style="font-size:15px;font-weight:800;color:#1E293B;line-height:1.3;">' + stop.name + '</div>' +
        '<div style="height:1px;background:#F1F5F9;margin:8px 0;"></div>' +
        badgesHtml +
      '</div>';

    var popup = new maplibregl.Popup({ offset:20, className:'stop-popup' }).setHTML(html);
    var m     = new maplibregl.Marker({ element:el })
      .setLngLat([stop.lng, stop.lat])
      .setPopup(popup)
      .addTo(map);
    stopMarkers.push(m);
  });
}
</script>
</body>
</html>`;
  }, [center, routeCoordinates, stops]);

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
      {!isMapReady && (
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