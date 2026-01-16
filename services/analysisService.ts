// Service for fetching analysis data (Growth, Water Uptake, Soil Moisture)
import { Coordinate } from '../types';

const isDevelopment = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const BASE_URL = 'https://web-production-72a7.up.railway.app'; 

// Fetch list of talukas and their plots
export interface TalukaListResponse {
  [talukaName: string]: number[];
}

// OLD API - REMOVED: fetchTalukaList no longer used

// Fetch list of districts
export interface DistrictItem {
  district: string;
  geometry?: any;
}

export interface DistrictsResponse {
  districts: DistrictItem[] | string[];
}

// Fetch districts with full data (including geometry)
export const fetchDistricts = async (): Promise<DistrictItem[]> => {
  try {
    const url = `${BASE_URL}/districts`;
    console.log('Fetching districts from:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: DistrictsResponse = await response.json();
    const districtsArray = data.districts || [];
    
    // Handle both formats: array of strings or array of objects
    if (districtsArray.length > 0 && typeof districtsArray[0] === 'object') {
      // Return full objects with geometry
      return districtsArray as DistrictItem[];
    } else {
      // Convert strings to objects (no geometry available)
      return (districtsArray as string[]).map(district => ({ district }));
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to ${BASE_URL}/districts`);
    }
    throw error;
  }
};

// Fetch subdistricts for a selected district
export interface SubdistrictItem {
  subdistrict: string;
  geometry?: {
    type: string;
    coordinates: any;
  };
}

export interface SubdistrictsResponse {
  district: string;
  subdistricts: SubdistrictItem[];
}

export const fetchSubdistricts = async (district: string): Promise<SubdistrictItem[]> => {
  try {
    const response = await fetch(`${BASE_URL}/subdistricts?district=${encodeURIComponent(district)}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: SubdistrictsResponse = await response.json();
    const subdistrictsArray = data.subdistricts || [];
    
    // Return subdistricts with geometry
    return subdistrictsArray.map(item => ({
      subdistrict: item.subdistrict,
      geometry: item.geometry
    }));
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to ${BASE_URL}/subdistricts`);
    }
    throw error;
  }
};

// Fetch villages for a selected subdistrict
export interface VillageItem {
  village: string;
  geom_type?: string;
  coordinates?: any;
  geometry?: {
    type: string;
    coordinates: any;
  };
}

export interface VillagesResponse {
  subdistrict: string;
  villages: VillageItem[];
}

export const fetchVillages = async (subdistrict: string): Promise<VillageItem[]> => {
  try {
    const response = await fetch(`${BASE_URL}/villages?subdistrict=${encodeURIComponent(subdistrict)}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: VillagesResponse = await response.json();
    const villagesArray = data.villages || [];
    
    // Return villages with geom_type and coordinates (or geometry for backward compatibility)
    return villagesArray.map(item => ({
      village: item.village,
      geom_type: item.geom_type,
      coordinates: item.coordinates,
      geometry: item.geometry // For backward compatibility
    }));
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to ${BASE_URL}/villages`);
    }
    throw error;
  }
};

// Fetch Growth Analysis for district/subdistrict/village
export interface GrowthPlotData {
  type?: string; // "Feature" for GeoJSON format
  geometry?: {
    type: string;
    coordinates: number[][][]; // [[[lng, lat], [lng, lat], ...]] for Polygon
  };
  properties?: {
    plot_id: string;
    area_acres: number;
    tile_url: string;
    start_date?: string;
    end_date?: string;
    data_source?: string;
    last_updated?: string;
  };
  // Direct format (for backward compatibility)
  plot_id?: string;
  area_acres?: number;
  tile_url?: string;
  coordinates?: number[][]; // [[lng, lat], [lng, lat], ...]
}

export interface GrowthPixelSummary {
  healthy_pixel_count?: number;
  healthy_pixel_percentage?: number;
  moderate_pixel_count?: number;
  moderate_pixel_percentage?: number;
  weak_pixel_count?: number;
  weak_pixel_percentage?: number;
  stress_pixel_count?: number;
  stress_pixel_percentage?: number;
  total_pixel_count?: number;
  [key: string]: any;
}

export interface GrowthAnalysisResponse {
  status?: string;
  district?: string;
  subdistrict?: string;
  village?: string;
  plots: GrowthPlotData[];
  pixel_summary?: GrowthPixelSummary;
}

export const fetchGrowthAnalysis1 = async (
  district: string,
  subdistrict?: string,
  village?: string
): Promise<GrowthAnalysisResponse> => {
  try {
    // Build URL with available parameters
    let url = `${BASE_URL}/analyze_Growth1?district=${encodeURIComponent(district)}`;
    if (subdistrict) {
      url += `&subdistrict=${encodeURIComponent(subdistrict)}`;
    }
    if (village) {
      url += `&village=${encodeURIComponent(village)}`;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json'
      },
      body: ''
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: GrowthAnalysisResponse = await response.json();
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to ${BASE_URL}/analyze_Growth1`);
    }
    throw error;
  }
};

