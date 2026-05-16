import React, { useEffect, useRef, useCallback } from 'react';
import './MapComponent.css';

const TILE_LAYERS = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  },
};

const buildArcPath = (map, from, to, arcHeightFactor = 0.35) => {
  const p1 = map.latLngToLayerPoint(from);
  const p2 = map.latLngToLayerPoint(to);

  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;

  const dx    = p2.x - p1.x;
  const dy    = p2.y - p1.y;
  const chord = Math.sqrt(dx * dx + dy * dy) || 1;
  const lift  = chord * arcHeightFactor;

  // CW-perpendicular unit vector: (dy, -dx) → pushes downward / to the right
  const nx =  dy / chord;
  const ny = -dx / chord;

  return `M ${p1.x} ${p1.y} Q ${mx + nx * lift} ${my + ny * lift} ${p2.x} ${p2.y}`;
};

// ─── Component ────────────────────────────────────────────────────────────────
const MapComponent = React.memo(({ center, routeCoordinates, stops, mapMode = 'satellite', isComposite = false }) => {
  const mapRef            = useRef(null);
  const mapInstanceRef    = useRef(null);
  const routingControlRef = useRef(null);
  const walkArcsLayerRef  = useRef(null);
  const walkMarkersRef    = useRef([]);
  const tileLayerRef      = useRef(null);
  const isInitializedRef  = useRef(false);

  // ── Leaflet lazy-loader ────────────────────────────────────────────────────
  const loadLeaflet = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (window.L) { resolve(); return; }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload = () => {
        const routingScript = document.createElement('script');
        routingScript.src =
          'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js';
        routingScript.onload = resolve;
        routingScript.onerror = reject;
        document.head.appendChild(routingScript);

        const routingCSS = document.createElement('link');
        routingCSS.rel = 'stylesheet';
        routingCSS.href =
          'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css';
        document.head.appendChild(routingCSS);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }, []);

  // ── Arc colour ─────────────────────────────────────────────────────────────
  const getArcColor = useCallback(
    () => (mapMode === 'satellite' ? '#10b981' : '#99979b'),
    [mapMode]
  );

  // ── Clear walk arcs & markers ──────────────────────────────────────────────
  const clearWalkArcs = useCallback(() => {
    const map = mapInstanceRef.current;
    if (walkArcsLayerRef.current && map) {
      map.removeLayer(walkArcsLayerRef.current);
      walkArcsLayerRef.current = null;
    }
    walkMarkersRef.current.forEach(m => { try { map && map.removeLayer(m); } catch {} });
    walkMarkersRef.current = [];
  }, []);

  // SVG arc overlay 
  const drawWalkArcs = useCallback((walkSegments) => {
    const map = mapInstanceRef.current;
    const L   = window.L;
    if (!map || !L || walkSegments.length === 0) return;

    const SvgArcLayer = L.Layer.extend({
      initialize(segments, color) {
        this._segments = segments;
        this._color    = color;
      },
      onAdd(map) {
        this._map = map;
        this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        Object.assign(this._svg.style, {
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none', overflow: 'visible', zIndex: 400,
        });
        map.getPanes().overlayPane.appendChild(this._svg);
        this._update = () => this._draw();
        map.on('moveend zoomend viewreset', this._update);
        this._draw();
      },
      onRemove(map) {
        map.off('moveend zoomend viewreset', this._update);
        if (this._svg && this._svg.parentNode) this._svg.parentNode.removeChild(this._svg);
      },
      _draw() {
        const svg = this._svg;
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        this._segments.forEach(({ from, to }) => {
          try {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', buildArcPath(this._map, from, to));
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', this._color);
            path.setAttribute('stroke-width', '4');
            path.setAttribute('stroke-dasharray', '10 8');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('opacity', '0.9');
            svg.appendChild(path);
          } catch (e) { console.warn('Arc draw error:', e); }
        });
      },
    });

    const layer = new SvgArcLayer(walkSegments, getArcColor());
    layer.addTo(map);
    walkArcsLayerRef.current = layer;
  }, [getArcColor]);

  // ── Main routing update ────────────────────────────────────────────────────
  const updateMapRouting = useCallback(() => {
    const map = mapInstanceRef.current;
    const L   = window.L;
    if (!map || !L) return;

    // Clear previous routing controls
    if (routingControlRef.current) {
      (Array.isArray(routingControlRef.current)
        ? routingControlRef.current : [routingControlRef.current]
      ).forEach(ctrl => { try { map.removeControl(ctrl); } catch {} });
      routingControlRef.current = null;
    }
    clearWalkArcs();

    if (!routeCoordinates || routeCoordinates.length < 2) return;

    // Classify segments.
    // For composite routes: leg-end stops are transfer points, NOT walk segments.
    // They stay inside the driving segment so road routing draws through them.
    const drivingSegments = [];
    const walkSegments    = [];
    let   currentRun      = [0];

    for (let i = 0; i < routeCoordinates.length - 1; i++) {
      const stop   = stops && stops[i];
      // Only arc when fare_to_next is explicitly 0.
      // Number(null) === 0 is true in JS, so we must check the raw value.
      const isWalk = stop && stop.fare_to_next === 0;
      if (isWalk) {
        if (currentRun.length > 1) drivingSegments.push([...currentRun]);
        walkSegments.push({
          from:      L.latLng(routeCoordinates[i][0],     routeCoordinates[i][1]),
          to:        L.latLng(routeCoordinates[i + 1][0], routeCoordinates[i + 1][1]),
          stopIndex: i,
        });
        currentRun = [i + 1];
      } else {
        currentRun.push(i + 1);
      }
    }
    if (currentRun.length > 1) drivingSegments.push([...currentRun]);

    // ── Road routing ───────────────────────────────────────────────────────
    const controls    = [];
    let   boundsSet   = false;

    drivingSegments.forEach((indices) => {
      if (indices.length < 2) return;
      const waypoints = indices.map(i =>
        L.latLng(routeCoordinates[i][0], routeCoordinates[i][1])
      );
      try {
        const ctrl = L.Routing.control({
          waypoints,
          routeWhileDragging: false,
          showAlternatives:   false,
          // Prevent waypoint dragging and adding new waypoints by clicking the line
          draggableWaypoints: false,
          addWaypoints:       false,
          lineOptions: {
            styles: [{ color: '#6b21a8', opacity: 0.8, weight: 6 }],
          },
          createMarker: (index, waypoint) => {
            const coordIndex = indices[index];
            const stop       = stops && stops[coordIndex];
            const stopName   = stop ? stop.name : `Stop ${coordIndex + 1}`;
            const isFirst    = coordIndex === 0;
            const isLast     = coordIndex === routeCoordinates.length - 1;
            // Transfer marker: encoded directly in the stop object by fetchCompositeSegments
            const isTransfer = stop?.isTransfer === true;

            let className = 'custom-marker';
            if (isFirst)    className += ' start-marker';
            if (isLast)     className += ' end-marker';
            if (isTransfer) className += ' transfer-marker';

            const marker = L.marker(waypoint.latLng, {
              icon: L.divIcon({
                className,
                html: isTransfer
                  ? `<div style="color:white;font-weight:bold;text-align:center;line-height:14px;font-size:9px;">⇄</div>`
                  : `<div style="color:white;font-weight:bold;text-align:center;line-height:14px;font-size:10px;">${coordIndex + 1}</div>`,
                iconSize: [20, 20], iconAnchor: [10, 10],
              }),
            });
            if (stop) {
              let popup = `<b>${stopName}</b>`;
              if (isTransfer) {
                popup += `<br><em style="color:#a855f7;font-weight:600;">Transfer point</em>`;
              } else if (stop.fare_to_next) {
                popup += `<br>Fare to next: GH₵ ${stop.fare_to_next}`;
              }
              if (stop.distance_to_next) popup += `<br>Distance: ${stop.distance_to_next} km`;
              marker.bindPopup(popup);
            }
            return marker;
          },
        }).addTo(map);

        ctrl.on('routesfound', (e) => {
          // Fit bounds once only (first driving segment that resolves)
          if (!boundsSet) {
            boundsSet = true;
            const coords = e.routes[0]?.coordinates;
            if (coords && coords.length) {
              map.fitBounds(
                coords.reduce((b, c) => b.extend(c), L.latLngBounds(coords[0], coords[0])),
                { padding: [20, 20] }
              );
            }
          }

          // Strip pointer-events from the drawn route polyline so clicks
          // pass through to the map and never trigger waypoint updates.
          map.eachLayer((layer) => {
            if (layer._path && layer.options && layer.options.color === '#6b21a8') {
              layer._path.style.pointerEvents = 'none';
              layer._path.style.cursor        = 'default';
            }
          });
        });

        controls.push(ctrl);
      } catch (err) {
        console.error('Routing segment error:', err);
        // Non-interactive fallback polyline
        const poly = L.polyline(
          indices.map(i => routeCoordinates[i]),
          { color: '#6b21a8', weight: 6, opacity: 0.8, lineJoin: 'round', interactive: false }
        ).addTo(map);
        if (!boundsSet) { boundsSet = true; map.fitBounds(poly.getBounds()); }
      }
    });

    routingControlRef.current = controls;

    // ── Walk-stop markers ──────────────────────────────────────────────────
    const newMarkers = [];
    walkSegments.forEach(({ from, to, stopIndex }) => {
      const stop     = stops && stops[stopIndex];
      const stopName = stop ? stop.name : `Stop ${stopIndex + 1}`;
      const isFirst  = stopIndex === 0;

      const fromM = L.marker(from, {
        icon: L.divIcon({
          className: `custom-marker${isFirst ? ' start-marker' : ''}`,
          html: `<div style="color:white;font-weight:bold;text-align:center;line-height:14px;font-size:10px;">${stopIndex + 1}</div>`,
          iconSize: [20, 20], iconAnchor: [10, 10],
        }),
      }).addTo(map);
      if (stop) {
        let popup = `<b>${stopName}</b><br><em style="color:#10B981;font-weight:600;">Walk to next stop</em>`;
        if (stop.distance_to_next) popup += `<br>Distance: ${stop.distance_to_next} km`;
        fromM.bindPopup(popup);
      }
      newMarkers.push(fromM);

      const nextStop = stops && stops[stopIndex + 1];
      const nextName = nextStop ? nextStop.name : `Stop ${stopIndex + 2}`;
      const isLast   = stopIndex + 1 === routeCoordinates.length - 1;

      const toM = L.marker(to, {
        icon: L.divIcon({
          className: `custom-marker${isLast ? ' end-marker' : ''}`,
          html: `<div style="color:white;font-weight:bold;text-align:center;line-height:14px;font-size:10px;">${stopIndex + 2}</div>`,
          iconSize: [20, 20], iconAnchor: [10, 10],
        }),
      }).addTo(map);
      if (nextStop) {
        let popup = `<b>${nextName}</b>`;
        if (nextStop.fare_to_next) popup += `<br>Fare to next: GH₵ ${nextStop.fare_to_next}`;
        if (nextStop.distance_to_next) popup += `<br>Distance: ${nextStop.distance_to_next} km`;
        toM.bindPopup(popup);
      }
      newMarkers.push(toM);
    });
    walkMarkersRef.current = newMarkers;

    drawWalkArcs(walkSegments);

    // Fit bounds when the entire route is walking
    if (drivingSegments.length === 0 && walkSegments.length > 0 && !boundsSet) {
      map.fitBounds(
        L.latLngBounds(routeCoordinates.map(c => L.latLng(c[0], c[1]))),
        { padding: [20, 20] }
      );
    }
  }, [routeCoordinates, stops, isComposite, clearWalkArcs, drawWalkArcs]);

  // ── Tile layer switch ──────────────────────────────────────────────────────
  const updateTileLayer = useCallback(() => {
    const map = mapInstanceRef.current;
    const L   = window.L;
    if (!map || !L) return;
    const cfg = TILE_LAYERS[mapMode] || TILE_LAYERS.satellite;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: cfg.maxZoom }).addTo(map);
    tileLayerRef.current.bringToBack();
  }, [mapMode]);

  const recolorWalkArcs = useCallback(() => {
    if (walkArcsLayerRef.current) {
      walkArcsLayerRef.current._color = getArcColor();
      walkArcsLayerRef.current._draw?.();
    }
  }, [getArcColor]);

  // ── Initialization ─────────────────────────────────────────────────────────
  const initializeMap = useCallback(async () => {
    if (isInitializedRef.current || !mapRef.current) return;
    try {
      await loadLeaflet();
      isInitializedRef.current = true;
      if (!mapInstanceRef.current) {
        const map = window.L.map(mapRef.current).setView(center, 15);
        mapInstanceRef.current = map;
        const cfg = TILE_LAYERS[mapMode] || TILE_LAYERS.satellite;
        tileLayerRef.current = window.L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: cfg.maxZoom }).addTo(map);
      }
      updateMapRouting();
    } catch (err) { console.error('Error initializing map:', err); }
  }, [center, loadLeaflet, mapMode, updateMapRouting]);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { initializeMap(); }, [initializeMap]);

  useEffect(() => {
    if (isInitializedRef.current && mapInstanceRef.current) {
      updateTileLayer();
      recolorWalkArcs();
    }
  }, [updateTileLayer, recolorWalkArcs]);

  useEffect(() => {
    if (isInitializedRef.current) updateMapRouting();
  }, [updateMapRouting]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
      routingControlRef.current = null;
      walkArcsLayerRef.current  = null;
      walkMarkersRef.current    = [];
      tileLayerRef.current      = null;
      isInitializedRef.current  = false;
    };
  }, []);

  return <div ref={mapRef} className="map-container" />;
});

MapComponent.displayName = 'MapComponent';
export default MapComponent;