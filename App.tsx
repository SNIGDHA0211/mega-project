import React, { useState, useEffect } from 'react';
import PlotsMap from './components/PlotsMap';
import LegendCircles, { AnalysisType } from './components/LegendCircles';
import { LoginPage } from './components/LoginPage';
import { 
  fetchDistricts, 
  fetchSubdistricts, 
  fetchVillages, 
  fetchGrowthAnalysis1,
  fetchWaterUptakeAnalysis,
  fetchSoilMoistureAnalysis,
  fetchPestDetectionAnalysis,
  fetchNDWIDetection,
  fetchNDVISugarcaneDetection,
  fetchLandSurfaceTemperature,
  fetchMethane,
  fetchForestCanopy,
  fetchET,
  fetchWeather,
  fetchPestStoredSeries,
  fetchWeatherDaily,
  GrowthAnalysisResponse,
  NDWIDetectionResponse,
  ETResponse,
  WeatherResponse,
  WeatherDailyResponse,
  PestHierarchyResponse,
  PestHierarchyChild,
  PestStoredResponse,
  PestStoredItem
} from './services/analysisService';
import { Coordinate } from './types';
import { Loader2, AlertCircle, Layers, Home, LogOut, Eye, EyeOff, Sprout, Droplets, Droplet, Bug, Waves, Trees } from 'lucide-react';
import BlurText from './components/BlurText';
import L from 'leaflet';