// Fetch Water Uptake Analysis
export const fetchWaterUptakeAnalysis = async (
  district: string,
  subdistrict?: string,
  village?: string
): Promise<GrowthAnalysisResponse> => {
  try {
    let url = `${BASE_URL}/wateruptake?district=${encodeURIComponent(district)}`;
    if (subdistrict) {
      url += `&subdistrict=${encodeURIComponent(subdistrict)}`;
    }
    if (village) {
      url += `&village=${encodeURIComponent(village)}`;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json'
      },
      body: ''
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: GrowthAnalysisResponse = await response.json();
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to ${BASE_URL}/wateruptake`);
    }
    throw error;
  }
};

// Fetch Soil Moisture Analysis
export const fetchSoilMoistureAnalysis = async (
  district: string,
  subdistrict?: string,
  village?: string
): Promise<GrowthAnalysisResponse> => {
  try {
    let url = `${BASE_URL}/SoilMoisture?district=${encodeURIComponent(district)}`;
    if (subdistrict) {
      url += `&subdistrict=${encodeURIComponent(subdistrict)}`;
    }
    if (village) {
      url += `&village=${encodeURIComponent(village)}`;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json'
      },
      body: ''
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: GrowthAnalysisResponse = await response.json();
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to ${BASE_URL}/SoilMoisture`);
    }
    throw error;
  }
};

