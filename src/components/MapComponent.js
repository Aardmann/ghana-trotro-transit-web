import React, { useEffect, useRef, useCallback } from 'react';
import './MapComponent.css';

// Use React.memo to prevent unnecessary re-renders
const MapComponent = React.memo(({ center, routeCoordinates, stops }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routingControlRef = useRef(null);
  const isInitializedRef = useRef(false);

  // Memoized initialization function
  const initializeMap = useCallback(async () => {
    // Prevent multiple initializations
    if (isInitializedRef.current) {
      return;
    }

    // Load Leaflet CSS and JS dynamically
    const loadLeaflet = () => {
      return new Promise((resolve, reject) => {
        // Check if Leaflet is already loaded
        if (window.L) {
          resolve();
          return;
        }

        // Load Leaflet CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        link.crossOrigin = '';
        link.onload = () => console.log('Leaflet CSS loaded');
        link.onerror = (err) => {
          console.error('Failed to load Leaflet CSS:', err);
          reject(err);
        };
        document.head.appendChild(link);

        // Load Leaflet JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
        script.crossOrigin = '';
        script.onload = () => {
          console.log('Leaflet JS loaded');
          // Load Leaflet Routing Machine
          const routingScript = document.createElement('script');
          routingScript.src = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js';
          routingScript.onload = () => {
            console.log('Leaflet Routing Machine loaded');
            resolve();
          };
          routingScript.onerror = (err) => {
            console.error('Failed to load Leaflet Routing Machine:', err);
            reject(err);
          };
          document.head.appendChild(routingScript);

          // Load Routing Machine CSS
          const routingCSS = document.createElement('link');
          routingCSS.rel = 'stylesheet';
          routingCSS.href = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css';
          document.head.appendChild(routingCSS);
        };
        script.onerror = (err) => {
          console.error('Failed to load Leaflet JS:', err);
          reject(err);
        };
        document.head.appendChild(script);
      });
    };

    if (!mapRef.current) return;

    try {
      await loadLeaflet();
      isInitializedRef.current = true;

      // Initialize map only if not already initialized
      if (!mapInstanceRef.current) {
        const map = window.L.map(mapRef.current).setView(center, 13);
        mapInstanceRef.current = map;

        // Add OpenStreetMap tiles
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 18
        }).addTo(map);
      }

      // Update map routing based on new data
      updateMapRouting();
      
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }, [center]);

  const updateMapRouting = useCallback(() => {
    if (!mapInstanceRef.current || !window.L) return;

    // Clear previous routing
    if (routingControlRef.current) {
      mapInstanceRef.current.removeControl(routingControlRef.current);
      routingControlRef.current = null;
    }

    // Add routing if we have coordinates
    if (routeCoordinates && routeCoordinates.length > 1) {
      try {
        const waypoints = routeCoordinates.map(coord => 
          window.L.latLng(coord[0], coord[1])
        );

        routingControlRef.current = window.L.Routing.control({
          waypoints: waypoints,
          routeWhileDragging: false,
          showAlternatives: false,
          lineOptions: {
            styles: [
              {
                color: '#6b21a8',
                opacity: 0.8,
                weight: 6
              }
            ]
          },
          createMarker: (index, waypoint, totalWaypoints) => {
            const stop = stops && stops[index] ? stops[index] : null;
            const stopName = stop ? stop.name : `Stop ${index + 1}`;
            
            let className = 'custom-marker';
            if (index === 0) className += ' start-marker';
            if (index === totalWaypoints - 1) className += ' end-marker';

            const marker = window.L.marker(waypoint.latLng, {
              icon: window.L.divIcon({
                className: className,
                html: `<div style="color: white; font-weight: bold; text-align: center; line-height: 14px; font-size: 10px;">${index + 1}</div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })
            });

            if (stop) {
              let popupContent = `<b>${stopName}</b>`;
              if (stop.fare_to_next) {
                popupContent += `<br>Fare to next: GH₵ ${stop.fare_to_next}`;
              }
              if (stop.distance_to_next) {
                popupContent += `<br>Distance: ${stop.distance_to_next} km`;
              }
              marker.bindPopup(popupContent);
            }

            return marker;
          }
        }).addTo(mapInstanceRef.current);

        // Fit map to route bounds
        routingControlRef.current.on('routesfound', (e) => {
          const routes = e.routes;
          if (routes && routes.length > 0) {
            const bounds = routes[0].coordinates.reduce((bounds, coord) => {
              return bounds.extend(coord);
            }, window.L.latLngBounds(routes[0].coordinates[0], routes[0].coordinates[0]));
            
            mapInstanceRef.current.fitBounds(bounds, { padding: [20, 20] });
          }
        });

      } catch (error) {
        console.error('Routing error:', error);
        // Fallback: Add simple polyline
        if (routeCoordinates.length > 1) {
          const polyline = window.L.polyline(routeCoordinates, {
            color: '#6b21a8',
            weight: 6,
            opacity: 0.8,
            lineJoin: 'round'
          }).addTo(mapInstanceRef.current);
          mapInstanceRef.current.fitBounds(polyline.getBounds());
        }
      }
    }
  }, [routeCoordinates, stops]);

  useEffect(() => {
    initializeMap();
  }, [initializeMap]);

  useEffect(() => {
    if (isInitializedRef.current) {
      updateMapRouting();
    }
  }, [updateMapRouting]);

  // Cleanup on actual unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      routingControlRef.current = null;
      isInitializedRef.current = false;
    };
  }, []);

  return <div ref={mapRef} className="map-container" />;
});

// Add display name for better debugging
MapComponent.displayName = 'MapComponent';

export default MapComponent;