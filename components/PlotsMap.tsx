import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, useMap } from 'react-leaflet';
import { Plot, LeafletCoordinate } from '../types';
import L from 'leaflet';

interface WaterSource {
  id: string;
  coordinates: number[][];
  tile_url: string;
  water_pixel_percentage: number;
}

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
}

// Helper component to fit bounds when plots change
const MapBounds: React.FC<{ plots: Plot[]; plotBounds?: L.LatLngBounds | null }> = ({ plots, plotBounds }) => {
  const map = useMap();

  useEffect(() => {
    // If plotBounds is provided, use it (for single plot with tile overlay)
    if (plotBounds && plotBounds.isValid()) {
      map.fitBounds(plotBounds, { padding: [50, 50] });
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
  onSelectWaterSource
}) => {
  // Default center (Nashik/Maharashtra area based on coordinates provided in prompt)
  const defaultCenter: LeafletCoordinate = [20.0130, 73.6620];
  
  // Debug logging
  React.useEffect(() => {
    console.log('🗺️ PlotsMap - showTileLayers:', showTileLayers);
    console.log('🗺️ PlotsMap - allPlotsTileUrls count:', Object.keys(allPlotsTileUrls).length);
    if (Object.keys(allPlotsTileUrls).length > 0) {
      console.log('🗺️ PlotsMap - Sample tile URL:', Object.values(allPlotsTileUrls)[0]);
    }
  }, [showTileLayers, allPlotsTileUrls]);

  return (
    <MapContainer 
      center={defaultCenter} 
      zoom={16} 
      scrollWheelZoom={true}
      className="h-full w-full z-0"
    >
      {/* Google Hybrid - Satellite view with labels (like Streamlit HYBRID) */}
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
              console.warn(`Invalid tile URL for plot ${plotId}:`, url);
              return null;
            }
            
            // Verify URL format
            if (!url.includes('{z}') || !url.includes('{x}') || !url.includes('{y}')) {
              console.warn(`Tile URL missing required placeholders for plot ${plotId}:`, url);
            }
            
            console.log(`🗺️ Rendering tile layer for plot ${plotId}:`, url);
            return (
              <TileLayer
                key={`tile-${plotId}`}
                url={url}
                maxZoom={20}
                minZoom={0}
                opacity={0.6}
                zIndex={1000}
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
          console.warn(`Plot ${plot.id} has invalid boundary coordinates`);
          return null;
        }

        // Convert GeoJSON-like [Lng, Lat] to Leaflet [Lat, Lng]
        const polygonCoords: LeafletCoordinate[] = plot.boundary
          .filter(coord => Array.isArray(coord) && coord.length >= 2)
          .map((coord) => [coord[1], coord[0]]); // Swap to [Lat, Lng]

        if (polygonCoords.length < 3) {
          console.warn(`Plot ${plot.id} has insufficient valid coordinates after conversion`);
          return null;
        }

        const isSelected = selectedPlotId === plot.id;
        const isWaterSource = plot.id.startsWith('water-source-');

        return (
          <Polygon
            key={plot.id}
            positions={polygonCoords}
            pathOptions={{
              // Water sources: Blue, Regular plots: White/Yellow
              color: isWaterSource 
                ? (isSelected ? '#3b82f6' : '#3b82f6') 
                : (isSelected ? '#FFD700' : '#FFFFFF'),
              fillColor: isWaterSource
                ? '#3b82f6'
                : (isSelected ? '#FFD700' : '#FFFFFF'),
              fillOpacity: isWaterSource ? 0.3 : 0, // Water sources have blue fill
              weight: isSelected ? 4 : (isWaterSource ? 2 : 1),
              opacity: 1
            }}
            eventHandlers={{
              click: () => onSelectPlot(plot.id),
            }}
          >
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
                  // Regular Plot Popup
                  <>
                    <span className="block font-bold text-gray-700 uppercase mb-1">Plot ID</span>
                    <span className="text-emerald-600 font-semibold">{plot.id}</span>
                  </>
                )}
              </div>
            </Popup>
          </Polygon>
        );
      }).filter((plot) => plot !== null)}

      {/* Water Sources from NDWI Detection */}
      {waterSources.map((waterSource) => {
        if (!waterSource.coordinates || !Array.isArray(waterSource.coordinates) || waterSource.coordinates.length < 3) {
          console.warn(`Water source ${waterSource.id} has invalid coordinates`);
          return null;
        }

        // Convert coordinates: API returns [Lng, Lat], Leaflet needs [Lat, Lng]
        const polygonCoords: LeafletCoordinate[] = waterSource.coordinates
          .filter(coord => Array.isArray(coord) && coord.length >= 2)
          .map((coord) => [coord[1], coord[0]]); // Swap to [Lat, Lng]

        if (polygonCoords.length < 3) {
          console.warn(`Water source ${waterSource.id} has insufficient valid coordinates`);
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
    </MapContainer>
  );
};

export default PlotsMap;