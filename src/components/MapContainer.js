import React, { useState, useEffect, useCallback } from 'react';
import MapComponent from './MapComponent';

const MapContainer = React.memo(({ user, selectedRoute, searchPerformed }) => {
  const [mapCenter, setMapCenter] = useState([5.6037, -0.1870]);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [stops, setStops] = useState([]);

  // Update map data only when selectedRoute actually changes
  useEffect(() => {
    if (selectedRoute) {
      const coords = selectedRoute.stops.map(stop => [stop.lat, stop.lng]);
      setRouteCoordinates(coords);
      setStops(selectedRoute.stops);
      
      if (coords.length > 0) {
        setMapCenter(coords[0]);
      }
    } else {
      setRouteCoordinates([]);
      setStops([]);
      setMapCenter([5.6037, -0.1870]);
    }
  }, [selectedRoute]);

  return (
    <MapComponent 
      center={mapCenter}
      routeCoordinates={routeCoordinates}
      stops={stops}
    />
  );
});

MapContainer.displayName = 'MapContainer';

export default MapContainer;