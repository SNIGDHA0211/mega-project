import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, Tooltip, useMap } from 'react-leaflet';
import { Plot, LeafletCoordinate } from '../types';
import L from 'leaflet';
import type { WindDirectResponse } from '../services/analysisService';
import WindFlowOverlay from './WindFlowOverlay';

interface WaterSource {
  id: string;
  coordinates: number[][];
  tile_url: string;
  water_pixel_percentage: number;
}

/** Predict-area crop fields: white outer border, dark green fill */
const PREDICT_AREA_FIELD_STROKE = '#ffffff';
const PREDICT_AREA_FIELD_FILL = '#166534';

interface PlotsMapProps {
  plots: Plot[];
  selectedPlotId: string | null;
  onSelectPlot: (id: string) => void;
  tileUrl?: string | null;
  plotBounds?: L.LatLngBounds | null;
  allPlotsTileUrls?: Record<string, string>;
  showTileLayers?: boolean;
  waterSources?: WaterSource[];
  onSelectWaterSource?: (id: string, data: WaterSource) => void;
  /** When set (e.g. from predict-area for selected crop), plot boundaries use this color */
  cropColor?: string | null;
  /** field_id -> field_area_ha from predict-area; shown on hover and in popup */
  fieldAreaByFieldId?: Record<string, number>;
  /** When true, do not show Field ID / Area tooltip or popup (e.g. for district/subdistrict boundary only) */
  hideFieldIdAreaCard?: boolean;
  /** Open-Meteo wind AOI payload; when set with showWindFlowLayer, draws particles + markers on the map */
  windDirectPayload?: WindDirectResponse | null;
  showWindFlowLayer?: boolean;
}

// Helper component to fit bounds when plots change (only on initial load, not after user interaction)
const MapBounds: React.FC<{ plots: Plot[]; plotBounds?: L.LatLngBounds | null }> = ({ plots, plotBounds }) => {
  const map = useMap();
  const hasInitialized = React.useRef(false);
  const userHasInteracted = React.useRef(false);
  const lastPlotsHash = React.useRef<string>('');

  // Track user interaction (zoom/pan) to prevent auto-fitting after manual zoom
  useEffect(() => {
    const handleZoom = () => {
      userHasInteracted.current = true;
    };
    const handleMove = () => {
      userHasInteracted.current = true;
    };

    map.on('zoomstart', handleZoom);
    map.on('movestart', handleMove);

    return () => {
      map.off('zoomstart', handleZoom);
      map.off('movestart', handleMove);
    };
  }, [map]);

  useEffect(() => {
    // Create a hash of plot IDs to detect when plots actually change (not just re-render)
    const plotsHash = plots.map(p => p.id).sort().join(',');
    
    // Only fit bounds if:
    // 1. We haven't initialized yet AND user hasn't interacted, OR
    // 2. The plots have actually changed (different IDs) AND user hasn't interacted
    const shouldFitBounds = (!hasInitialized.current || plotsHash !== lastPlotsHash.current) && !userHasInteracted.current;
    
    if (shouldFitBounds) {
      // If plotBounds is provided, use it (for single plot with tile overlay)
      if (plotBounds && plotBounds.isValid()) {
        map.fitBounds(plotBounds, { padding: [50, 50] });
        hasInitialized.current = true;
        lastPlotsHash.current = plotsHash;
      } else if (plots.length > 0) {
        // Otherwise, calculate bounds from all plots
        const bounds = L.latLngBounds([]);
        plots.forEach(plot => {
          plot.boundary.forEach(coord => {
            // Input is [Lng, Lat], Leaflet needs [Lat, Lng]
            bounds.extend([coord[1], coord[0]]);
          });
        });
        
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50] });
          hasInitialized.current = true;
          lastPlotsHash.current = plotsHash;
        }
      }
    }
  }, [plots, plotBounds, map]);

  return null;
};