// Fetch Pest Detection Analysis
export const fetchPestDetectionAnalysis = async (
  district: string,
  subdistrict?: string,
  village?: string,
  coordinates?: number[][]
): Promise<GrowthAnalysisResponse> => {
  try {
    let url = `${BASE_URL}/pest-detection4?district=${encodeURIComponent(district)}`;
    if (subdistrict) {
      url += `&subdistrict=${encodeURIComponent(subdistrict)}`;
    }
    if (village) {
      url += `&village=${encodeURIComponent(village)}`;
    }
    
    // If coordinates are provided (drawn plot), add them to the request
    let body = '';
    if (coordinates && coordinates.length > 0) {
      body = JSON.stringify({ coordinates });
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: body
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: GrowthAnalysisResponse = await response.json();
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to ${BASE_URL}/pest-detection4`);
    }
    throw error;
  }
};

// Analysis response types
export interface PixelSummary {
  total_pixel_count: number;
  healthy_pixel_count: number;
  healthy_pixel_percentage: number;
  moderate_pixel_count: number;
  moderate_pixel_percentage: number;
  weak_pixel_count: number;
  weak_pixel_percentage: number;
  stress_pixel_count: number;
  stress_pixel_percentage: number;
  analysis_start_date: string;
  analysis_end_date: string;
  latest_image_date: string;
}

export interface AnalysisFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    file_name: string;
    taluka_name: string;
    taluka_number: string;
    plot_id: number;
    area_ha: number;
    start_date: string;
    end_date: string;
    tile_url: string | null;
    data_source: string;
    latest_image_date: string;
    last_updated: string;
  };
}

export interface AnalysisResponse {
  type: 'FeatureCollection';
  features: AnalysisFeature[];
  pixel_summary: PixelSummary;
}

// Fetch Growth analysis
export const fetchGrowthAnalysis = async (
  talukaName: string,
  plotNo: number | string
): Promise<AnalysisResponse> => {
  try {
    const url = `${BASE_URL}/analyze_Growth?taluka_name=${encodeURIComponent(talukaName)}&plot_no=${plotNo}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json'
      },
      body: ''
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: AnalysisResponse = await response.json();
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to Growth analysis API`);
    }
    throw error;
  }
};

// Fetch Water Uptake analysis
export interface WaterUptakePixelSummary {
  total_pixel_count: number;
  deficient_pixel_count: number;
  deficient_pixel_percentage: number;
  less_pixel_count: number;
  less_pixel_percentage: number;
  adequate_pixel_count: number;
  adequate_pixel_percentage: number;
  excellent_pixel_count: number;
  excellent_pixel_percentage: number;
  excess_pixel_count: number;
  excess_pixel_percentage: number;
  shallow_water_pixel_count: number;
  shallow_water_pixel_percentage: number;
  analysis_start_date: string;
  analysis_end_date: string;
  latest_image_date: string;
}

export interface WaterUptakeResponse {
  type: 'FeatureCollection';
  features: AnalysisFeature[];
  pixel_summary: WaterUptakePixelSummary;
}

export const fetchWaterUptake = async (
  talukaName: string,
  plotNo: number | string
): Promise<WaterUptakeResponse> => {
  try {
    const url = `${BASE_URL}/wateruptake?taluka_name=${encodeURIComponent(talukaName)}&plot_no=${plotNo}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json'
      },
      body: ''
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: WaterUptakeResponse = await response.json();
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to Water Uptake API`);
    }
    throw error;
  }
};

// Fetch Soil Moisture analysis
export interface SoilMoisturePixelSummary {
  total_pixel_count: number;
  very_dry_pixel_count: number;
  very_dry_pixel_percentage: number;
  dry_pixel_count: number;
  dry_pixel_percentage: number;
  optimal_pixel_count: number;
  optimal_pixel_percentage: number;
  wet_pixel_count: number;
  wet_pixel_percentage: number;
  very_wet_pixel_count: number;
  very_wet_pixel_percentage: number;
  analysis_start_date: string;
  analysis_end_date: string;
  latest_image_date: string;
}

export interface SoilMoistureResponse {
  type: 'FeatureCollection';
  features: AnalysisFeature[];
  pixel_summary: SoilMoisturePixelSummary;
}

export const fetchSoilMoisture = async (
  talukaName: string,
  plotNo: number | string
): Promise<SoilMoistureResponse> => {
  try {
    const url = `${BASE_URL}/SoilMoisture?taluka_name=${encodeURIComponent(talukaName)}&plot_no=${plotNo}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json'
      },
      body: ''
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: SoilMoistureResponse = await response.json();
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to Soil Moisture API`);
    }
    throw error;
  }
};

// Fetch Pest Detection analysis
export interface PestDetectionPixelSummary {
  total_pixel_count: number;
  fungi_pixel_count: number;
  fungi_pixel_percentage: number;
  sucking_pixel_count: number;
  sucking_pixel_percentage: number;
  wilt_pixel_count: number;
  wilt_pixel_percentage: number;
  soilborn_pixel_count: number;
  soilborn_pixel_percentage: number;
  baseline_pixel_count: number;
  baseline_pixel_percentage: number;
  analysis_start_date: string;
  analysis_end_date: string;
  latest_image_date: string;
}

export interface PestDetectionResponse {
  type: 'FeatureCollection';
  features: AnalysisFeature[];
  pixel_summary: PestDetectionPixelSummary;
}

export const fetchPestDetection = async (
  talukaName: string,
  plotNo: number | string
): Promise<PestDetectionResponse> => {
  try {
    const url = `${BASE_URL}/pest-detection?taluka_name=${encodeURIComponent(talukaName)}&plot_no=${plotNo}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json'
      },
      body: ''
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: PestDetectionResponse = await response.json();
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to Pest Detection API`);
    }
    throw error;
  }
};

// Fetch taluka plot IDs using load-taluka endpoint
export interface LoadTalukaPlot {
  plot_id: string;
  geom_type?: string;
  coords?: number[][]; // [lng, lat] coordinates array
  [key: string]: any; // Allow additional properties
}

export interface LoadTalukaResponse {
  status: string;
  taluka: string;
  total_plots_loaded: number;
  plot_ids?: string[]; // For format with array of plot ID strings
  plots?: LoadTalukaPlot[]; // For format with array of plot objects with coordinates
}

export const loadTalukaPlots = async (talukaName: string): Promise<LoadTalukaResponse> => {
  try {
    const url = `${BASE_URL}/load-taluka?taluka_name=${encodeURIComponent(talukaName)}`;
    console.log('Loading taluka plots from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    // Try to parse the response, handling potential large response issues
    let data: any;
    try {
      const responseText = await response.text();
      console.log('Response text length:', responseText.length);
      console.log('Response text preview (first 500 chars):', responseText.substring(0, 500));
      
      // Check if response is too large or empty
      if (!responseText || responseText.length === 0) {
        throw new Error('Empty response from server');
      }
      
      // Parse JSON from text
      data = JSON.parse(responseText);
    } catch (parseError) {
      if (parseError instanceof SyntaxError) {
        console.error('JSON parse error:', parseError);
        const responseText = await response.text().catch(() => 'Unable to read response');
        console.error('Response text:', responseText.substring(0, 1000));
        throw new Error(`Failed to parse JSON response: ${parseError.message}`);
      } else if (parseError instanceof Error && parseError.message.includes('Invalid string length')) {
        throw new Error('Response is too large to parse. Please contact support.');
      }
      throw parseError;
    }
    
    // Log the full response for debugging
    console.log('loadTalukaPlots full response:', JSON.stringify(data, null, 2));
    console.log('Response keys:', Object.keys(data));
    
    if (data.status === 'success') {
      // Handle two possible response formats:
      // 1. Format with plot_ids array: { plot_ids: ["1", "2", ...] }
      // 2. Format with plots array: { plots: [{ plot_id: "1" }, { plot_id: "2" }, ...] }
      
      let plotIds: string[] = [];
      
      if (data.plot_ids && Array.isArray(data.plot_ids)) {
        // Format 1: plot_ids is an array of strings
        plotIds = data.plot_ids;
        console.log('Using plot_ids format, count:', plotIds.length);
      } else if (data.plots && Array.isArray(data.plots)) {
        // Format 2: plots is an array of objects with plot_id
        plotIds = data.plots.map((plot: LoadTalukaPlot) => String(plot.plot_id));
        console.log('Using plots format, count:', plotIds.length);
      } else {
        console.error('Neither plot_ids nor plots found in response. Available keys:', Object.keys(data));
        console.error('Full response:', JSON.stringify(data, null, 2));
        throw new Error('Invalid response format: neither plot_ids array nor plots array found');
      }
      
      // Return normalized response with plot_ids array and plots array if available
      return {
        status: data.status,
        taluka: data.taluka,
        total_plots_loaded: data.total_plots_loaded || 0,
        plot_ids: plotIds,
        plots: data.plots || undefined // Include plots array if available (with coordinates)
      };
    } else {
      throw new Error(`Invalid response format: expected status "success", got "${data.status}"`);
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to ${BASE_URL}/load-taluka`);
    }
    throw error;
  }
};

