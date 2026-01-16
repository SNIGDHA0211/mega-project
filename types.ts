export type Coordinate = [number, number]; // [Longitude, Latitude] from API

export interface Plot {
  id: string;
  area_ha: string;
  boundary: Coordinate[];
}

export interface PlotResponse {
  count: number;
  plots: Plot[];
}

// GeoJSON types for API response
export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: Coordinate[][]; // Array of coordinate rings (first is outer, rest are holes)
  };
  properties: {
    area_ha: string;
    plot_id: string;
    'system:index'?: string;
  };
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

// Leaflet expects [Latitude, Longitude]
export type LeafletCoordinate = [number, number]; 