const PlotsMap: React.FC<PlotsMapProps> = ({ 
  plots, 
  selectedPlotId, 
  onSelectPlot, 
  tileUrl, 
  plotBounds,
  allPlotsTileUrls = {},
  showTileLayers = true,
  waterSources = [],
  onSelectWaterSource,
  cropColor = null,
  fieldAreaByFieldId = {},
  hideFieldIdAreaCard = false,
  windDirectPayload = null,
  showWindFlowLayer = false
}) => {
  // Default center (Nashik/Maharashtra area based on coordinates provided in prompt)
  const defaultCenter: LeafletCoordinate = [20.0130, 73.6620];
  
  return (
    <MapContainer 
      center={defaultCenter} 
      zoom={16} 
      scrollWheelZoom={true}
      zoomControl={false}
      className="h-full w-full z-0"
    >
      {/* Google Hybrid — satellite + labels */}
      <TileLayer
        url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
        maxZoom={20}
        attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
      />

      {/* Overlay tile layers from Google Earth Engine for all plots (like Streamlit) */}
      {showTileLayers && (
        <>
          {/* Single plot tile URL (for backward compatibility) */}
          {tileUrl && (
            <TileLayer
              url={tileUrl}
              maxZoom={20}
              opacity={2}
              zIndex={100}
              attribution="Google Earth Engine"
            />
          )}
          {/* All plots tile URLs */}
          {Object.entries(allPlotsTileUrls).map(([plotId, url]) => {
            // Google Earth Engine tile URLs use {z}/{x}/{y} format
            // Leaflet automatically replaces {z}, {x}, {y} with actual tile coordinates
            if (!url || typeof url !== 'string') {
              return null;
            }
            if (!url.includes('{z}') || !url.includes('{x}') || !url.includes('{y}')) {
              return null;
            }
            // Water Uptake: classwise GEE tiles (wu-*) or single card overlay (waterUptakeClass)
            const isWaterClassOverlay = plotId === 'waterUptakeClass' || plotId.startsWith('wu-');
            return (
              <TileLayer
                key={isWaterClassOverlay ? `tile-water-class-${url.slice(-40)}` : `tile-${plotId}`}
                url={url}
                maxZoom={20}
                minZoom={0}
                opacity={isWaterClassOverlay ? 0.78 : 0.6}
                zIndex={isWaterClassOverlay ? 2500 : 1000}
                attribution="Google Earth Engine"
                crossOrigin={true}
                errorTileUrl=""
              />
            );
          })}
        </>
      )}

      <MapBounds plots={plots} plotBounds={plotBounds} />

      {plots.map((plot) => {
        // Validate and convert coordinates: API returns [Lng, Lat], Leaflet needs [Lat, Lng]
        if (!plot.boundary || !Array.isArray(plot.boundary) || plot.boundary.length < 3) {
          return null;
        }

        // Convert GeoJSON-like [Lng, Lat] to Leaflet [Lat, Lng]
        const polygonCoords: LeafletCoordinate[] = plot.boundary
          .filter(coord => Array.isArray(coord) && coord.length >= 2)
          .map((coord) => [coord[1], coord[0]]); // Swap to [Lat, Lng]

        if (polygonCoords.length < 3) {
          return null;
        }

        const isSelected = selectedPlotId === plot.id;
        const isWaterSource = plot.id.startsWith('water-source-');
        // Only color fields that are in identified_field_boundaries (predict-area); others stay default
        const isInIdentifiedBoundaries = plot.id in fieldAreaByFieldId;
        // Highlight predict-area fields whenever field_id matches; cropColor is optional (fill falls back to dark green)
        const useCropColor = !isWaterSource && isInIdentifiedBoundaries;
        const displayAreaHa = fieldAreaByFieldId[plot.id] ?? (plot.area_ha ? Number(plot.area_ha) : undefined);
        // When hideFieldIdAreaCard is true, this is a district/subdistrict boundary – use visible stroke and light fill
        const isBoundaryOnly = hideFieldIdAreaCard && !isWaterSource;

        return (
          <Polygon
            key={plot.id}
            positions={polygonCoords}
            pathOptions={{
              // Boundary-only (district/subdistrict): white outline (readable on satellite)
              ...(isBoundaryOnly
                ? {
                    color: '#ffffff',
                    fillColor: '#ffffff',
                    fillOpacity: 0.08,
                    weight: 3,
                    opacity: 1,
                  }
                : {
                    // Crop fields (predict-area): white stroke, solid dark green fill
                    color: isWaterSource
                      ? '#3b82f6'
                      : (useCropColor ? PREDICT_AREA_FIELD_STROKE : (isSelected ? '#FFD700' : '#FFFFFF')),
                    fillColor: isWaterSource
                      ? '#3b82f6'
                      : (useCropColor
                          ? (cropColor && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(cropColor.trim())
                              ? cropColor.trim()
                              : PREDICT_AREA_FIELD_FILL)
                          : (isSelected ? '#FFD700' : '#FFFFFF')),
                    fillOpacity: isWaterSource ? 0.3 : (useCropColor ? 1 : 0),
                    weight: isSelected ? 4 : (isWaterSource ? 2 : useCropColor ? 2 : 1),
                    opacity: 1,
                  }),
            }}
            eventHandlers={{
              click: () => onSelectPlot(plot.id),
            }}
          >
            {/* Hover tooltip: show plot area (ha) on boundary hover – hidden when hideFieldIdAreaCard (e.g. district/subdistrict) */}
            {!plot.id.startsWith('water-source-') && !hideFieldIdAreaCard && (
              <Tooltip direction="top" offset={[0, -8]} opacity={0.95} permanent={false}>
                <span className="font-medium">Field ID: {plot.id}</span>
                <br />
                <span className="text-emerald-600 font-semibold">Area: {(displayAreaHa != null ? displayAreaHa : Number(plot.area_ha) || 0).toFixed(2)} ha</span>
              </Tooltip>
            )}
            {!hideFieldIdAreaCard && (
            <Popup className="font-sans font-medium text-sm">
              <div className="text-center">
                {plot.id.startsWith('water-source-') ? (
                  // Water Source Popup
                  <>
                    <span className="block font-bold text-gray-700 uppercase mb-1">Water Source</span>
                    <span className="text-blue-600 font-semibold mb-2">{plot.id}</span>
                    {waterSources.find(ws => ws.id === plot.id) && (
                      <div className="mt-2 space-y-1 text-left">
                        <div>
                          <span className="text-xs text-gray-600">Water Percentage: </span>
                          <span className="text-blue-600 font-semibold">
                            {waterSources.find(ws => ws.id === plot.id)?.water_pixel_percentage.toFixed(2)}%
                          </span>
                        </div>
                        {waterSources.find(ws => ws.id === plot.id)?.tile_url && (
                          <div className="mt-1">
                            <span className="text-xs text-gray-600 block">Tile URL:</span>
                            <span className="text-xs text-gray-500 break-all">
                              {waterSources.find(ws => ws.id === plot.id)?.tile_url.substring(0, 50)}...
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  // Regular Plot Popup (click) – show Field ID and area (from predict-area or plot)
                  <>
                    <span className="block font-bold text-gray-700 uppercase mb-1">Field ID</span>
                    <span className="text-emerald-600 font-semibold">{plot.id}</span>
                    {(displayAreaHa != null && displayAreaHa > 0) || (plot.area_ha && Number(plot.area_ha) > 0) ? (
                      <div className="mt-2">
                        <span className="text-xs text-gray-600">Area: </span>
                        <span className="text-emerald-600 font-semibold">{(displayAreaHa != null ? displayAreaHa : Number(plot.area_ha)).toFixed(2)} ha</span>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </Popup>
            )}
          </Polygon>
        );
      }).filter((plot) => plot !== null)}

      {/* Water Sources from NDWI Detection */}
      {waterSources.map((waterSource) => {
        if (!waterSource.coordinates || !Array.isArray(waterSource.coordinates) || waterSource.coordinates.length < 3) {
          return null;
        }

        // Convert coordinates: API returns [Lng, Lat], Leaflet needs [Lat, Lng]
        const polygonCoords: LeafletCoordinate[] = waterSource.coordinates
          .filter(coord => Array.isArray(coord) && coord.length >= 2)
          .map((coord) => [coord[1], coord[0]]); // Swap to [Lat, Lng]

        if (polygonCoords.length < 3) {
          return null;
        }

        return (
          <Polygon
            key={`water-${waterSource.id}`}
            positions={polygonCoords}
            pathOptions={{
              color: '#3b82f6', // Blue color for water sources
              fillColor: '#3b82f6',
              fillOpacity: 0.3,
              weight: 2,
              opacity: 0.8
            }}
            eventHandlers={{
              click: () => {
                if (onSelectWaterSource) {
                  onSelectWaterSource(waterSource.id, waterSource);
                }
              },
            }}
          >
            <Popup className="font-sans font-medium text-sm">
              <div className="text-center">
                <span className="block font-bold text-gray-700 uppercase mb-1">Water Source</span>
                <span className="text-blue-600 font-semibold mb-2">{waterSource.id}</span>
                <div className="mt-2 space-y-1">
                  <div>
                    <span className="text-xs text-gray-600">Water Percentage: </span>
                    <span className="text-blue-600 font-semibold">{waterSource.water_pixel_percentage.toFixed(2)}%</span>
                  </div>
                  {waterSource.tile_url && (
                    <div className="mt-2">
                      <span className="text-xs text-gray-600 block">Tile URL:</span>
                      <span className="text-xs text-gray-500 break-all">{waterSource.tile_url.substring(0, 50)}...</span>
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Polygon>
        );
      }).filter((source) => source !== null)}

      {windDirectPayload &&
        showWindFlowLayer &&
        (windDirectPayload.points_weather?.length ?? 0) > 0 && (
          <WindFlowOverlay payload={windDirectPayload} particleCount={480} showMarkers />
        )}
    </MapContainer>
  );
};

export default PlotsMap;