// Fetch all plots for a taluka
export interface TalukaPlotsResponse {
  status: string;
  file: string;
  total_features: number;
  geojson: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      geometry: {
        type: 'Polygon';
        coordinates: number[][][];
      };
      properties: {
        area_ha: string;
        plot_id: string;
        'system:index'?: string;
      };
    }>;
  };
}

export const fetchTalukaPlots = async (talukaName: string): Promise<Array<{id: string; area_ha: string; boundary: Coordinate[]}>> => {
  try {
    const url = isDevelopment
      ? `/api/get-geojson/${encodeURIComponent(talukaName)}`
      : `https://web-production-72a7.up.railway.app/get-geojson/${encodeURIComponent(talukaName)}`;
    console.log('Fetching taluka plots from:', url);
    
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('API Error Response:', response.status, response.statusText, errorText);
      throw new Error(`API Error: ${response.status} ${response.statusText}. URL: ${url}`);
    }

    const apiResponse: TalukaPlotsResponse = await response.json();
    const data = apiResponse.geojson;
    
    // Validate response structure
    if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      throw new Error('Invalid response format: expected GeoJSON FeatureCollection');
    }

    // Transform GeoJSON features to Plot format
    const plots = data.features.map((feature) => {
      // Extract the outer ring coordinates (first array in coordinates)
      const outerRing = feature.geometry.coordinates[0] || [];
      
      // Ensure plot_id is converted to string
      const plotId = String(feature.properties.plot_id);
      
      return {
        id: plotId,
        area_ha: feature.properties.area_ha,
        boundary: outerRing as Coordinate[] // [lng, lat] coordinates
      };
    });

    console.log('Loaded', plots.length, 'plots for taluka:', talukaName);
    return plots;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      const url = isDevelopment
        ? `/api/get-geojson/${talukaName}`
        : `https://web-production-72a7.up.railway.app/get-geojson/${talukaName}`;
      throw new Error(`Network error: Unable to connect to ${url}. Check CORS settings and network connectivity.`);
    }
    throw error;
  }
};

