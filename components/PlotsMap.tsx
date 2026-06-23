import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, Tooltip, useMap } from 'react-leaflet';
import { Plot, LeafletCoordinate } from '../types';
import L from 'leaflet';
import { isFieldPlotId, type WindDirectResponse } from '../services/analysisService';
import WindFlowOverlay from './WindFlowOverlay';
import PredictAreaMapCard from './PredictAreaMapCard';

interface WaterSource {
  id: string;
  coordinates: number[][];
  tile_url: string;
  water_pixel_percentage: number;
}

/** Predict-area crop fields: white outer border, dark green fill */
const PREDICT_AREA_FIELD_STROKE = '#ffffff';
const PREDICT_AREA_FIELD_FILL = '#166534';

/** Default map: continental India (matches typical “open on India” satellite view) */
const INDIA_DEFAULT_CENTER: LeafletCoordinate = [20.5937, 78.9629];
const INDIA_DEFAULT_ZOOM = 5;

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
  /** field_id -> fill hex when multiple crops ("All"); overrides cropColor for that field */
  fieldFillByFieldId?: Record<string, string>;
  /** When true, do not show Field ID / Area tooltip or popup (e.g. for district/subdistrict boundary only) */
  hideFieldIdAreaCard?: boolean;
  /** Open-Meteo wind AOI payload; when set with showWindFlowLayer, draws particles + markers on the map */
  windDirectPayload?: WindDirectResponse | null;
  showWindFlowLayer?: boolean;
  /** Right-side overlay: sugarcane & wheat predicted areas (predict-area) */
  predictAreaMapCard?: {
    loading: boolean;
    regionLabel: string;
    cropAreas: Record<'sugarcane' | 'wheat' | 'Soyabean' | 'Onion' | 'Mango', number | null>;
    cropColors?: Partial<Record<'sugarcane' | 'wheat' | 'Soyabean' | 'Onion' | 'Mango', string>>;
    selectedCrops: Record<'sugarcane' | 'wheat' | 'Soyabean' | 'Onion' | 'Mango', boolean>;
    onToggleCrop: (crop: 'sugarcane' | 'wheat' | 'Soyabean' | 'Onion' | 'Mango') => void;
  } | null;
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
    // New district / subdistrict / village → allow auto-fly again (selection changed)
    if (lastPlotsHash.current !== '' && plotsHash !== lastPlotsHash.current) {
      userHasInteracted.current = false;
    }
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

/** Recompute tile layout when the map panel is resized (fixes thin “strip” map). */
const MapLayoutFix: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const applyFloorHeight = () => {
      const h = el.getBoundingClientRect().height;
      if (h < 280) {
        const target = Math.max(400, Math.floor(window.innerHeight * 0.62));
        el.style.minHeight = `${target}px`;
      }
    };
    const invalidate = () => {
      applyFloorHeight();
      map.invalidateSize();
    };
    const onWinResize = () => invalidate();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(invalidate);
    });
    ro.observe(el);
    const root = el.closest('[data-plots-map-root]');
    if (root) ro.observe(root);
    if (el.parentElement) ro.observe(el.parentElement);
    window.addEventListener('resize', onWinResize);
    const t1 = window.setTimeout(invalidate, 0);
    const t2 = window.setTimeout(invalidate, 200);
    const t3 = window.setTimeout(invalidate, 800);
    return () => {
      ro.disconnect();
      el.style.minHeight = '';
      window.removeEventListener('resize', onWinResize);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [map]);
  return null;
};