const App: React.FC = () => {
  // Authentication state - load from localStorage on mount
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedAuth = localStorage.getItem('isAuthenticated');
      return savedAuth === 'true';
    }
    return false;
  });
  const [currentUser, setCurrentUser] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('currentUser') || '';
    }
    return '';
  });

  // State for districts
  const [districts, setDistricts] = useState<Array<{district: string; geometry?: any}>>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedDistrictData, setSelectedDistrictData] = useState<{district: string; geometry?: any} | null>(null);
  
  // State for subdistricts
  const [subdistricts, setSubdistricts] = useState<Array<{subdistrict: string; geometry?: any}>>([]);
  const [selectedSubdistrict, setSelectedSubdistrict] = useState<string>('');
  
  // State for villages
  const [villages, setVillages] = useState<Array<{village: string; geom_type?: string; coordinates?: any; geometry?: any}>>([]);
  const [selectedVillage, setSelectedVillage] = useState<string>('');
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [availablePlots, setAvailablePlots] = useState<string[]>([]);
  const [totalPlotsCount, setTotalPlotsCount] = useState<number>(0);

  // State for analysis
  const [activeTab, setActiveTab] = useState<AnalysisType | null>(null); // Start with no tab selected - data only loads when tab is clicked
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // State for all plots in selected taluka
  const [allPlots, setAllPlots] = useState<Array<{id: string; area_ha: string; boundary: Coordinate[]}>>([]);

  // State for plot data (for selected plot analysis)
  const [plotBoundary, setPlotBoundary] = useState<Coordinate[]>([]);
  const [areaHa, setAreaHa] = useState<number | null>(null);
  const [tileUrl, setTileUrl] = useState<string | null>(null);
  const [plotBounds, setPlotBounds] = useState<L.LatLngBounds | null>(null);

  // State for all plots tile URLs (plotId -> tileUrl mapping)
  const [allPlotsTileUrls, setAllPlotsTileUrls] = useState<Record<string, string>>({});
  const [showTileLayers, setShowTileLayers] = useState<boolean>(true);

  // State for NDWI Detection
  const [ndwiData, setNdwiData] = useState<NDWIDetectionResponse | null>(null);
  const [ndwiLoading, setNdwiLoading] = useState<boolean>(false);
  const [waterSources, setWaterSources] = useState<Array<{
    id: string;
    coordinates: Coordinate[];
    tile_url: string;
    water_pixel_percentage: number;
  }>>([]);
  const [selectedWaterSource, setSelectedWaterSource] = useState<string | null>(null);
  const [waterAreaHectares, setWaterAreaHectares] = useState<number | null>(null);

  // State for crops
  const [selectedCrop, setSelectedCrop] = useState<string>('');
  const [cropTileUrl, setCropTileUrl] = useState<string | null>(null);
  const [cropAreaHa, setCropAreaHa] = useState<number | null>(null);
  
  // State for Land Surface Temperature
  const [lstTileUrl, setLstTileUrl] = useState<string | null>(null);
  const [lstLoading, setLstLoading] = useState<boolean>(false);
  
  // State for Methane
  const [methaneTileUrl, setMethaneTileUrl] = useState<string | null>(null);
  const [methaneLoading, setMethaneLoading] = useState<boolean>(false);
  const [methaneEnabled, setMethaneEnabled] = useState<boolean>(false);
  
  // State for GeoJSON plots from palus1.geojson
  const [geojsonPlots, setGeojsonPlots] = useState<Array<{id: string; field_id?: string; area_ha: string; boundary: Coordinate[]}>>([]);
  const [geojsonLoading, setGeojsonLoading] = useState<boolean>(false);
  
  // State for ET and Weather data
  const [etData, setEtData] = useState<ETResponse | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherResponse | null>(null);
  const [etWeatherLoading, setEtWeatherLoading] = useState<boolean>(false);

  // State for Daily Weather (district/subdistrict/village)
  const [weatherDailyData, setWeatherDailyData] = useState<WeatherDailyResponse | null>(null);
  const [weatherDailyLoading, setWeatherDailyLoading] = useState<boolean>(false);
  const [weatherDailyError, setWeatherDailyError] = useState<string | null>(null);
  const [weatherChartHoverDay, setWeatherChartHoverDay] = useState<number | null>(null);
  const [showWeatherDaily, setShowWeatherDaily] = useState<boolean>(true);

  // State for Pest stored time series (year_month tabs)
  const [pestStoredSeries, setPestStoredSeries] = useState<PestStoredResponse | null>(null);
  const [pestStoredLoading, setPestStoredLoading] = useState<boolean>(false);
  const [pestStoredError, setPestStoredError] = useState<string | null>(null);
  const [selectedPestYearMonth, setSelectedPestYearMonth] = useState<string | null>(null);

  // State for total area (district/subdistrict/village)
  const [totalAreaHectares, setTotalAreaHectares] = useState<number | null>(null);
  const [totalAreaLoading, setTotalAreaLoading] = useState<boolean>(false);
  
  // State for selected plot area (from GeoJSON)
  const [selectedPlotArea, setSelectedPlotArea] = useState<number | null>(null);

  // State for pixel summaries (single plot)
  const [growthData, setGrowthData] = useState<any>(null);
  const [waterData, setWaterData] = useState<any>(null);
  const [soilData, setSoilData] = useState<any>(null);
  const [pestData, setPestData] = useState<any>(null);

  // State for Forest
  const [forestData, setForestData] = useState<{
    young: { tile_url: string; area_hectares: number };
    mid_age: { tile_url: string; area_hectares: number };
    mature: { tile_url: string; area_hectares: number };
    old_age: { tile_url: string; area_hectares: number };
  } | null>(null);
  const [selectedForestAgeClass, setSelectedForestAgeClass] = useState<string | null>(null);
  const [forestTileUrl, setForestTileUrl] = useState<string | null>(null);
  const [forestAreaHa, setForestAreaHa] = useState<number | null>(null);

  // State for pest hierarchy (classwise endpoint): legend circles + children + tile on map
  const [pestHierarchy, setPestHierarchy] = useState<PestHierarchyResponse | null>(null);
  const [pestTileUrl, setPestTileUrl] = useState<string | null>(null);
  const [selectedPestCategory, setSelectedPestCategory] = useState<string | null>(null);
  const [showPestChildren, setShowPestChildren] = useState<boolean>(false);

  // State for all plots analysis data
  const [allPlotsAnalysisData, setAllPlotsAnalysisData] = useState<{
    growth: any;
    water: any;
    soil: any;
    pest: any;
    waterSource: any;
  } | null>(null);

  // State for sidebar visibility
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(true);

  // State for background images
  const [currentBgImageIndex, setCurrentBgImageIndex] = useState<number>(0);
  const backgroundImages = [
    '/images/Grapes.webp',
    '/images/kapus-kapas_cover_image.png',
    '/images/onion.jpg',
    '/images/weeds.jpg'
  ];

  // Fetch districts on mount
  useEffect(() => {
    const loadDistricts = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchDistricts();
        if (Array.isArray(data)) {
          setDistricts(data);
        } else {
          console.warn('Unexpected districts response format:', data);
          setDistricts([]);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error('Error loading districts:', err);
        setError(`Failed to load districts: ${errorMessage}`);
        setDistricts([]); // Set empty array on error to prevent crashes
      } finally {
        setLoading(false);
      }
    };
    loadDistricts();
  }, []);

  // Cycle background images every 1 second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBgImageIndex((prev) => (prev + 1) % backgroundImages.length);
    }, 1000);

    return () => clearInterval(interval);
  }, [backgroundImages.length]);

  // Fetch subdistricts when district is selected
  useEffect(() => {
    if (selectedDistrict) {
      const loadSubdistricts = async () => {
        try {
          setLoading(true);
          setError(null);
          const data = await fetchSubdistricts(selectedDistrict);
          if (Array.isArray(data)) {
            setSubdistricts(data);
          } else {
            console.warn('Unexpected subdistricts response format:', data);
            setSubdistricts([]);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          console.error('Error loading subdistricts:', err);
          setError(`Failed to load subdistricts: ${errorMessage}`);
          setSubdistricts([]);
        } finally {
          setLoading(false);
        }
      };
      loadSubdistricts();
    } else {
      setSubdistricts([]);
      setSelectedSubdistrict('');
      setVillages([]);
      setSelectedVillage('');
    }
  }, [selectedDistrict]);

  // Fetch villages when subdistrict is selected
  useEffect(() => {
    if (selectedSubdistrict) {
      const loadVillages = async () => {
        try {
          setLoading(true);
          setError(null);
          
          // If subdistrict is "Palus", load villages from GeoJSON file
          if (selectedSubdistrict === 'Palus') {
            console.log('Loading villages from palus1.geojson for subdistrict: Palus');
            const response = await fetch('/palus1.geojson');
            if (!response.ok) {
              throw new Error('Failed to load GeoJSON file');
            }
            
            // Read response as text first (handles large files better)
            const responseText = await response.text();
            if (!responseText || responseText.length === 0) {
              throw new Error('Empty response from GeoJSON file');
            }
            
            // Parse JSON from text
            let geojsonData: any;
            try {
              geojsonData = JSON.parse(responseText.trim());
            } catch (parseError) {
              console.error('JSON parse error:', parseError);
              throw new Error(`Failed to parse GeoJSON: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
            }
            
            // Validate structure
            if (!geojsonData || !geojsonData.features || !Array.isArray(geojsonData.features)) {
              throw new Error('Invalid GeoJSON format: missing features array');
            }
            
            // Extract unique village names from features
            const villageNamesSet = new Set<string>();
            geojsonData.features.forEach((feature: any) => {
              if (feature.properties && feature.properties.village_name) {
                villageNamesSet.add(feature.properties.village_name);
              }
            });
            
            // Convert to array of village objects (matching the expected format)
            const villagesFromGeoJSON = Array.from(villageNamesSet)
              .sort()
              .map(villageName => ({
                village: villageName
              }));
            
            console.log(`✅ Loaded ${villagesFromGeoJSON.length} unique villages from GeoJSON file`);
            setVillages(villagesFromGeoJSON);
          } else {
            // For other subdistricts, use API
            const data = await fetchVillages(selectedSubdistrict);
            if (Array.isArray(data)) {
              setVillages(data);
            } else {
              console.warn('Unexpected villages response format:', data);
              setVillages([]);
            }
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          console.error('Error loading villages:', err);
          setError(`Failed to load villages: ${errorMessage}`);
          setVillages([]);
        } finally {
          setLoading(false);
        }
      };
      loadVillages();
    } else {
      setVillages([]);
      setSelectedVillage('');
    }
  }, [selectedSubdistrict]);

  // Handle district selection and display coordinates on map
  useEffect(() => {
    if (selectedDistrict) {
      // Find the selected district data
      const districtData = districts.find(d => d.district === selectedDistrict);
      setSelectedDistrictData(districtData || null);
      
      // Extract coordinates from geometry and display on map
      if (districtData?.geometry) {
        try {
          let coordinates: Coordinate[] = [];
          
          // Handle different geometry formats
          if (districtData.geometry.type === 'Polygon' || districtData.geometry.type === 'MultiPolygon') {
            // Extract coordinates from GeoJSON Polygon/MultiPolygon
            const coords = districtData.geometry.coordinates;
            
            if (districtData.geometry.type === 'Polygon') {
              // Polygon: coordinates is an array of rings, first ring is outer boundary
              const outerRing = coords[0] || [];
              coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            } else if (districtData.geometry.type === 'MultiPolygon') {
              // MultiPolygon: coordinates is an array of polygons, take first polygon's outer ring
              const firstPolygon = coords[0] || [];
              const outerRing = firstPolygon[0] || [];
              coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            }
          } else if (Array.isArray(districtData.geometry)) {
            // Direct coordinate array
            coordinates = districtData.geometry.map((coord: number[]) => 
              Array.isArray(coord) && coord.length >= 2 
                ? [coord[0], coord[1]] as Coordinate 
                : null
            ).filter((c: Coordinate | null): c is Coordinate => c !== null);
          } else if (districtData.geometry.coordinates) {
            // Nested coordinates structure
            const coords = districtData.geometry.coordinates;
            if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
              // Nested array: extract outer ring
              const outerRing = coords[0] || [];
              coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            } else {
              // Flat array
              coordinates = coords.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            }
          }
          
          // Create a plot from district boundary for map display
          if (coordinates.length >= 3) {
            const districtPlot = {
              id: selectedDistrict,
              area_ha: '0', // Area not provided
              boundary: coordinates
            };
            setAllPlots([districtPlot]);
            
            // Calculate bounds for the district
            if (coordinates.length > 0) {
              const bounds = L.latLngBounds([]);
              coordinates.forEach((coord: Coordinate) => {
                bounds.extend([coord[1], coord[0]]); // [lat, lng]
              });
              if (bounds.isValid()) {
                setPlotBounds(bounds);
              }
            }
            
            console.log(`✅ Displaying district boundary for: ${selectedDistrict}`);
          } else {
            console.warn(`District ${selectedDistrict} has insufficient coordinates:`, coordinates.length);
            setAllPlots([]);
          }
        } catch (err) {
          console.error('Error processing district geometry:', err);
          setAllPlots([]);
        }
      } else {
        // No geometry available
        setAllPlots([]);
      }
      
      // Clear other data
      setSelectedPlotId(null);
      setPlotBoundary([]);
      setAreaHa(null);
      setTileUrl(null);
      setGrowthData(null);
      setWaterData(null);
      setSoilData(null);
      setPestData(null);
      setAllPlotsTileUrls({});
      setAvailablePlots([]);
      setTotalPlotsCount(0);
    } else {
      setSelectedDistrictData(null);
      setAllPlots([]);
      setAvailablePlots([]);
      setTotalPlotsCount(0);
      setPlotBounds(null);
    }
  }, [selectedDistrict, districts]);

  // Handle subdistrict selection and display coordinates on map
  useEffect(() => {
    if (selectedSubdistrict && subdistricts.length > 0) {
      // Find the selected subdistrict data
      const subdistrictData = subdistricts.find(s => s.subdistrict === selectedSubdistrict);
      
      if (subdistrictData?.geometry) {
        try {
          let coordinates: Coordinate[] = [];
          
          // Handle different geometry formats
          if (subdistrictData.geometry.type === 'Polygon' || subdistrictData.geometry.type === 'MultiPolygon') {
            // Extract coordinates from GeoJSON Polygon/MultiPolygon
            const coords = subdistrictData.geometry.coordinates;
            
            if (subdistrictData.geometry.type === 'Polygon') {
              // Polygon: coordinates is an array of rings, first ring is outer boundary
              const outerRing = coords[0] || [];
              coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            } else if (subdistrictData.geometry.type === 'MultiPolygon') {
              // MultiPolygon: coordinates is an array of polygons, take first polygon's outer ring
              const firstPolygon = coords[0] || [];
              const outerRing = firstPolygon[0] || [];
              coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            }
          } else if (subdistrictData.geometry.coordinates) {
            // Nested coordinates structure
            const coords = subdistrictData.geometry.coordinates;
            if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
              // Nested array: extract outer ring
              const outerRing = coords[0] || [];
              coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            } else {
              // Flat array
              coordinates = coords.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            }
          }
          
          // Create a plot from subdistrict boundary for map display
          if (coordinates.length >= 3) {
            const subdistrictPlot = {
              id: selectedSubdistrict,
              area_ha: '0', // Area not provided
              boundary: coordinates
            };
            setAllPlots([subdistrictPlot]);
            
            // Calculate bounds for the subdistrict
            if (coordinates.length > 0) {
              const bounds = L.latLngBounds([]);
              coordinates.forEach((coord: Coordinate) => {
                bounds.extend([coord[1], coord[0]]); // [lat, lng]
              });
              if (bounds.isValid()) {
                setPlotBounds(bounds);
              }
            }
            
            console.log(`✅ Displaying subdistrict boundary for: ${selectedSubdistrict}`);
          } else {
            console.warn(`Subdistrict ${selectedSubdistrict} has insufficient coordinates:`, coordinates.length);
            setAllPlots([]);
          }
        } catch (err) {
          console.error('Error processing subdistrict geometry:', err);
          setAllPlots([]);
        }
      } else {
        // No geometry available
        setAllPlots([]);
      }
      
      // Clear other data
      setSelectedPlotId(null);
      setPlotBoundary([]);
      setAreaHa(null);
      setTileUrl(null);
      setGrowthData(null);
      setWaterData(null);
      setSoilData(null);
      setPestData(null);
      setAllPlotsTileUrls({});
      setAvailablePlots([]);
      setTotalPlotsCount(0);
    } else if (!selectedSubdistrict) {
      // If subdistrict is cleared, show district boundary again
      if (selectedDistrict) {
        const districtData = districts.find(d => d.district === selectedDistrict);
        if (districtData?.geometry) {
          try {
            let coordinates: Coordinate[] = [];
            
            if (districtData.geometry.type === 'Polygon' || districtData.geometry.type === 'MultiPolygon') {
              const coords = districtData.geometry.coordinates;
              
              if (districtData.geometry.type === 'Polygon') {
                const outerRing = coords[0] || [];
                coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
              } else if (districtData.geometry.type === 'MultiPolygon') {
                const firstPolygon = coords[0] || [];
                const outerRing = firstPolygon[0] || [];
                coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
              }
            } else if (districtData.geometry.coordinates) {
              const coords = districtData.geometry.coordinates;
              if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
                const outerRing = coords[0] || [];
                coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
              } else {
                coordinates = coords.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
              }
            }
            
            if (coordinates.length >= 3) {
              const districtPlot = {
                id: selectedDistrict,
                area_ha: '0',
                boundary: coordinates
              };
              setAllPlots([districtPlot]);
              
              if (coordinates.length > 0) {
                const bounds = L.latLngBounds([]);
                coordinates.forEach((coord: Coordinate) => {
                  bounds.extend([coord[1], coord[0]]);
                });
                if (bounds.isValid()) {
                  setPlotBounds(bounds);
                }
              }
            }
          } catch (err) {
            console.error('Error processing district geometry:', err);
          }
        }
      }
    }
  }, [selectedSubdistrict, subdistricts, selectedDistrict, districts]);

  // Handle village selection and display coordinates on map
  useEffect(() => {
    if (selectedVillage && villages.length > 0) {
      // Find the selected village data
      const villageData = villages.find(v => v.village === selectedVillage);
      
      if (villageData?.coordinates || villageData?.geometry) {
        try {
          let coordinates: Coordinate[] = [];
          
          // Handle new format: coordinates directly on village object with geom_type
          if (villageData.coordinates && villageData.geom_type) {
            const coords = villageData.coordinates;
            const geomType = villageData.geom_type.toUpperCase();
            
            if (geomType === 'POLYGON' || geomType === 'MULTIPOLYGON') {
              // Polygon format: coordinates is nested array [[[lng, lat], [lng, lat], ...]]
              if (Array.isArray(coords) && coords.length > 0) {
                if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
                  // Nested array: extract outer ring
                  const outerRing = coords[0] || [];
                  coordinates = outerRing.map((coord: number[]) => {
                    // Handle both [lng, lat] and [[lng, lat]] formats
                    if (Array.isArray(coord) && coord.length >= 2) {
                      return [coord[0], coord[1]] as Coordinate;
                    }
                    return null;
                  }).filter((c: Coordinate | null): c is Coordinate => c !== null);
                } else {
                  // Flat array of coordinates
                  coordinates = coords.map((coord: number[]) => {
                    if (Array.isArray(coord) && coord.length >= 2) {
                      return [coord[0], coord[1]] as Coordinate;
                    }
                    return null;
                  }).filter((c: Coordinate | null): c is Coordinate => c !== null);
                }
              }
            }
          }
          // Handle old format: geometry object (for backward compatibility)
          else if (villageData.geometry) {
            if (villageData.geometry.type === 'Polygon' || villageData.geometry.type === 'MultiPolygon') {
              const coords = villageData.geometry.coordinates;
              
              if (villageData.geometry.type === 'Polygon') {
                const outerRing = coords[0] || [];
                coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
              } else if (villageData.geometry.type === 'MultiPolygon') {
                const firstPolygon = coords[0] || [];
                const outerRing = firstPolygon[0] || [];
                coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
              }
            } else if (villageData.geometry.coordinates) {
              const coords = villageData.geometry.coordinates;
              if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
                const outerRing = coords[0] || [];
                coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
              } else {
                coordinates = coords.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
              }
            }
          }
          
          // Create a plot from village boundary for map display
          if (coordinates.length >= 3) {
            const villagePlot = {
              id: selectedVillage,
              area_ha: '0',
              boundary: coordinates
            };
            setAllPlots([villagePlot]);
            
            // Calculate bounds for the village
            if (coordinates.length > 0) {
              const bounds = L.latLngBounds([]);
              coordinates.forEach((coord: Coordinate) => {
                bounds.extend([coord[1], coord[0]]); // [lat, lng]
              });
              if (bounds.isValid()) {
                setPlotBounds(bounds);
              }
            }
            
            console.log(`✅ Displaying village boundary for: ${selectedVillage}`);
          } else {
            console.warn(`Village ${selectedVillage} has insufficient coordinates:`, coordinates.length);
            setAllPlots([]);
          }
        } catch (err) {
          console.error('Error processing village geometry:', err);
          setAllPlots([]);
        }
    } else {
      setAllPlots([]);
    }

      // Clear other data
      setSelectedPlotId(null);
      setPlotBoundary([]);
      setAreaHa(null);
      setTileUrl(null);
      setGrowthData(null);
      setWaterData(null);
      setSoilData(null);
      setPestData(null);
      setAllPlotsTileUrls({});
      setAvailablePlots([]);
      setTotalPlotsCount(0);
      // Clear GeoJSON plots when village changes
      setGeojsonPlots([]);
    } else if (!selectedVillage) {
      // Clear GeoJSON plots when village is cleared
      setGeojsonPlots([]);
      // If village is cleared, show subdistrict boundary again
      if (selectedSubdistrict) {
        const subdistrictData = subdistricts.find(s => s.subdistrict === selectedSubdistrict);
        if (subdistrictData?.geometry) {
          try {
            let coordinates: Coordinate[] = [];
            
            if (subdistrictData.geometry.type === 'Polygon' || subdistrictData.geometry.type === 'MultiPolygon') {
              const coords = subdistrictData.geometry.coordinates;
              
              if (subdistrictData.geometry.type === 'Polygon') {
                const outerRing = coords[0] || [];
                coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
              } else if (subdistrictData.geometry.type === 'MultiPolygon') {
                const firstPolygon = coords[0] || [];
                const outerRing = firstPolygon[0] || [];
                coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
              }
            } else if (subdistrictData.geometry.coordinates) {
              const coords = subdistrictData.geometry.coordinates;
              if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
                const outerRing = coords[0] || [];
                coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
              } else {
                coordinates = coords.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
              }
            }
            
            if (coordinates.length >= 3) {
              const subdistrictPlot = {
                id: selectedSubdistrict,
                area_ha: '0',
                boundary: coordinates
              };
              setAllPlots([subdistrictPlot]);
              
              if (coordinates.length > 0) {
                const bounds = L.latLngBounds([]);
                coordinates.forEach((coord: Coordinate) => {
                  bounds.extend([coord[1], coord[0]]);
                });
                if (bounds.isValid()) {
                  setPlotBounds(bounds);
                }
              }
            }
          } catch (err) {
            console.error('Error processing subdistrict geometry:', err);
          }
        }
      }
    }
  }, [selectedVillage, villages, selectedSubdistrict, subdistricts]);

  // Fetch total area when district/subdistrict/village changes
  useEffect(() => {
    if (selectedDistrict) {
      const fetchTotalArea = async () => {
        try {
          setTotalAreaLoading(true);
          setError(null);
          
          const response = await fetchGrowthAnalysis1(
            selectedDistrict,
            selectedSubdistrict || undefined,
            selectedVillage || undefined
          );
          
          // Log the full response to debug
          console.log('📊 Total Area API Response:', response);
          console.log('📊 Response keys:', Object.keys(response));
          console.log('📊 area_hectares:', response.area_hectares);
          console.log('📊 total_area_hectares:', (response as any).total_area_hectares);
          console.log('📊 area:', (response as any).area);
          console.log('📊 total_area:', (response as any).total_area);
          
          // Check for area_hectares in various possible locations
          let areaValue: number | null = null;
          
          // Check root level with different possible field names
          if (response.area_hectares !== undefined && response.area_hectares !== null) {
            areaValue = response.area_hectares;
            console.log('✅ Found area_hectares at root:', areaValue);
          } else if ((response as any).total_area_hectares !== undefined && (response as any).total_area_hectares !== null) {
            areaValue = (response as any).total_area_hectares;
            console.log('✅ Found total_area_hectares at root:', areaValue);
          } else if ((response as any).area !== undefined && (response as any).area !== null) {
            areaValue = (response as any).area;
            console.log('✅ Found area at root:', areaValue);
          } else if ((response as any).total_area !== undefined && (response as any).total_area !== null) {
            areaValue = (response as any).total_area;
            console.log('✅ Found total_area at root:', areaValue);
          }
          // Check in pixel_summary
          else if (response.pixel_summary && (response.pixel_summary as any).area_hectares !== undefined) {
            areaValue = (response.pixel_summary as any).area_hectares;
            console.log('✅ Found area_hectares in pixel_summary:', areaValue);
          }
          // If not in root, check if it's calculated from plots
          else if (response.plots && Array.isArray(response.plots) && response.plots.length > 0) {
            let totalArea = 0;
            response.plots.forEach((plot: any) => {
              // Check for area_acres and convert to hectares, or area_hectares directly
              if (plot.properties?.area_acres) {
                totalArea += plot.properties.area_acres / 2.47105; // Convert acres to hectares
              } else if (plot.area_acres) {
                totalArea += plot.area_acres / 2.47105;
              } else if (plot.properties?.area_hectares) {
                totalArea += plot.properties.area_hectares;
              } else if (plot.area_hectares) {
                totalArea += plot.area_hectares;
              }
            });
            if (totalArea > 0) {
              areaValue = totalArea;
              console.log('✅ Calculated area from plots:', areaValue);
            }
          }
          
          if (areaValue !== null && areaValue !== undefined && !isNaN(areaValue) && areaValue > 0) {
            setTotalAreaHectares(areaValue);
            console.log('✅ Setting total area to:', areaValue);
          } else {
            console.warn('⚠️ No valid area found in response');
            setTotalAreaHectares(null);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          console.error('❌ Error loading total area:', err);
          // Don't set error here as it might interfere with other operations
          setTotalAreaHectares(null);
        } finally {
          setTotalAreaLoading(false);
        }
      };

      fetchTotalArea();
    } else {
      setTotalAreaHectares(null);
      setSelectedPlotArea(null); // Clear plot area when location changes
    }
  }, [selectedDistrict, selectedSubdistrict, selectedVillage]);
  
  // Clear selected plot area when geojson plots are cleared or location changes
  useEffect(() => {
    if (geojsonPlots.length === 0) {
      setSelectedPlotArea(null);
    }
  }, [geojsonPlots]);

  // Fetch analysis data when tab is clicked OR when location (district/subdistrict/village) changes
  // Fetches data for the active tab (Growth, Water Uptake, Soil Moisture, or Pest)
  useEffect(() => {
    if (selectedDistrict && activeTab) {
    const loadAnalysisData = async () => {
      try {
        setLoading(true);
        setError(null);
        // Clear old data when location changes to prevent showing stale data
        setAllPlots([]);
        setAvailablePlots([]);
        setTotalPlotsCount(0);
        setAllPlotsTileUrls({});
        setWaterAreaHectares(null); // Clear water area when location changes
        if (activeTab !== 'pest') {
          setPestHierarchy(null);
          setPestTileUrl(null);
          setSelectedPestCategory(null);
          setShowPestChildren(false);
        }
        if (activeTab !== 'pest') {
          setPestHierarchy(null);
          setPestTileUrl(null);
          setSelectedPestCategory(null);
          setShowPestChildren(false);
        }

         // Fetch data based on active tab
           let response: GrowthAnalysisResponse | NDWIDetectionResponse;
         switch (activeTab) {
          case 'growth':
              response = await fetchGrowthAnalysis1(
                selectedDistrict, 
                selectedSubdistrict || undefined, 
                selectedVillage || undefined
              );
            break;
          case 'water':
              response = await fetchWaterUptakeAnalysis(
                selectedDistrict, 
                selectedSubdistrict || undefined, 
                selectedVillage || undefined
              );
            break;
          case 'soil':
              response = await fetchSoilMoistureAnalysis(
                selectedDistrict, 
                selectedSubdistrict || undefined, 
                selectedVillage || undefined
              );
            break;
          case 'pest':
              response = await fetchPestDetectionAnalysis(
                selectedDistrict, 
                selectedSubdistrict || undefined, 
                selectedVillage || undefined
              );
            break;
          case 'waterSource':
              response = await fetchNDWIDetection(
                selectedDistrict, 
                selectedSubdistrict || undefined, 
                selectedVillage || undefined
              );
            break;
          case 'forest':
              // Forest uses different API - fetch separately
              const forestResponse = await fetchForestCanopy(selectedDistrict);
              setForestData(forestResponse.age_classes);
              // Clear plots and tile URLs - forest uses different display method
              setAllPlots([]);
              setAvailablePlots([]);
              setTotalPlotsCount(0);
              setAllPlotsTileUrls({});
              setForestTileUrl(null);
              setForestAreaHa(null);
              setSelectedForestAgeClass(null);
              // Skip to end - forest doesn't use standard plot processing
              response = {} as any; // Placeholder
              setLoading(false);
              return;
          default:
            return;
        }

          // Skip processing for forest - it's handled separately via legend circles
          if (activeTab === 'forest') {
            setLoading(false);
            return;
          }

          console.log(`📦 Full API Response for ${activeTab}:`, JSON.stringify(response, null, 2));
          console.log('📦 Response keys:', Object.keys(response));
          console.log('📦 Response plots:', response.plots);
          console.log('📦 Response plots count:', response.plots?.length);
          
          // Handle different response formats
          let plotsArray: any[] = [];
          const responseAny = response as any;
          
          // Format 1: Direct plots array
          if (response.plots && Array.isArray(response.plots)) {
            plotsArray = response.plots;
          }
          // Format 2: Features array (GeoJSON format)
          else if (responseAny.features && Array.isArray(responseAny.features)) {
            plotsArray = responseAny.features;
          }
          // Format 3: Data object with plots
          else if (responseAny.data && Array.isArray(responseAny.data)) {
            plotsArray = responseAny.data;
          }
          // Format 4: Response is directly an array
          else if (Array.isArray(response)) {
            plotsArray = response;
          }
          
          console.log('📦 Processed plots array count:', plotsArray.length);
          if (plotsArray.length > 0) {
            console.log('📦 First plot/item structure:', JSON.stringify(plotsArray[0], null, 2));
            // Special logging for Water Source tab
            if (activeTab === 'waterSource') {
              console.log('🌊 Water Source - First plot tile_url:', plotsArray[0].properties?.tile_url || plotsArray[0].tile_url);
              console.log('🌊 Water Source - First plot plot_id:', plotsArray[0].properties?.plot_id || plotsArray[0].plot_id);
            }
          } else {
            console.error('❌ No plots array found in response!');
            console.error('❌ Response structure:', response);
            console.error('❌ Response type:', typeof response);
            console.error('❌ Response keys:', Object.keys(response || {}));
          }
          
          // Extract plots from response
          if (plotsArray.length > 0) {
            // Collect tile URLs first (before mapping)
            const tileUrlsMap: Record<string, string> = {};
            
            // First pass: Collect all tile URLs (even if coordinates are missing)
            plotsArray.forEach((plot, index) => {
              // Try multiple ways to get plot_id: plot_id, plot_name, or generate from index
              const plotId = plot.properties?.plot_id || plot.plot_id || 
                            plot.properties?.plot_name || plot.plot_name || 
                            `plot-${index}`;
              const tileUrl = plot.properties?.tile_url || plot.tile_url;
              
              // Enhanced logging for Water Source
              if (activeTab === 'waterSource' && index < 3) {
                console.log(`🌊 Water Source Plot ${index}:`, {
                  plotId,
                  tileUrl,
                  hasProperties: !!plot.properties,
                  propertiesKeys: plot.properties ? Object.keys(plot.properties) : [],
                  directTileUrl: plot.tile_url,
                  propertiesTileUrl: plot.properties?.tile_url,
                  plotName: plot.properties?.plot_name || plot.plot_name
                });
              }
              
              // Store tile_url even if plotId is missing (use index as fallback)
              if (tileUrl) {
                // Ensure the tile URL is a valid string and properly formatted
                const cleanTileUrl = String(tileUrl).trim();
                if (cleanTileUrl && cleanTileUrl.includes('earthengine.googleapis.com')) {
                  tileUrlsMap[plotId] = cleanTileUrl;
                  console.log(`✅ Found tile_url for plot ${plotId}:`, cleanTileUrl);
                  if (activeTab === 'waterSource') {
                    console.log(`🌊 Water Source - Stored tile_url for ${plotId}`);
                  }
                } else {
                  console.warn(`⚠️ Invalid tile_url format for plot ${plotId}:`, tileUrl);
                  if (activeTab === 'waterSource') {
                    console.warn(`🌊 Water Source - Invalid tile_url format:`, tileUrl);
                  }
                }
              } else {
                console.warn(`⚠️ Plot ${plotId} missing tile_url`);
                if (activeTab === 'waterSource') {
                  console.warn(`🌊 Water Source - Missing tile_url for plot:`, { plotId, plot: plot });
                }
              }
            });
            
            // Second pass: Convert plots to map format (only plots with valid coordinates)
            const plotsForMap = plotsArray
              .map((plot, index) => {
                // Handle both formats: GeoJSON Feature with properties, or direct format
                // Try multiple ways to get plot_id: plot_id, plot_name, or generate from index
                const plotId = plot.properties?.plot_id || plot.plot_id || 
                              plot.properties?.plot_name || plot.plot_name || 
                              `plot-${index}`;
                const areaAcres = plot.properties?.area_acres || plot.area_acres;
                
                if (!plotId) {
                  console.warn(`Plot at index ${index} missing plot_id and plot_name`);
                  return null;
                }
                
                // Extract coordinates from different formats
                let coordinates: number[][] = [];
                
                // Format 1: GeoJSON Feature with geometry
                if (plot.geometry && plot.geometry.coordinates) {
                  const geomCoords = plot.geometry.coordinates;
                  if (plot.geometry.type === 'Polygon' && Array.isArray(geomCoords) && geomCoords.length > 0) {
                    // Polygon: coordinates is [[[lng, lat], [lng, lat], ...]] - extract first ring (outer boundary)
                    const firstRing = geomCoords[0];
                    if (Array.isArray(firstRing) && firstRing.length > 0 && Array.isArray(firstRing[0])) {
                      // Check if firstRing[0] is a coordinate pair (not nested further)
                      if (firstRing[0].length === 2 && typeof firstRing[0][0] === 'number') {
                        coordinates = firstRing as unknown as number[][];
                      }
                    }
                  } else if (Array.isArray(geomCoords) && geomCoords.length > 0) {
                    // Check if it's already a flat array of coordinates
                    const firstItem = geomCoords[0];
                    if (Array.isArray(firstItem) && firstItem.length === 2 && typeof firstItem[0] === 'number') {
                      coordinates = geomCoords as unknown as number[][];
                    }
                  }
                }
                // Format 2: Direct coordinates array
                else if (plot.coordinates && Array.isArray(plot.coordinates)) {
                  coordinates = plot.coordinates;
                }
                
                // Validate coordinates
                if (!coordinates || coordinates.length < 3) {
                  console.warn(`Plot ${plotId} has invalid coordinates - skipping plot boundary but tile_url may still be used`);
                  return null;
                }
                
                // Convert coordinates to Coordinate[] format [lng, lat]
                const validCoords: Coordinate[] = coordinates
                  .filter((coord: any) => 
                    Array.isArray(coord) && coord.length >= 2 && 
                    typeof coord[0] === 'number' && typeof coord[1] === 'number'
                  )
                  .map((coord: any) => [coord[0], coord[1]] as Coordinate);
                
                if (validCoords.length < 3) {
                  console.warn(`Plot ${plotId} has insufficient valid coordinates - skipping plot boundary but tile_url may still be used`);
                  return null;
                }
                
                return {
                  id: String(plotId),
                  area_ha: String(areaAcres || 0), // Store area in acres
                  boundary: validCoords // [lng, lat] coordinates
                };
              })
              .filter((plot): plot is { id: string; area_ha: string; boundary: Coordinate[] } => plot !== null);
            
            // Set all tile URLs at once (after collecting them all)
            if (Object.keys(tileUrlsMap).length > 0) {
              console.log(`✅ Setting ${Object.keys(tileUrlsMap).length} tile URLs:`, Object.keys(tileUrlsMap));
              console.log('✅ Sample tile URL:', Object.values(tileUrlsMap)[0]);
              console.log('✅ All tile URLs to display:', tileUrlsMap);
              if (activeTab === 'waterSource') {
                console.log(`🌊 Water Source - Setting ${Object.keys(tileUrlsMap).length} tile URLs`);
                console.log('🌊 Water Source - Tile URLs map:', tileUrlsMap);
              }
              setAllPlotsTileUrls(tileUrlsMap);
              // Ensure showTileLayers is true when we have tile URLs
              setShowTileLayers(true);
              if (activeTab === 'waterSource') {
                console.log('🌊 Water Source - showTileLayers set to true');
              }
            } else {
              console.warn('⚠️ No tile URLs found in plots');
              console.warn('⚠️ Response structure:', response);
              if (activeTab === 'waterSource') {
                console.warn('🌊 Water Source - No tile URLs found!');
                console.warn('🌊 Water Source - Plots array:', plotsArray);
              }
              setAllPlotsTileUrls({});
            }
            
            if (plotsForMap.length > 0) {
              setAllPlots(plotsForMap);
              const plotIds = plotsForMap.map(p => p.id);
              setAvailablePlots(plotIds);
              setTotalPlotsCount(plotIds.length);
              console.log(`✅ Displaying ${plotsForMap.length} plots on map from ${activeTab} analysis`);
            } else {
              console.warn(`No valid plots with coordinates found in ${activeTab} response`);
              setAllPlots([]);
            }
          } else {
            console.error(`❌ No plots array found in ${activeTab} analysis response!`);
            console.error('❌ Full response:', JSON.stringify(response, null, 2));
            console.error('❌ Response type:', typeof response);
            console.error('❌ Response keys:', Object.keys(response || {}));
            console.error('❌ Is response an array?', Array.isArray(response));
            setAllPlots([]);
            setAllPlotsTileUrls({});
          }

          // Store pixel/area summaries based on active tab
          // For waterSource, also include area_summary data (water_area_percentage)
          if (activeTab === 'waterSource') {
            const ndwiResponse = response as NDWIDetectionResponse;
            const waterSourceData = {
              ...(response.pixel_summary || {}),
              ...(ndwiResponse.area_summary || {}), // Include area_summary (water_area_percentage, water_area_hectare, etc.)
            };
            console.log('🌊 Water Source - Merged data for LegendCircles:', waterSourceData);
            console.log('🌊 Water Source - water_area_percentage:', waterSourceData.water_area_percentage);
            setAllPlotsAnalysisData(prev => ({
              ...prev,
              waterSource: waterSourceData,
            }));
          } else if (activeTab === 'pest') {
            const pestResponse: any = response;
            // New format: hierarchy with tile_url, total_area_ha, percentage, children per category
            if (pestResponse.hierarchy && typeof pestResponse.hierarchy === 'object') {
              setPestHierarchy(pestResponse as PestHierarchyResponse);
              const hierarchy = pestResponse.hierarchy as Record<string, { total_area_ha?: number; percentage?: number }>;
              const pestSummary = {
                healthy_pixel_percentage: hierarchy.healthy?.percentage ?? 0,
                chewing_pixel_percentage: hierarchy.chewing?.percentage ?? 0,
                fungi_pixel_percentage: hierarchy.fungi?.percentage ?? 0,
                sucking_pixel_percentage: hierarchy.sucking?.percentage ?? 0,
                wilt_pixel_percentage: hierarchy.wilt?.percentage ?? 0,
                soilborne_pixel_percentage: hierarchy.soilborne?.percentage ?? 0,
                healthy_area_hectare: hierarchy.healthy?.total_area_ha ?? 0,
                chewing_area_hectare: hierarchy.chewing?.total_area_ha ?? 0,
                fungi_area_hectare: hierarchy.fungi?.total_area_ha ?? 0,
                sucking_area_hectare: hierarchy.sucking?.total_area_ha ?? 0,
                wilt_area_hectare: hierarchy.wilt?.total_area_ha ?? 0,
                soilborn_area_hectare: hierarchy.soilborne?.total_area_ha ?? 0,
                soilborne_area_hectare: hierarchy.soilborne?.total_area_ha ?? 0,
                total_area_hectare: pestResponse.total_area_ha ?? 0,
              };
              setAllPlotsAnalysisData(prev => ({
                ...prev,
                pest: pestSummary,
              }));
            } else {
              // Legacy: percentage_summary and area_summary_hectare
              const pct = pestResponse.percentage_summary || {};
              const area = pestResponse.area_summary_hectare || {};
              setPestHierarchy(null);
              const pestSummary = {
                healthy_pixel_percentage: pct.healthy_pct ?? 0,
                chewing_pixel_percentage: pct.chewing_pct ?? 0,
                fungi_pixel_percentage: pct.fungi_pct ?? 0,
                sucking_pixel_percentage: pct.sucking_pct ?? 0,
                wilt_pixel_percentage: pct.wilt_pct ?? 0,
                soilborne_pixel_percentage: pct.soilborne_pct ?? 0,
                healthy_area_hectare: area.healthy_area_ha ?? 0,
                chewing_area_hectare: area.chewing_area_ha ?? 0,
                fungi_area_hectare: area.fungi_area_ha ?? 0,
                sucking_area_hectare: area.sucking_area_ha ?? 0,
                wilt_area_hectare: area.wilt_area_ha ?? 0,
                soilborn_area_hectare: area.soilborne_area_ha ?? 0,
                soilborne_area_hectare: area.soilborne_area_ha ?? 0,
                total_area_hectare: area.total_area_ha ?? 0,
              };
              setAllPlotsAnalysisData(prev => ({
                ...prev,
                pest: pestSummary,
              }));
            }
          } else if (response.pixel_summary || (response as any).classwise) {
            const responseAny = response as any;
            const classwise = responseAny.classwise;
            const tabData = (response.pixel_summary || {}) as any;
            if ((activeTab === 'growth' || activeTab === 'water' || activeTab === 'soil') && classwise && Array.isArray(classwise) && classwise.length > 0) {
              tabData.classwise = classwise;
            }
            setAllPlotsAnalysisData(prev => ({
              growth: activeTab === 'growth' ? tabData : (prev?.growth || null),
              water: activeTab === 'water' ? tabData : (prev?.water || null),
              soil: activeTab === 'soil' ? tabData : (prev?.soil || null),
              pest: activeTab === 'pest' ? (response.pixel_summary || {}) : (prev?.pest || null),
              waterSource: prev?.waterSource || null,
            }));
          } else {
            setAllPlotsAnalysisData(prev => ({
              growth: activeTab === 'growth' ? null : (prev?.growth || null),
              water: activeTab === 'water' ? null : (prev?.water || null),
              soil: activeTab === 'soil' ? null : (prev?.soil || null),
              pest: activeTab === 'pest' ? null : (prev?.pest || null),
              waterSource: activeTab === 'waterSource' ? null : (prev?.waterSource || null),
            }));
          }
          
          // Extract water_area_hectare for waterSource tab
          if (activeTab === 'waterSource') {
            const ndwiResponse = response as NDWIDetectionResponse;
            const responseAny = response as any;
            
            // Log full response for debugging
            console.log('🌊 Water Source - Full API Response:', JSON.stringify(response, null, 2));
            console.log('🌊 Water Source - Response keys:', Object.keys(responseAny));
            console.log('🌊 Water Source - area_summary:', responseAny.area_summary);
            
            // Try multiple possible field names and locations
            let waterArea: number | null = null;
            
            // FIRST: Check in area_summary (this is the correct location based on API response)
            if (ndwiResponse.area_summary?.water_area_hectare !== undefined && ndwiResponse.area_summary.water_area_hectare !== null) {
              waterArea = ndwiResponse.area_summary.water_area_hectare;
              console.log('✅ Found water_area_hectare in area_summary:', waterArea);
            } else if (responseAny.area_summary?.water_area_hectares !== undefined && responseAny.area_summary.water_area_hectares !== null) {
              waterArea = responseAny.area_summary.water_area_hectares;
              console.log('✅ Found water_area_hectares in area_summary:', waterArea);
            }
            // SECOND: Check root level with different possible field names
            else if (ndwiResponse.water_area_hectare !== undefined && ndwiResponse.water_area_hectare !== null) {
              waterArea = ndwiResponse.water_area_hectare;
              console.log('✅ Found water_area_hectare at root:', waterArea);
            } else if (responseAny.water_area_hectares !== undefined && responseAny.water_area_hectares !== null) {
              waterArea = responseAny.water_area_hectares;
              console.log('✅ Found water_area_hectares at root:', waterArea);
            } else if (responseAny.water_area_hectare !== undefined && responseAny.water_area_hectare !== null) {
              waterArea = responseAny.water_area_hectare;
              console.log('✅ Found water_area_hectare (any) at root:', waterArea);
            } else if (responseAny.total_water_area_hectare !== undefined && responseAny.total_water_area_hectare !== null) {
              waterArea = responseAny.total_water_area_hectare;
              console.log('✅ Found total_water_area_hectare at root:', waterArea);
            } else if (responseAny.total_water_area_hectares !== undefined && responseAny.total_water_area_hectares !== null) {
              waterArea = responseAny.total_water_area_hectares;
              console.log('✅ Found total_water_area_hectares at root:', waterArea);
            }
            
            // THIRD: Check in pixel_summary if available
            if (waterArea === null && response.pixel_summary) {
              const pixelSummary = response.pixel_summary as any;
              if (pixelSummary.water_area_hectare !== undefined && pixelSummary.water_area_hectare !== null) {
                waterArea = pixelSummary.water_area_hectare;
                console.log('✅ Found water_area_hectare in pixel_summary:', waterArea);
              } else if (pixelSummary.water_area_hectares !== undefined && pixelSummary.water_area_hectares !== null) {
                waterArea = pixelSummary.water_area_hectares;
                console.log('✅ Found water_area_hectares in pixel_summary:', waterArea);
              }
            }
            
            // Set the value or log warning
            if (waterArea !== null && !isNaN(waterArea) && waterArea >= 0) {
              setWaterAreaHectares(waterArea);
              console.log('✅ Setting water area hectares to:', waterArea);
            } else {
              console.warn('⚠️ No valid water_area_hectare found in response');
              console.warn('⚠️ Response structure:', response);
              console.warn('⚠️ area_summary:', responseAny.area_summary);
              setWaterAreaHectares(null);
            }
          } else {
            // Clear water area when switching away from waterSource tab
            setWaterAreaHectares(null);
          }
          
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          console.error(`Error loading ${activeTab} analysis:`, err);
          setError(`Failed to load plots: ${errorMessage}`);
          setAllPlots([]);
          setAvailablePlots([]);
          setTotalPlotsCount(0);
          setAllPlotsTileUrls({});
          setAllPlotsAnalysisData(null);
          // Clear water area on error if it was waterSource tab
          if (activeTab === 'waterSource') {
            setWaterAreaHectares(null);
          }
      } finally {
        setLoading(false);
      }
    };

    loadAnalysisData();
    } else if (!selectedDistrict) {
      // Clear plots when district is not selected
      setAllPlots([]);
      setAvailablePlots([]);
      setTotalPlotsCount(0);
      setAllPlotsTileUrls({});
      setAllPlotsAnalysisData(null);
    }
  }, [activeTab, selectedDistrict, selectedSubdistrict, selectedVillage]); // Fetch when tab OR location changes

  // Clear water area when switching away from waterSource tab
  useEffect(() => {
    if (activeTab !== 'waterSource') {
      setWaterAreaHectares(null);
    }
  }, [activeTab]);

  // Fetch sugarcane data when crop is selected
  useEffect(() => {
    if (selectedCrop === 'sugarcane' && selectedDistrict && !selectedSubdistrict) {
      const loadSugarcaneData = async () => {
        try {
          setLoading(true);
          setError(null);
          
          const response = await fetchNDVISugarcaneDetection(selectedDistrict);
          
          if (response.tile_url && response.area_ha !== undefined) {
            setCropTileUrl(response.tile_url);
            setCropAreaHa(response.area_ha);
            setAllPlotsTileUrls(prev => ({ ...prev, 'sugarcane': response.tile_url }));
            setShowTileLayers(true);
          } else {
            throw new Error('No tile_url or area_ha in response');
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          setError(`Failed to load sugarcane detection: ${errorMessage}`);
          setCropTileUrl(null);
          setCropAreaHa(null);
        } finally {
          setLoading(false);
        }
      };
      
      loadSugarcaneData();
    } else if (!selectedCrop) {
      // Clear crop data when no crop is selected
      setCropTileUrl(null);
      setCropAreaHa(null);
    }
  }, [selectedCrop, selectedDistrict, selectedSubdistrict]);

  // Reset methane when district/subdistrict changes
  useEffect(() => {
    setMethaneEnabled(false);
    setMethaneTileUrl(null);
  }, [selectedDistrict, selectedSubdistrict]);

  // Fetch Pest stored time series when Pest tab is active and district + subdistrict are selected
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (activeTab !== 'pest' || !selectedDistrict || !selectedSubdistrict) {
        if (!cancelled) {
          setPestStoredSeries(null);
          setPestStoredError(null);
          setPestStoredLoading(false);
          setSelectedPestYearMonth(null);
        }
        return;
      }
      try {
        setPestStoredLoading(true);
        setPestStoredError(null);
        const data = await fetchPestStoredSeries(selectedDistrict, selectedSubdistrict, 50);
        if (!cancelled) {
          setPestStoredSeries(data);
          setSelectedPestYearMonth(data.length > 0 ? data[0].year_month : null);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Failed to load pest time series';
          setPestStoredSeries(null);
          setPestStoredError(msg);
        }
      } finally {
        if (!cancelled) setPestStoredLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedDistrict, selectedSubdistrict]);

  // When a stored pest year_month is selected, update hierarchy, sidebar cards and map tile
  useEffect(() => {
    if (activeTab !== 'pest' || !pestStoredSeries || !selectedPestYearMonth) return;

    const item = pestStoredSeries.find((it) => it.year_month === selectedPestYearMonth);
    if (!item || !item.response_data) return;

    const resp: any = item.response_data;
    const hierarchy = resp.hierarchy || {};

    // Update pest hierarchy so sidebar Percentage / Area uses stored data
    setPestHierarchy({
      plot: resp.plot || '',
      total_area_ha: resp.total_area_ha ?? resp.total_area_ha ?? 0,
      hierarchy,
    } as PestHierarchyResponse);

    // Build pest summary from hierarchy for sidebar cards (if needed elsewhere)
    const pestSummary = {
      healthy_pixel_percentage: hierarchy.healthy?.percentage ?? 0,
      chewing_pixel_percentage: hierarchy.chewing?.percentage ?? 0,
      fungi_pixel_percentage: hierarchy.fungi?.percentage ?? 0,
      sucking_pixel_percentage: hierarchy.sucking?.percentage ?? 0,
      wilt_pixel_percentage: hierarchy.wilt?.percentage ?? 0,
      soilborne_pixel_percentage: hierarchy.soilborne?.percentage ?? 0,
      healthy_area_hectare: hierarchy.healthy?.total_area_ha ?? 0,
      chewing_area_hectare: hierarchy.chewing?.total_area_ha ?? 0,
      fungi_area_hectare: hierarchy.fungi?.total_area_ha ?? 0,
      sucking_area_hectare: hierarchy.sucking?.total_area_ha ?? 0,
      wilt_area_hectare: hierarchy.wilt?.total_area_ha ?? 0,
      soilborn_area_hectare: hierarchy.soilborne?.total_area_ha ?? 0,
      soilborne_area_hectare: hierarchy.soilborne?.total_area_ha ?? 0,
      total_area_hectare: resp.total_area_ha ?? 0,
    };

    setAllPlotsAnalysisData((prev) => ({
      growth: prev?.growth || null,
      water: prev?.water || null,
      soil: prev?.soil || null,
      pest: pestSummary,
      waterSource: prev?.waterSource || null,
    }));

    // Update map tile_url for this month (overall pest tile)
    if (resp.tile_url) {
      setPestTileUrl(resp.tile_url);
      setAllPlotsTileUrls({ pest: resp.tile_url });
      setShowTileLayers(true);
    }
  }, [activeTab, pestStoredSeries, selectedPestYearMonth]);

  // Fetch Daily Weather for selected district/subdistrict/village
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!selectedDistrict) {
        setWeatherDailyData(null);
        setWeatherDailyError(null);
        setWeatherDailyLoading(false);
        return;
      }
      try {
        setWeatherDailyLoading(true);
        setWeatherDailyError(null);
        const data = await fetchWeatherDaily(
          selectedDistrict,
          selectedSubdistrict || undefined,
          selectedVillage || undefined
        );
        if (!cancelled) setWeatherDailyData(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load daily weather';
        if (!cancelled) {
          setWeatherDailyData(null);
          setWeatherDailyError(msg);
        }
      } finally {
        if (!cancelled) setWeatherDailyLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedDistrict, selectedSubdistrict, selectedVillage]);

  // Use all plots from taluka, or selected plot if analysis data is loaded, or GeoJSON plots if loaded
  const plots = geojsonPlots.length > 0 
    ? geojsonPlots 
    : (allPlots.length > 0 ? allPlots : (plotBoundary.length > 0 ? [{
        id: selectedPlotId || '',
        area_ha: String(areaHa || 0),
        boundary: plotBoundary
      }] : []));

  // Pixel data for legend - use aggregated data for all plots if available, otherwise use single plot data
  let currentPixelData: any = null;
  if (activeTab === 'growth') {
    currentPixelData = allPlotsAnalysisData?.growth || growthData;
  } else if (activeTab === 'water') {
    currentPixelData = allPlotsAnalysisData?.water || waterData;
  } else if (activeTab === 'soil') {
    currentPixelData = allPlotsAnalysisData?.soil || soilData;
  } else if (activeTab === 'pest') {
    currentPixelData = allPlotsAnalysisData?.pest || pestData;
  } else if (activeTab === 'waterSource') {
    currentPixelData = allPlotsAnalysisData?.waterSource || null;
  } else if (activeTab === 'forest') {
    currentPixelData = forestData; // Forest data for legend circles
  }

  // Pest category colors for sidebar (same as map legend)
  const PEST_CARD_COLORS: Record<string, string> = {
    healthy: '#22c55e',
    chewing: '#f97316',
    fungi: '#a855f7',
    sucking: '#ef4444',
    wilt: '#92400e',
    soilborne: '#6b7280',
  };
  // Area cards data for sidebar: ha + percentage; for pest optionally tileUrl + pestKey for click-to-show on map + children panel
  const areaCards: { label: string; value: number; percentage?: number; color?: string; tileUrl?: string | null; pestKey?: string }[] = [];
  const ps: any = currentPixelData || {};

  // Format percentage for display (small values show 2 decimals)
  const formatPct = (p: number) =>
    p > 0 && p < 1 ? p.toFixed(2) : String(Math.round(p));

  // Format class_name for display: "shallow_water" -> "Shallow Water"
  const formatClassLabel = (name: string) =>
    (name || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // Build from classwise array when API returns it (analyze_Growthclasswise, wateruptakeclasswise, SoilMoistureclasswise)
  const classwise = ps.classwise;
  if ((activeTab === 'growth' || activeTab === 'water' || activeTab === 'soil') && classwise && Array.isArray(classwise) && classwise.length > 0) {
    classwise.forEach((c: any) => {
      areaCards.push({
        label: formatClassLabel(c.class_name || ''),
        value: Number(c.area_hectares ?? 0),
        percentage: Number(c.percentage ?? 0),
        color: c.color || '#f97316',
        tileUrl: c.tile_url ?? undefined,
      });
    });
  } else if (activeTab === 'growth') {
    areaCards.push(
      { label: 'Weak', value: Number(ps.weak_area_hectares || 0), percentage: Number(ps.weak_pixel_percentage ?? 0), color: '#f97316' },
      { label: 'Stress', value: Number(ps.stress_area_hectares || 0), percentage: Number(ps.stress_pixel_percentage ?? 0), color: '#f97316' },
      { label: 'Moderate', value: Number(ps.moderate_area_hectares || 0), percentage: Number(ps.moderate_pixel_percentage ?? 0), color: '#f97316' },
      { label: 'Healthy', value: Number(ps.healthy_area_hectares || 0), percentage: Number(ps.healthy_pixel_percentage ?? 0), color: '#f97316' },
    );
  } else if (activeTab === 'water') {
    areaCards.push(
      { label: 'Deficient', value: Number(ps.deficient_area_hectare || 0), percentage: Number(ps.deficient_pixel_percentage ?? 0), color: '#f97316' },
      { label: 'Less', value: Number(ps.less_area_hectare || 0), percentage: Number(ps.less_pixel_percentage ?? 0), color: '#f97316' },
      { label: 'Adequate', value: Number(ps.adequat_area_hectare || 0), percentage: Number(ps.adequate_pixel_percentage ?? ps.adequat_pixel_percentage ?? 0), color: '#f97316' },
      { label: 'Excellent', value: Number(ps.excellent_area_hectare || 0), percentage: Number(ps.excellent_pixel_percentage ?? 0), color: '#f97316' },
      { label: 'Excess', value: Number(ps.excess_area_hectare || 0), percentage: Number(ps.excess_pixel_percentage ?? 0), color: '#f97316' },
    );
  } else if (activeTab === 'soil') {
    areaCards.push(
      { label: 'Less', value: Number(ps.less_area_hectare || 0), percentage: Number(ps.less_pixel_percentage ?? 0), color: '#f97316' },
      { label: 'Adequate', value: Number(ps.adequate_area_hectare || 0), percentage: Number(ps.adequate_pixel_percentage ?? 0), color: '#f97316' },
      { label: 'Excellent', value: Number(ps.excellent_area_hectare || 0), percentage: Number(ps.excellent_pixel_percentage ?? 0), color: '#f97316' },
      { label: 'Excess', value: Number(ps.excess_area_hectare || 0), percentage: Number(ps.excess_pixel_percentage ?? 0), color: '#f97316' },
      { label: 'Shallow Water', value: Number(ps.shallow_water_area_hectare || 0), percentage: Number(ps.shallow_water_pixel_percentage ?? 0), color: '#f97316' },
    );
  } else if (activeTab === 'pest') {
    if (pestHierarchy?.hierarchy) {
      const order = ['healthy', 'chewing', 'fungi', 'sucking', 'wilt', 'soilborne'];
      order.forEach(k => {
        const node = pestHierarchy.hierarchy[k];
        if (node == null) return;
        areaCards.push({
          label: formatClassLabel(k),
          value: Number(node.total_area_ha ?? 0),
          percentage: Number(node.percentage ?? 0),
          color: PEST_CARD_COLORS[k] ?? '#f97316',
          tileUrl: node.tile_url ?? undefined,
          pestKey: k,
        });
      });
    } else {
      areaCards.push(
        { label: 'Chewing', value: Number(ps.chewing_area_hectare || 0), percentage: Number(ps.chewing_pixel_percentage ?? 0), color: PEST_CARD_COLORS.chewing, pestKey: 'chewing' },
        { label: 'Fungi', value: Number(ps.fungi_area_hectare || 0), percentage: Number(ps.fungi_pixel_percentage ?? 0), color: PEST_CARD_COLORS.fungi, pestKey: 'fungi' },
        { label: 'Sucking', value: Number(ps.sucking_area_hectare || 0), percentage: Number(ps.sucking_pixel_percentage ?? 0), color: PEST_CARD_COLORS.sucking, pestKey: 'sucking' },
        { label: 'Wilt', value: Number(ps.wilt_area_hectare || 0), percentage: Number(ps.wilt_pixel_percentage ?? 0), color: PEST_CARD_COLORS.wilt, pestKey: 'wilt' },
        { label: 'SoilBorn', value: Number(ps.soilborn_area_hectare || 0), percentage: Number(ps.soilborne_pixel_percentage ?? ps.soilborn_pixel_percentage ?? 0), color: PEST_CARD_COLORS.soilborne, pestKey: 'soilborne' },
      );
    }
  }

  // Handle login
  const handleLogin = (user: string) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    // Save to localStorage
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('currentUser', user);
  };

  // Handle logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser('');
    // Clear localStorage
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('currentUser');
  };

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen w-full bg-gray-900 text-gray-100 font-sans overflow-hidden relative">
      {/* Mobile Overlay when sidebar is visible */}
      {sidebarVisible && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-[9]"
          onClick={() => setSidebarVisible(false)}
        />
      )}
      
      {/* Sidebar */}
      {sidebarVisible && (
        <aside 
          className="w-full md:w-80 flex-shrink-0 border-r border-gray-700 flex flex-col z-10 shadow-xl relative overflow-hidden"
          style={{
            backgroundImage: `url(${backgroundImages[currentBgImageIndex]})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          {/* Overlay for better text readability */}
          <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm"></div>
          
          {/* Content with relative positioning */}
          <div className="relative z-10 flex flex-col h-full">
            <div className="p-4 md:p-6 border-b border-gray-700 bg-gray-900/50">
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-lg md:text-xl font-bold text-green-400">
                  <BlurText 
                    text="Nearlive Crop Monitroring" 
                    animateBy="words"
                    direction="top"
                    delay={100}
                    className="text-green-400"
                  />
          </h1>
                <button
                  onClick={handleLogout}
                  className="logout-btn p-1.5 md:p-2 rounded-lg transition-colors flex-shrink-0 flex items-center justify-center"
                  title="Logout"
                >
                  <LogOut size={16} className="md:w-[18px] md:h-[18px]" strokeWidth={2} />
                </button>
              </div>
          {/* <p className="text-xs text-gray-400 mt-1">Satellite Field Monitoring</p>
              {currentUser && (
                <p className="text-xs text-gray-500 mt-1 truncate">User: {currentUser}</p>
              )} */}
        </div>


        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* District Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Select District
            </label>
            <select
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value);
                setSelectedSubdistrict(''); // Reset subdistrict when district changes
              }}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">-- Select District --</option>
              {districts.map((district) => (
                <option key={district.district} value={district.district}>
                  {district.district}
                </option>
              ))}
            </select>
          </div>

          {/* Subdistrict Dropdown */}
          {selectedDistrict && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Select Subdistrict
              </label>
              <select
                value={selectedSubdistrict}
                onChange={(e) => {
                  setSelectedSubdistrict(e.target.value);
                  setSelectedVillage(''); // Reset village when subdistrict changes
                }}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={subdistricts.length === 0}
              >
                <option value="">-- Select Subdistrict --</option>
                {subdistricts.map((subdistrict) => (
                  <option key={subdistrict.subdistrict} value={subdistrict.subdistrict}>
                    {subdistrict.subdistrict}
                  </option>
                ))}
              </select>
              </div>
          )}

          {/* Village Dropdown */}
          {selectedSubdistrict && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Select Village
              </label>
              <select
                value={selectedVillage}
                onChange={(e) => setSelectedVillage(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={villages.length === 0}
              >
                <option value="">-- Select Village --</option>
                {villages.map((village) => (
                  <option key={village.village} value={village.village}>
                    {village.village}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Total Area Card */}
          {selectedDistrict && (
            <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {selectedPlotArea !== null ? 'Plot Area' : 'Total Area'}
              </div>
              {selectedPlotArea !== null ? (
                // Show selected plot area (from GeoJSON)
                <div className="text-lg font-bold text-green-400">
                  {selectedPlotArea.toFixed(2)} ha
                </div>
              ) : totalAreaLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="animate-spin text-green-400" size={20} />
                </div>
              ) : totalAreaHectares !== null && totalAreaHectares !== undefined ? (
                <div className="text-lg font-bold text-green-400">
                  {totalAreaHectares.toFixed(2)} ha
                </div>
              ) : (
                <div className="text-sm text-gray-500">No area data available</div>
              )}
            </div>
          )}

          {/* Total Water Area Card - Show when waterSource tab is active */}
          {activeTab === 'waterSource' && selectedDistrict && (
            <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Total Water Area
              </div>
              {loading && activeTab === 'waterSource' ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="animate-spin text-green-400" size={20} />
                </div>
              ) : waterAreaHectares !== null && waterAreaHectares !== undefined && !isNaN(waterAreaHectares) ? (
                <div className="text-lg font-bold text-green-400">
                  {waterAreaHectares.toFixed(2)} ha
                </div>
              ) : (
                <div className="text-sm text-gray-500">No water area data available</div>
              )}
            </div>
          )}

          {/* Percentage / Area (ha) — grid 2 per row; click loads tile on map */}
          {['growth', 'water', 'soil', 'pest'].includes(activeTab || '') && areaCards.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Percentage / Area (ha)
              </div>
              <div className="grid grid-cols-2 gap-2">
              {areaCards.map((item, idx) => (
                <div
                  key={`pct-${item.label}-${idx}`}
                  role={(activeTab === 'pest' && (item.tileUrl != null || item.pestKey != null)) || (['growth', 'water', 'soil'].includes(activeTab || '') && item.tileUrl != null) ? 'button' : undefined}
                  tabIndex={(activeTab === 'pest' && (item.tileUrl != null || item.pestKey != null)) || (['growth', 'water', 'soil'].includes(activeTab || '') && item.tileUrl != null) ? 0 : undefined}
                  onClick={() => {
                    if (activeTab === 'pest') {
                      if (item.tileUrl != null) {
                        setPestTileUrl(item.tileUrl!);
                        setAllPlotsTileUrls({ pest: item.tileUrl! });
                        setShowTileLayers(true);
                      }
                      if (item.pestKey != null) {
                        setSelectedPestCategory(item.pestKey);
                        const children = pestHierarchy?.hierarchy[item.pestKey]?.children;
                        setShowPestChildren(!!children && Object.keys(children).length > 0);
                      }
                    } else if (['growth', 'water', 'soil'].includes(activeTab || '') && item.tileUrl != null) {
                      setAllPlotsTileUrls({ [activeTab]: item.tileUrl! });
                      setShowTileLayers(true);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      if ((activeTab === 'pest' && (item.tileUrl != null || item.pestKey != null)) || (['growth', 'water', 'soil'].includes(activeTab || '') && item.tileUrl != null))
                        e.currentTarget.click();
                    }
                  }}
                  className={`p-2 bg-gray-700 rounded-lg border border-gray-600 flex flex-col items-center text-center gap-1.5 ${(activeTab === 'pest' && (item.tileUrl != null || item.pestKey != null)) || (['growth', 'water', 'soil'].includes(activeTab || '') && item.tileUrl != null) ? 'cursor-pointer hover:bg-gray-600 transition-colors' : ''}`}
                >
                  <div className="flex items-center gap-1.5 justify-center">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color || '#f97316' }}
                    />
                    <span className="text-xs text-gray-200 truncate">{item.label}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 mt-1">
                    <span className="font-semibold text-green-400 text-sm md:text-base">
                      {item.percentage != null ? `${formatPct(item.percentage)}%` : '0%'}
                    </span>
                    <span className="font-semibold text-green-400 text-sm md:text-base">
                      {item.value.toFixed(2)} ha
                    </span>
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}

          {/* Area Display */}
          {areaHa !== null && areaHa !== undefined && typeof areaHa === 'number' && (
            <div className="p-4 bg-gray-700 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Area</div>
              <div className="text-lg font-bold text-green-400">
                {areaHa.toFixed(2)} ha
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {(areaHa * 2.47105).toFixed(2)} acres
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm flex flex-col items-center text-center gap-2">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Loader2 className="animate-spin mb-2" size={32} />
              <span>Loading...</span>
            </div>
          )}
            </div>
        </div>
      </aside>
      )}

      {/* Home Icon Toggle Button - Positioned to avoid Leaflet zoom controls */}
      <button
        onClick={() => setSidebarVisible(!sidebarVisible)}
        className={`fixed z-[1001] p-2 md:p-3 bg-black/60 backdrop-blur-sm rounded-lg border border-gray-700 text-white hover:bg-gray-800 transition-all duration-300 shadow-lg ${
          sidebarVisible 
            ? 'top-4 left-4 md:top-24 md:left-[21rem]' 
            : 'top-24 left-4'
        }`}
        title={sidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
      >
        <Home size={18} className="md:w-5 md:h-5" />
      </button>

      {/* Main Map Area */}
      <main className="flex-1 relative bg-gray-950 flex flex-col">
        {/* Top Navigation Tabs and Legend - Centered */}
        <div className="absolute top-12 md:top-4 left-1/2 transform -translate-x-1/2 z-[1000] flex flex-col items-center gap-2 md:gap-4 w-auto px-2 md:px-0">
          {/* Active Tab Buttons - icons only */}
          <div className="flex gap-1 md:gap-2 bg-black/60 backdrop-blur-sm rounded-lg border border-gray-700 p-1 overflow-x-auto w-auto">
            <button
              onClick={() => setActiveTab('growth')}
              className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center ${
                activeTab === 'growth' ? 'bg-emerald-500 text-black' : 'text-gray-300 hover:bg-gray-700'
              }`}
              title="Growth"
            >
              <Sprout size={18} />
            </button>
            <button
              onClick={() => setActiveTab('water')}
              className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center ${
                activeTab === 'water' ? 'bg-sky-500 text-black' : 'text-gray-300 hover:bg-gray-700'
              }`}
              title="Water Uptake"
            >
              <Droplets size={18} />
            </button>
            <button
              onClick={() => setActiveTab('soil')}
              className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center ${
                activeTab === 'soil' ? 'bg-teal-500 text-black' : 'text-gray-300 hover:bg-gray-700'
              }`}
              title="Soil Moisture"
            >
              <Droplet size={18} />
            </button>
            <button
              onClick={() => {
                setActiveTab('pest');
              }}
              className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center ${
                activeTab === 'pest' ? 'bg-rose-500 text-black' : 'text-gray-300 hover:bg-gray-700'
              }`}
              title="Pest"
            >
              <Bug size={18} />
            </button>
            <button
              onClick={() => {
                setActiveTab('waterSource');
              }}
              className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center ${
                activeTab === 'waterSource' ? 'bg-blue-500 text-black' : 'text-gray-300 hover:bg-gray-700'
              }`}
              title="Water Source"
            >
              <Waves size={18} />
            </button>
            <button
              onClick={() => {
                setActiveTab('forest');
              }}
              className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center ${
                activeTab === 'forest' ? 'bg-lime-500 text-black' : 'text-gray-300 hover:bg-gray-700'
              }`}
              title="Forest"
            >
              <Trees size={18} />
            </button>
             
            {/* Crops Dropdown - Inline with tabs */}
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-600">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap">
                Crops:
              </label>
              <select
                value={selectedCrop}
                onChange={(e) => {
                  setSelectedCrop(e.target.value);
                  setSelectedVillage(''); // Clear village when crop is selected
                }}
                className="px-2 md:px-3 py-1.5 md:py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-green-500 whitespace-nowrap"
              >
                <option value="">-- Select Crop --</option>
                <option value="sugarcane">Sugarcane</option>
              </select>
            </div>

            {/* Land Surface Temperature Card - Inline */}
            <div 
              onClick={async () => {
                if (lstLoading || loading || !selectedDistrict) return;
                try {
                  setLstLoading(true);
                  setError(null);
                  
                  const response = await fetchLandSurfaceTemperature(selectedDistrict);
                  
                  if (response.tile_url) {
                    setLstTileUrl(response.tile_url);
                    setAllPlotsTileUrls(prev => ({ ...prev, 'land-surface-temperature': response.tile_url }));
                    setShowTileLayers(true);
                  } else {
                    throw new Error('No tile_url in response');
                  }
                } catch (err) {
                  const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
                  setError(`Failed to load Land Surface Temperature: ${errorMessage}`);
                  setLstTileUrl(null);
                } finally {
                  setLstLoading(false);
                }
              }}
              className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md border-2 transition-all duration-200 flex items-center gap-1.5 ${
                selectedDistrict && !lstLoading && !loading
                  ? 'cursor-pointer hover:border-green-500 hover:bg-gray-600' 
                  : 'cursor-not-allowed opacity-50'
              } ${
                lstTileUrl 
                  ? 'bg-green-600/20 border-green-500' 
                  : 'bg-gray-700 border-gray-600'
              }`}
              title="Land Surface Temperature"
            >
              <span className="text-lg">🌡️</span>
            </div>

            {/* Methane Concentration Card - Inline */}
            <div 
              onClick={async () => {
                if (methaneLoading || loading || !selectedDistrict) return;
                try {
                  setMethaneLoading(true);
                  setError(null);
                  
                  const response = await fetchMethane(
                    selectedDistrict,
                    selectedSubdistrict || undefined
                  );
                  
                  if (response.tile_url) {
                    setMethaneTileUrl(response.tile_url);
                    setAllPlotsTileUrls(prev => ({ ...prev, 'methane': response.tile_url }));
                    setShowTileLayers(true);
                    setMethaneEnabled(true);
                  } else {
                    throw new Error('No tile_url in response');
                  }
                } catch (err) {
                  const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
                  setError(`Failed to load Methane Concentration: ${errorMessage}`);
                  setMethaneTileUrl(null);
                  setMethaneEnabled(true);
                } finally {
                  setMethaneLoading(false);
                }
              }}
              className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md border-2 transition-all duration-200 flex items-center gap-1.5 ${
                methaneEnabled && !methaneLoading && !loading
                  ? 'cursor-pointer hover:border-blue-500 hover:bg-gray-600' 
                  : 'cursor-pointer opacity-50'
              } ${
                methaneTileUrl 
                  ? 'bg-blue-600/20 border-blue-500' 
                  : 'bg-gray-700 border-gray-600'
              }`}
              title="Methane Concentration"
            >
              <span className="text-lg">💨</span>
            </div>

            {/* Boundary Button - Only visible when subdistrict is "Palus" and village is selected */}
            {selectedSubdistrict === 'Palus' && selectedVillage && (
              <button
                onClick={async () => {
                  if (geojsonLoading) return;
                  
                  try {
                    setGeojsonLoading(true);
                    setError(null);
                    
                    // Load GeoJSON file - read as text first for large files
                    console.log('Loading GeoJSON file for village:', selectedVillage);
                    const response = await fetch('/palus1.geojson');
                    if (!response.ok) {
                      throw new Error(`Failed to load GeoJSON file: ${response.status} ${response.statusText}`);
                    }
                    
                    // Read response as text first (handles large files better)
                    const responseText = await response.text();
                    console.log('GeoJSON file loaded, size:', responseText.length, 'characters');
                    
                    // Check if response is empty
                    if (!responseText || responseText.length === 0) {
                      throw new Error('Empty response from GeoJSON file');
                    }
                    
                    // Parse JSON from text - handle potentially incomplete files
                    let geojsonData: any;
                    let trimmed = responseText.trim();
                    
                    try {
                      // Try parsing as-is first
                      geojsonData = JSON.parse(trimmed);
                    } catch (parseError) {
                      console.warn('Initial JSON parse failed, attempting to fix common issues...');
                      
                      // Try to fix common issues: remove trailing comma and close structure
                      let fixedText = trimmed;
                      
                      // Remove trailing comma before closing brackets/braces
                      fixedText = fixedText.replace(/,\s*$/, ''); // Remove trailing comma
                      fixedText = fixedText.replace(/,\s*\}/g, '}'); // Remove comma before }
                      fixedText = fixedText.replace(/,\s*\]/g, ']'); // Remove comma before ]
                      
                      // If it doesn't end with }], try to close it
                      if (!fixedText.endsWith('}')) {
                        // Try to close the features array and the FeatureCollection
                        if (fixedText.endsWith(',')) {
                          fixedText = fixedText.slice(0, -1); // Remove last comma
                        }
                        if (!fixedText.endsWith(']')) {
                          fixedText += ']'; // Close features array
                        }
                        if (!fixedText.endsWith('}')) {
                          fixedText += '}'; // Close FeatureCollection
                        }
                      }
                      
                      try {
                        geojsonData = JSON.parse(fixedText);
                        console.log('Successfully parsed after fixing trailing issues');
                      } catch (secondParseError) {
                        console.error('JSON parse error (after fix attempt):', secondParseError);
                        const previewStart = trimmed.substring(0, 500);
                        const previewEnd = trimmed.length > 500 ? trimmed.substring(trimmed.length - 500) : '';
                        console.error('Response preview (first 500 chars):', previewStart);
                        console.error('Response preview (last 500 chars):', previewEnd);
                        console.error('Response length:', trimmed.length);
                        console.error('Response starts with:', trimmed.substring(0, 20));
                        console.error('Response ends with:', trimmed.substring(Math.max(0, trimmed.length - 20)));
                        
                        if (parseError instanceof SyntaxError) {
                          throw new Error(`JSON parse error: ${parseError.message}. The GeoJSON file appears to be incomplete or corrupted. Please check the file integrity.`);
                        }
                        throw new Error(`Failed to parse JSON: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
                      }
                    }
                    
                    // Validate structure
                    if (!geojsonData || !geojsonData.features || !Array.isArray(geojsonData.features)) {
                      throw new Error('Invalid GeoJSON format: missing features array');
                    }
                    
                    console.log(`Total features in GeoJSON: ${geojsonData.features.length}`);
                    
                    // Filter features by village_name matching selectedVillage
                    const filteredFeatures = geojsonData.features.filter((feature: any) => 
                      feature.properties && feature.properties.village_name === selectedVillage
                    );
                    
                    console.log(`Filtered features for village "${selectedVillage}": ${filteredFeatures.length}`);
                    
                    // Parse features into plots format
                    const parsedPlots = filteredFeatures.map((feature: any) => {
                      if (!feature.geometry || !feature.geometry.coordinates) {
                        console.warn('Feature missing geometry:', feature);
                        return null;
                      }
                      const coords = feature.geometry.coordinates[0] || [];
                      const boundary: Coordinate[] = coords.map((coord: number[]) => [coord[0], coord[1]]);
                      return {
                        id: String(feature.properties?.field_id || feature.properties?.id || ''),
                        field_id: feature.properties?.field_id ? String(feature.properties.field_id) : undefined,
                        area_ha: String(feature.properties?.area_ha || 0),
                        boundary: boundary
                      };
                    }).filter((plot: any): plot is {id: string; field_id?: string; area_ha: string; boundary: Coordinate[]} => 
                      plot !== null && plot.boundary && plot.boundary.length > 0
                    );
                    
                    setGeojsonPlots(parsedPlots);
                    console.log(`✅ Loaded ${parsedPlots.length} plots for village: ${selectedVillage}`);
                  } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
                    console.error('Error loading GeoJSON:', err);
                    setError(`Failed to load plots: ${errorMessage}`);
                    setGeojsonPlots([]);
                  } finally {
                    setGeojsonLoading(false);
                  }
                }}
                className={`px-2 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                  geojsonLoading
                    ? 'opacity-50 cursor-not-allowed bg-gray-700 border-gray-600'
                    : geojsonPlots.length > 0
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-black/60 backdrop-blur-sm border border-gray-700 text-gray-300 hover:bg-gray-700'
                }`}
                disabled={geojsonLoading}
                title={geojsonLoading ? 'Loading plots...' : 'Load village boundaries from GeoJSON'}
              >
                {geojsonLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <span>Boundary</span>
                )}
              </button>
            )}
          </div>

          {/* Legend circles only for waterSource and forest; pest uses sidebar cards with click-to-show on map */}
          {activeTab && (activeTab === 'waterSource' || activeTab === 'forest') && (
            <LegendCircles
              type={activeTab}
              data={currentPixelData}
              onForestAgeClassClick={(ageClass, tileUrl, areaHa) => {
                setSelectedForestAgeClass(ageClass);
                setForestTileUrl(tileUrl);
                setForestAreaHa(areaHa);
                setAllPlotsTileUrls({ 'forest': tileUrl });
                setShowTileLayers(true);
              }}
            />
          )}
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          {/* Pest children panel: on map, sized similar to Percentage / Area cards, positioned above year/month series */}
          {activeTab === 'pest' && showPestChildren && selectedPestCategory && pestHierarchy?.hierarchy[selectedPestCategory]?.children && Object.keys(pestHierarchy.hierarchy[selectedPestCategory].children).length > 0 && (
            <div className="absolute bottom-28 left-4 z-[1000] w-[320px] max-w-[calc(100vw-4rem)] px-3 py-2 bg-black/70 backdrop-blur-sm rounded-lg border border-gray-600 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-300 uppercase">
                  {selectedPestCategory.replace(/_/g, ' ')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPestChildren(false)}
                  className="text-xs px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-gray-200"
                >
                  Hide
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(pestHierarchy.hierarchy[selectedPestCategory].children).map(([childKey, child]: [string, PestHierarchyChild]) => (
                  <button
                    key={childKey}
                    type="button"
                    onClick={() => {
                      if (child.tile_url) {
                        setPestTileUrl(child.tile_url);
                        setAllPlotsTileUrls(prev => ({ ...prev, pest: child.tile_url }));
                        setShowTileLayers(true);
                      }
                    }}
                    className="p-2 rounded-lg border border-gray-600 bg-gray-800/90 hover:bg-gray-700 text-left cursor-pointer transition-colors"
                  >
                    <div className="text-sm font-medium text-gray-200 capitalize">{childKey.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{child.pct_of_parent.toFixed(1)}% · {child.area_ha.toFixed(2)} ha</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Controls - Right Side */}
          <div className="absolute top-20 md:top-24 right-4 z-[1000] flex flex-col gap-2">
            {/* Tile Layer Toggle Button */}
            <button
              onClick={() => {
                console.log('👁️ Toggling tile layers, current state:', showTileLayers);
                setShowTileLayers(!showTileLayers);
              }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center ${
                showTileLayers
                  ? 'bg-blue-600 text-white'
                  : 'bg-black/60 backdrop-blur-sm border border-gray-700 text-gray-300 hover:bg-gray-700'
              }`}
              title={showTileLayers ? 'Hide tile layers' : 'Show tile layers'}
            >
              {showTileLayers ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>

          {/* Daily weather line chart (bottom-right) */}
          <div className="absolute bottom-4 right-4 z-[1000] w-[320px] max-w-[calc(100vw-2rem)] bg-black/70 backdrop-blur-sm rounded-lg border border-gray-600 shadow-xl p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Daily Weather</div>
                <div className="text-sm text-gray-100">
                  {weatherDailyData?.name || selectedVillage || selectedSubdistrict || selectedDistrict || '—'}
                  {weatherDailyData?.level ? (
                    <span className="text-xs text-gray-400"> · {String(weatherDailyData.level)}</span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {weatherDailyLoading ? (
                  <div className="text-xs text-gray-400">Loading…</div>
                ) : weatherDailyError ? (
                  <div className="text-xs text-red-300">Failed</div>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowWeatherDaily(!showWeatherDaily)}
                  className="text-[10px] px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-500"
                >
                  {showWeatherDaily ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {showWeatherDaily && (weatherDailyError ? (
              <div className="mt-2 text-xs text-red-300">{weatherDailyError}</div>
            ) : weatherDailyData?.daily?.length ? (
              (() => {
                const days = weatherDailyData.daily.slice(0, 7);
                const tempMax = days.map(d => Number(d.temp_max ?? 0));
                const rainfall = days.map(d => Number(d.rainfall ?? 0));
                const windMax = days.map(d => Number(d.wind_max ?? 0));

                const W = 300;
                const H = 120;
                const P = 18;
                const xStep = days.length > 1 ? (W - P * 2) / (days.length - 1) : 0;

                const scale = (arr: number[]) => {
                  const lo = Math.min(...arr);
                  const hi = Math.max(...arr);
                  return (v: number) => {
                    if (hi === lo) return H / 2;
                    return H - P - ((v - lo) / (hi - lo)) * (H - P * 2);
                  };
                };
                const yTemp = scale(tempMax);
                const yRain = scale(rainfall);
                const yWind = scale(windMax);

                const pts = (arr: number[], yScale: (v: number) => number) =>
                  arr.map((v, i) => `${P + i * xStep},${yScale(v)}`).join(' ');
                const fmtDay = (s: string) => {
                  const parts = (s || '').split('-');
                  return parts.length === 3 ? parts[2] : s;
                };

                return (
                  <div
                    className="mt-2 relative"
                    onMouseLeave={() => setWeatherChartHoverDay(null)}
                  >
                    {weatherChartHoverDay !== null && days[weatherChartHoverDay] && (
                      <div
                        className="absolute z-10 px-2.5 py-2 rounded-lg bg-gray-900 border border-gray-600 shadow-lg text-xs text-left whitespace-nowrap"
                        style={{
                          left: P + weatherChartHoverDay * xStep - 50,
                          bottom: H + 24,
                        }}
                      >
                        <div className="font-semibold text-gray-200 mb-1">{days[weatherChartHoverDay].date}</div>
                        <div className="text-gray-400">temp_max: <span className="text-orange-400">{days[weatherChartHoverDay].temp_max}</span> °C</div>
                        <div className="text-gray-400">rainfall: <span className="text-blue-400">{days[weatherChartHoverDay].rainfall}</span></div>
                        <div className="text-gray-400">wind_max: <span className="text-emerald-400">{days[weatherChartHoverDay].wind_max}</span></div>
                      </div>
                    )}
                    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
                      <line x1={P} y1={P} x2={P} y2={H - P} stroke="rgba(148,163,184,0.25)" />
                      <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="rgba(148,163,184,0.25)" />

                      <polyline points={pts(tempMax, yTemp)} fill="none" stroke="#f97316" strokeWidth="2" />
                      <polyline points={pts(rainfall, yRain)} fill="none" stroke="#3b82f6" strokeWidth="2" />
                      <polyline points={pts(windMax, yWind)} fill="none" stroke="#10b981" strokeWidth="2" />

                      {tempMax.map((v, i) => (
                        <circle key={`tm-${i}`} cx={P + i * xStep} cy={yTemp(v)} r="2.5" fill="#f97316" />
                      ))}
                      {rainfall.map((v, i) => (
                        <circle key={`rf-${i}`} cx={P + i * xStep} cy={yRain(v)} r="2.5" fill="#3b82f6" />
                      ))}
                      {windMax.map((v, i) => (
                        <circle key={`wm-${i}`} cx={P + i * xStep} cy={yWind(v)} r="2.5" fill="#10b981" />
                      ))}

                      {days.map((_, i) => (
                        <rect
                          key={`hover-${i}`}
                          x={Math.max(0, P + (i - 0.5) * xStep)}
                          y={0}
                          width={xStep}
                          height={H}
                          fill="transparent"
                          onMouseEnter={() => setWeatherChartHoverDay(i)}
                        />
                      ))}
                    </svg>

                    <div className="flex justify-between text-[10px] text-gray-400 px-[18px]">
                      {days.map((d, i) => (
                        <span key={`d-${i}`} className="whitespace-nowrap">{fmtDay(d.date)}</span>
                      ))}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-300">
                      <div className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-[#f97316]" />
                        <span>Temp max (°C)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-[#3b82f6]" />
                        <span>Rainfall</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-[#10b981]" />
                        <span>Wind max</span>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="mt-2 text-xs text-gray-400">No daily data</div>
            ))}
          </div>

          {loading && plots.length === 0 ? (
            <div className="h-full w-full flex items-center justify-center bg-gray-900 text-green-500">
              <Loader2 className="animate-spin" size={48} />
            </div>
          ) : (
            <PlotsMap
              plots={plots}
              selectedPlotId={selectedPlotId}
              onSelectPlot={async (id) => {
                setSelectedPlotId(id);
                
                // Find the plot to get coordinates
                const selectedPlot = plots.find(p => p.id === id);
                if (!selectedPlot || !selectedPlot.boundary || selectedPlot.boundary.length === 0) {
                  console.warn('Plot not found or has no boundary:', id);
                  return;
                }
                
                // Extract area_ha from GeoJSON plot if it's from palus1.geojson
                if (geojsonPlots.length > 0 && selectedPlot.area_ha) {
                  const plotArea = parseFloat(selectedPlot.area_ha);
                  if (!isNaN(plotArea) && plotArea > 0) {
                    setSelectedPlotArea(plotArea);
                    console.log(`✅ Selected plot ${id} area: ${plotArea} ha`);
                  } else {
                    setSelectedPlotArea(null);
                  }
                } else {
                  // Clear plot area if not from GeoJSON
                  setSelectedPlotArea(null);
                }
                
                // Calculate center lat/long from boundary coordinates
                // Boundary coordinates are [lng, lat] format
                let sumLng = 0;
                let sumLat = 0;
                selectedPlot.boundary.forEach((coord: Coordinate) => {
                  sumLng += coord[0]; // longitude
                  sumLat += coord[1]; // latitude
                });
                const centerLng = sumLng / selectedPlot.boundary.length;
                const centerLat = sumLat / selectedPlot.boundary.length;
                
                console.log(`Selected plot ${id}, center coordinates: Lat=${centerLat}, Lng=${centerLng}`);
                console.log(`Plot field_id:`, (selectedPlot as any).field_id);
                
                // Fetch ET and Weather data
                // Note: ET API uses lat=longitude, lon=latitude (reversed)
                // Weather API uses lat=latitude, lon=longitude (correct)
                try {
                  setEtWeatherLoading(true);
                  setError(null);
                  
                  // Fetch both ET and Weather in parallel
                  // ET API expects: lat=longitude, lon=latitude (backwards)
                  // Weather API expects: lat=latitude, lon=longitude (correct)
                  const [etResponse, weatherResponse] = await Promise.all([
                    fetchET(centerLng, centerLat), // ET: lat=longitude, lon=latitude
                    fetchWeather(centerLat, centerLng) // Weather: lat=latitude, lon=longitude
                  ]);
                  
                  setEtData(etResponse);
                  setWeatherData(weatherResponse);
                  
                  console.log('ET Data:', etResponse);
                  console.log('Weather Data:', weatherResponse);
                } catch (err) {
                  const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
                  console.error('Error loading ET/Weather data:', err);
                  setError(`Failed to load ET/Weather: ${errorMessage}`);
                  setEtData(null);
                  setWeatherData(null);
                } finally {
                  setEtWeatherLoading(false);
                }
              }}
              etData={etData}
              weatherData={weatherData}
              etWeatherLoading={etWeatherLoading}
              tileUrl={pestTileUrl || forestTileUrl || methaneTileUrl || lstTileUrl || cropTileUrl || tileUrl}
              plotBounds={plotBounds}
              allPlotsTileUrls={allPlotsTileUrls}
              showTileLayers={showTileLayers}
              waterSources={waterSources}
              onSelectWaterSource={(id, data) => {
                setSelectedWaterSource(id);
                // Show alert with all data
                alert(
                  `Water Source: ${id}\n` +
                  `Water Percentage: ${data.water_pixel_percentage.toFixed(2)}%\n` +
                  `Tile URL: ${data.tile_url}\n` +
                  `Coordinates: ${JSON.stringify(data.coordinates).substring(0, 100)}...`
                );
              }}
            />
          )}

          {/* Pest stored year-month series tabs (bottom-left when Pest tab active) */}
          {activeTab === 'pest' && pestStoredSeries && pestStoredSeries.length > 0 && (
            <div className="absolute bottom-4 left-4 z-[1000] max-w-[calc(100vw-6rem)] bg-black/70 backdrop-blur-sm rounded-lg border border-gray-600 shadow-xl px-3 py-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Year / Month Series
                </div>
                {pestStoredLoading && (
                  <div className="text-[10px] text-gray-400">Loading…</div>
                )}
              </div>
              {pestStoredError ? (
                <div className="text-[10px] text-red-300">{pestStoredError}</div>
              ) : (
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {pestStoredSeries.map((item: PestStoredItem, idx: number) => (
                    <button
                      key={`${item.year_month}-${idx}`}
                      type="button"
                      onClick={() => setSelectedPestYearMonth(item.year_month)}
                      className={`px-2 py-0.5 rounded-full text-[10px] border ${
                        selectedPestYearMonth === item.year_month
                          ? 'bg-emerald-500/80 border-emerald-400 text-black'
                          : 'bg-gray-800/80 border-gray-600 text-gray-200 hover:bg-gray-700'
                      }`}
                    >
                      {item.year_month}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export { App };
export default App;