// NDWI Detection Response Interface
// NDWI Detection Response - same format as GrowthAnalysisResponse
export interface NDWIDetectionResponse {
  status?: string;
  district?: string;
  subdistrict?: string;
  village?: string;
  plots: Array<{
    type?: string; // "Feature" for GeoJSON format
    geometry?: {
      type: string;
      coordinates: number[][][]; // [[[lng, lat], [lng, lat], ...]] for Polygon
    };
    properties?: {
      plot_id: string;
      plot_name?: string;
      tile_url: string;
      water_pixel_percentage: number;
      area_acres?: number;
    };
    // Direct format (for backward compatibility)
    plot_id?: string;
    plot_name?: string;
    coordinates?: number[][]; // [[lng, lat], [lng, lat], ...]
    tile_url?: string;
    water_pixel_percentage?: number;
  }>;
  pixel_summary?: {
    water_pixel_percentage?: number;
  };
}

// Fetch NDWI Detection data - same signature as other analysis functions
export const fetchNDWIDetection = async (
  district: string,
  subdistrict?: string,
  village?: string
): Promise<NDWIDetectionResponse> => {
  try {
    // Validate required parameter
    if (!district || district.trim() === '') {
      throw new Error('District parameter is required for NDWI Detection');
    }
    
    // Build URL with available parameters (same as other analysis endpoints)
    let url = `${BASE_URL}/NDWIDetection1?district=${encodeURIComponent(district.trim())}`;
    if (subdistrict && subdistrict.trim() !== '') {
      url += `&subdistrict=${encodeURIComponent(subdistrict.trim())}`;
    }
    if (village && village.trim() !== '') {
      url += `&village=${encodeURIComponent(village.trim())}`;
    }
    
    console.log('Fetching NDWI detection from:', url);
    console.log('NDWI Detection Parameters:', { district, subdistrict, village });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json'
      },
      body: ''
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('NDWI API Error Response:', response.status, response.statusText);
      console.error('NDWI API Error Details:', errorText);
      console.error('NDWI API Request URL:', url);
      console.error('NDWI API Request Parameters:', { district, subdistrict, village });
      
      // Try to parse error as JSON for more details
      let errorMessage = `NDWI API Error: ${response.status} ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.detail || errorJson.message || errorJson.error) {
          errorMessage += ` - ${errorJson.detail || errorJson.message || errorJson.error}`;
        }
      } catch (e) {
        // If not JSON, use the text as is
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
      }
      
      throw new Error(errorMessage);
    }

    const data: NDWIDetectionResponse = await response.json();
    console.log('NDWI Detection Response:', data);
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to ${BASE_URL}/NDWIDetection1`);
    }
    throw error;
  }
};

// Forest Canopy Height Age Structure Response
export interface ForestCanopyResponse {
  plot_name: string;
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  canopy_summary: {
    mean_height_m: number;
    min_height_m: number;
    max_height_m: number;
    p99_height_m: number;
  };
  age_classes: {
    young: {
      tile_url: string;
      area_hectares: number;
    };
    mid_age: {
      tile_url: string;
      area_hectares: number;
    };
    mature: {
      tile_url: string;
      area_hectares: number;
    };
    old_age: {
      tile_url: string;
      area_hectares: number;
    };
  };
  last_updated?: string;
}

// Processed Forest Response
export interface ProcessedForestResponse {
  plot_name: string;
  age_classes: {
    young: { tile_url: string; area_hectares: number };
    mid_age: { tile_url: string; area_hectares: number };
    mature: { tile_url: string; area_hectares: number };
    old_age: { tile_url: string; area_hectares: number };
  };
  district?: string;
}

// Fetch Forest Canopy Height Age Structure
export const fetchForestCanopy = async (
  district: string
): Promise<ProcessedForestResponse> => {
  try {
    const url = `${BASE_URL}/CanopyHeightAgeStructureclasswise?district=${encodeURIComponent(district)}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json'
      },
      body: ''
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: ForestCanopyResponse = await response.json();
    
    if (!data.age_classes) {
      throw new Error('No age_classes found in response');
    }
    
    return {
      plot_name: data.plot_name,
      age_classes: data.age_classes,
      district: district
    };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to ${BASE_URL}/CanopyHeightAgeStructureclasswise`);
    }
    throw error;
  }
};

