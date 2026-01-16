import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';

// Extend Leaflet types for Draw
declare module 'leaflet' {
  namespace Draw {
    interface DrawOptions {
      polygon?: any;
      polyline?: any;
      rectangle?: any;
      circle?: any;
      marker?: any;
      circlemarker?: any;
    }
    interface EditOptions {
      featureGroup: L.FeatureGroup;
      remove?: boolean;
    }
    interface ControlOptions {
      position?: L.ControlPosition;
      draw?: DrawOptions;
      edit?: EditOptions;
    }
    class Draw extends L.Control {
      constructor(options?: ControlOptions);
    }
    namespace Event {
      const CREATED: string;
      const EDITED: string;
      const DELETED: string;
    }
  }
}

interface LeafletDrawControlProps {
  drawingEnabled: boolean;
  onShapeCreated: (shape: GeoJSON.Feature) => void;
  onShapeEdited: (shape: GeoJSON.Feature) => void;
  onShapeDeleted: (shapeId: string) => void;
  drawnShapes: GeoJSON.Feature[];
}

const LeafletDrawControl: React.FC<LeafletDrawControlProps> = ({
  drawingEnabled,
  onShapeCreated,
  onShapeEdited,
  onShapeDeleted,
  drawnShapes,
}) => {
  const map = useMap();
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const featureGroupRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    // Create feature group to store drawn shapes
    if (!featureGroupRef.current) {
      featureGroupRef.current = new L.FeatureGroup();
      map.addLayer(featureGroupRef.current);
    }

    // Initialize draw control when enabled
    if (drawingEnabled && !drawControlRef.current) {
      // Ensure leaflet-draw is loaded
      if (typeof (window as any).L !== 'undefined' && (window as any).L.Control && (window as any).L.Control.Draw) {
        const DrawControl = (window as any).L.Control.Draw;
        const drawControl = new DrawControl({
        position: 'topright',
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: true,
            shapeOptions: {
              color: '#00ff00', // Green for drawn shapes
              fillColor: '#00ff00',
              fillOpacity: 0.2,
              weight: 3,
            },
          },
          polyline: {
            shapeOptions: {
              color: '#00ff00',
              weight: 3,
            },
          },
          rectangle: {
            shapeOptions: {
              color: '#00ff00',
              fillColor: '#00ff00',
              fillOpacity: 0.2,
              weight: 3,
            },
          },
          circle: {
            shapeOptions: {
              color: '#00ff00',
              fillColor: '#00ff00',
              fillOpacity: 0.2,
              weight: 3,
            },
          },
          marker: false,
          circlemarker: false,
        },
        edit: {
          featureGroup: featureGroupRef.current,
          remove: true,
        },
      });

        drawControlRef.current = drawControl;
        map.addControl(drawControl);

        // Handle draw created event
        const handleDrawCreated = (e: any) => {
          const layer = e.layer;
          const geoJSON = layer.toGeoJSON();
          
          // Add unique ID if not present
          if (!geoJSON.id) {
            geoJSON.id = `draw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          }
          
          // Add name property
          if (!geoJSON.properties) {
            geoJSON.properties = {};
          }
          if (!geoJSON.properties.name) {
            geoJSON.properties.name = `Shape ${Date.now()}`;
          }
          
          // Add to feature group
          featureGroupRef.current?.addLayer(layer);
          
          // Callback
          onShapeCreated(geoJSON);
        };

        // Handle draw edited event
        const handleDrawEdited = (e: any) => {
          e.layers.eachLayer((layer: L.Layer) => {
            const geoJSON = (layer as any).toGeoJSON();
            onShapeEdited(geoJSON);
          });
        };

        // Handle draw deleted event
        const handleDrawDeleted = (e: any) => {
          e.layers.eachLayer((layer: L.Layer) => {
            const geoJSON = (layer as any).toGeoJSON();
            if (geoJSON.id) {
              onShapeDeleted(geoJSON.id as string);
            }
          });
        };

        map.on('draw:created', handleDrawCreated);
        map.on('draw:edited', handleDrawEdited);
        map.on('draw:deleted', handleDrawDeleted);
      } else {
        console.error('Leaflet Draw is not loaded. Make sure leaflet-draw.js script is loaded in index.html');
      }
    }

    // Remove draw control when disabled
    if (!drawingEnabled && drawControlRef.current) {
      map.removeControl(drawControlRef.current);
      drawControlRef.current = null;
    }

    // Cleanup
    return () => {
      if (drawControlRef.current) {
        map.removeControl(drawControlRef.current);
        drawControlRef.current = null;
      }
      map.off('draw:created');
      map.off('draw:edited');
      map.off('draw:deleted');
    };
  }, [map, drawingEnabled, onShapeCreated, onShapeEdited, onShapeDeleted]);

  // Sync drawn shapes with feature group
  useEffect(() => {
    if (!featureGroupRef.current) return;

    // Clear existing layers
    featureGroupRef.current.clearLayers();

    // Add all drawn shapes
    drawnShapes.forEach((shape) => {
      const layer = L.geoJSON(shape, {
        style: {
          color: '#00ff00',
          fillColor: '#00ff00',
          fillOpacity: 0.2,
          weight: 3,
        },
        onEachFeature: (feature, layer) => {
          if (feature.properties && feature.properties.name) {
            layer.bindPopup(`<b>${feature.properties.name}</b>`);
          }
        },
      });
      featureGroupRef.current?.addLayer(layer);
    });
  }, [drawnShapes]);

  return null;
};

export default LeafletDrawControl;