/** No field polygons: keep the broad India view. */
const MapDefaultIndia: React.FC<{
  plotBounds?: L.LatLngBounds | null;
  hasPolygons: boolean;
}> = ({ plotBounds, hasPolygons }) => {
  const map = useMap();
  useEffect(() => {
    if (hasPolygons) return;
    if (plotBounds && plotBounds.isValid()) return;
    map.setView(INDIA_DEFAULT_CENTER, INDIA_DEFAULT_ZOOM, { animate: false });
    const id = requestAnimationFrame(() => map.invalidateSize());
    return () => cancelAnimationFrame(id);
  }, [map, hasPolygons, plotBounds]);
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
  fieldFillByFieldId = {},
  hideFieldIdAreaCard = false,
  windDirectPayload = null,
  showWindFlowLayer = false,
  predictAreaMapCard = null
}) => {
  const hasFieldPolygons = plots.some(
    (p) => p.boundary && Array.isArray(p.boundary) && p.boundary.length >= 3
  );
  
  return (
    <div
      className="plots-map-root relative z-0 flex w-full min-w-0 flex-1 flex-col"
      data-plots-map-root
    >
    <MapContainer 
      center={INDIA_DEFAULT_CENTER} 
      zoom={INDIA_DEFAULT_ZOOM} 
      scrollWheelZoom={true}
      zoomControl={false}
      className="z-0 h-full w-full min-h-0 min-w-0 flex-1"
      style={{ minHeight: 'max(45vh, 360px)' }}
    >
      <MapLayoutFix />
      <MapDefaultIndia plotBounds={plotBounds} hasPolygons={hasFieldPolygons} />
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
        const isFieldPlot = isFieldPlotId(plot.id);
        const isOutlineBoundary = plot.id.startsWith('outline:');
        // Only color fields that are in identified_field_boundaries (predict-area); others stay default
        const isInIdentifiedBoundaries = plot.id in fieldAreaByFieldId;
        // Highlight predict-area fields whenever field_id matches; cropColor is optional (fill falls back to dark green)
        const useCropColor = !isWaterSource && isInIdentifiedBoundaries;
        const displayAreaHa = fieldAreaByFieldId[plot.id] ?? (plot.area_ha ? Number(plot.area_ha) : undefined);
        const displayArea =
          displayAreaHa != null && !Number.isNaN(displayAreaHa)
            ? displayAreaHa
            : plot.area_ha
              ? Number(plot.area_ha)
              : 0;
        const fillFromPredict =
          fieldFillByFieldId[plot.id] ?? cropColor ?? '';
        const resolvedFillHex =
          typeof fillFromPredict === 'string' &&
          /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(fillFromPredict.trim())
            ? fillFromPredict.trim()
            : PREDICT_AREA_FIELD_FILL;
        // Village / district outline only – not field polygons
        const isBoundaryOnly = isOutlineBoundary;
        const showFieldMeta = isFieldPlot && !isWaterSource;

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
                      : (useCropColor ? resolvedFillHex : (isSelected ? '#FFD700' : '#FFFFFF')),
                    fillOpacity: isWaterSource ? 0.3 : (useCropColor ? 1 : 0),
                    weight: isSelected ? 4 : (isWaterSource ? 2 : useCropColor ? 2 : 1),
                    opacity: 1,
                  }),
            }}
            eventHandlers={{
              click: () => onSelectPlot(plot.id),
            }}
          >
            {/* Hover tooltip: Field ID + area (same format, shown only on hover) */}
            {showFieldMeta && (
              <Tooltip
                direction="top"
                offset={[0, -8]}
                opacity={0.92}
                className="field-plot-onmap-label"
              >
                <span className="font-medium">ID: {plot.id}</span>
                <br />
                <span className="text-emerald-600 font-semibold">{displayArea.toFixed(2)} ha</span>
              </Tooltip>
            )}
            {showFieldMeta && (
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
                    {(displayArea > 0) ? (
                      <div className="mt-2">
                        <span className="text-xs text-gray-600">Area: </span>
                        <span className="text-emerald-600 font-semibold">{displayArea.toFixed(2)} ha</span>
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
    {predictAreaMapCard && (
      <div className="pointer-events-none absolute right-2 top-2 z-[1000] max-w-[calc(100%-1rem)] sm:right-3 sm:top-3">
        <div className="pointer-events-auto">
          <PredictAreaMapCard
            loading={predictAreaMapCard.loading}
            regionLabel={predictAreaMapCard.regionLabel}
            cropAreas={predictAreaMapCard.cropAreas}
            cropColors={predictAreaMapCard.cropColors}
            selectedCrops={predictAreaMapCard.selectedCrops}
            onToggleCrop={predictAreaMapCard.onToggleCrop}
          />
        </div>
      </div>
    )}
    </div>
  );
};

export default PlotsMap;