// NDVI Sugarcane Detection Response
export interface NDVISugarcaneResponse {
  plot_id: string;
  month: string;
  ndvi_range: number[];
  area_ha: number;
  tile_url: string;
  export: string;
  last_updated: string;
}

// Processed NDVI Sugarcane Response
export interface ProcessedNDVISugarcaneResponse {
  tile_url: string;
  area_ha: number;
  plot_id: string;
  district?: string;
  subdistrict?: string;
}

// Fetch NDVI Sugarcane Detection
export const fetchNDVISugarcaneDetection = async (
  district: string
): Promise<ProcessedNDVISugarcaneResponse> => {
  try {
    const url = `${BASE_URL}/ndvi-sugarcane-detection?district=${encodeURIComponent(district)}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json'
      },
      body: ''
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: NDVISugarcaneResponse = await response.json();
    
    if (!data.tile_url || data.area_ha === undefined || !data.plot_id) {
      throw new Error('Missing required fields in response: tile_url, area_ha, or plot_id');
    }
    
    return {
      tile_url: data.tile_url,
      area_ha: data.area_ha,
      plot_id: data.plot_id,
      district: district
    };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to ${BASE_URL}/ndvi-sugarcane-detection`);
    }
    throw error;
  }
};

// Land Surface Temperature Response
export interface LandSurfaceTemperatureResponse {
  type: string;
  features: Array<{
    type: string;
    geometry: {
      type: string;
      coordinates: number[][][];
    };
    properties: {
      plot_id?: string;
      tile_url: string;
      data_source?: string;
      start_date?: string;
      end_date?: string;
      last_updated?: string;
    };
  }>;
}

// Processed Land Surface Temperature Response
export interface ProcessedLandSurfaceTemperatureResponse {
  tile_url: string;
  district?: string;
  start_date?: string;
  end_date?: string;
}

// Fetch Land Surface Temperature
export const fetchLandSurfaceTemperature = async (
  district: string,
  startDate: string = '2025-11-20',
  endDate: string = '2025-12-23'
): Promise<ProcessedLandSurfaceTemperatureResponse> => {
  try {
    const url = `${BASE_URL}/land-surface-temperature?district=${encodeURIComponent(district)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json'
      },
      body: ''
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: LandSurfaceTemperatureResponse = await response.json();
    
    // Extract tile_url from features array
    const tileUrl = data.features?.[0]?.properties?.tile_url;
    
    if (!tileUrl) {
      throw new Error('No tile_url found in response');
    }
    
    return {
      tile_url: tileUrl,
      district: district,
      start_date: startDate,
      end_date: endDate
    };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to ${BASE_URL}/land-surface-temperature`);
    }
    throw error;
  }
};

// Methane Response
export interface MethaneResponse {
  type: string;
  features: Array<{
    type: string;
    geometry: {
      type: string;
      coordinates: number[][][];
    };
    properties: {
      plot_id?: string;
      tile_url: string;
      data_source?: string;
      start_date?: string;
      end_date?: string;
      last_updated?: string;
    };
  }>;
}

// Processed Methane Response
export interface ProcessedMethaneResponse {
  tile_url: string;
  district?: string;
  subdistrict?: string;
  start_date?: string;
  end_date?: string;
}

// Fetch Methane Concentration
export const fetchMethane = async (
  district: string,
  subdistrict?: string,
  startDate: string = '2025-11-20',
  endDate: string = '2025-12-23'
): Promise<ProcessedMethaneResponse> => {
  try {
    let url = `${BASE_URL}/methane-concentration?district=${encodeURIComponent(district)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
    if (subdistrict) {
      url += `&subdistrict=${encodeURIComponent(subdistrict)}`;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json'
      },
      body: ''
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: MethaneResponse = await response.json();
    
    // Extract tile_url from features array
    const tileUrl = data.features?.[0]?.properties?.tile_url;
    
    if (!tileUrl) {
      throw new Error('No tile_url found in response');
    }
    
    return {
      tile_url: tileUrl,
      district: district,
      subdistrict: subdistrict,
      start_date: startDate,
      end_date: endDate
    };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to connect to ${BASE_URL}/methane-concentration`);
    }
    throw error;
  }
};
