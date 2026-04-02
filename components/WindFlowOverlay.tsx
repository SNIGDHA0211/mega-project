import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { WindDirectResponse } from '../services/analysisService';
import { mountWindFlowOnMap } from '../utils/windFlowOnLeafletMap';

export interface WindFlowOverlayProps {
  payload: WindDirectResponse;
  /** When false, overlay is not mounted by parent; prop reserved for future pause */
  active?: boolean;
  particleCount?: number;
  showMarkers?: boolean;
}

/**
 * Must be rendered inside react-leaflet MapContainer. Draws canvas wind streaks + markers.
 */
const WindFlowOverlay: React.FC<WindFlowOverlayProps> = ({
  payload,
  active = true,
  particleCount,
  showMarkers,
}) => {
  const map = useMap();

  useEffect(() => {
    if (!active || !payload?.points_weather?.length) return;
    return mountWindFlowOnMap(map, payload, {
      particleCount,
      showMarkers,
    });
  }, [map, payload, active, particleCount, showMarkers]);

  return null;
};

export default WindFlowOverlay;
