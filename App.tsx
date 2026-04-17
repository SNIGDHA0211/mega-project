import React, { useState, useEffect, useRef, useCallback } from 'react';
import PlotsMap from './components/PlotsMap';
import LegendCircles, { AnalysisType } from './components/LegendCircles';
import { LoginPage } from './components/LoginPage';
import { 
  fetchDistricts, 
  fetchSubdistricts, 
  fetchVillages,
  fetchBoundaryGeoJSON, 
  fetchFieldBoundaries,
  fetchPredictArea,
  type PredictAreaCropData,
  fetchGrowthAnalysis1,
  fetchWaterUptakeAnalysis,
  fetchSoilMoistureAnalysis,
  fetchPestDetectionAnalysis,
  fetchNDWIDetection,
  fetchLandSurfaceTemperature,
  fetchForestCanopy,
  fetchET,
  fetchWeather,
  fetchPestStoredSeries,
  fetchDashboardIndicesStore,
  fetchWeatherDaily,
  fetchWindDirect,
  GrowthAnalysisResponse,
  type DashboardIndicesStoreResponse,
  type DashboardIndicesFrequency,
  GrowthAnalysisWithStoredResponse,
  GrowthStoredResponse,
  GrowthStoredItem,
  NDWIDetectionResponse,
  ETResponse,
  WeatherResponse,
  WeatherDailyResponse,
  WindDirectResponse,
  PestHierarchyResponse,
  PestHierarchyChild,
  PestStoredResponse,
  PestStoredItem
} from './services/analysisService';
import { Coordinate } from './types';
import { Loader2, AlertCircle, Layers, Home, LogOut, Eye, EyeOff, Sprout, Droplets, Droplet, Bug, Waves, Trees, Wind, Thermometer, LineChart as LineChartIcon, BarChart3, Download, FileText, FileSpreadsheet, ChevronLeft, ChevronRight, Columns, Maximize2, ChevronUp, ChevronDown, Move, TrendingUp } from 'lucide-react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, BarChart, Bar } from 'recharts';
import { generateDashboardIndicesPdf } from './utils/dashboardIndicesPdf';
import { appendPdfBrandedHeader } from './utils/pdfReportHeader';
import { captureElementForPdf } from './utils/pdfExportCapture';
import {
  DASHBOARD_INDEX_ORDER,
  DASHBOARD_INDEX_LABELS,
  DASHBOARD_INDEX_CARD_COLORS_HEX,
  type DashboardIndexKey,
} from './utils/dashboardIndicesConfig';
import { MdFullscreen, MdFullscreenExit, MdModeNight, MdLightMode } from 'react-icons/md';
// GiUpgrade icon removed (no auto-open pest)

/** Merged into allPlotsTileUrls when user clicks a Water Uptake %/area card (classwise tile_url); drawn on top in PlotsMap */
const WATER_UPTAKE_CLASS_TILE_KEY = 'waterUptakeClass';

/** One color per calendar year for weekly/monthly multi-line indices charts (14+ distinct hues). */
const INDICES_CHART_YEAR_PALETTE = [
  '#22c55e', '#3b82f6', '#f97316', '#a855f7', '#e11d48', '#10b981', '#facc15', '#6366f1', '#14b8a6', '#ef4444',
  '#06b6d4', '#fb7185', '#84cc16', '#c084fc', '#fde047', '#f472b6',
];

/** Build Leaflet tile URL map from wateruptakeclasswise classwise[] (each class may have tile_url). */
function waterClasswiseToTileUrlMap(classwise: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(classwise)) return out;
  classwise.forEach((c: any) => {
    const url = c?.tile_url;
    if (!url || typeof url !== 'string' || !url.includes('earthengine.googleapis.com')) return;
    const id = c.class_id != null ? String(c.class_id) : String(c.class_name || 'class').replace(/\s+/g, '-');
    out[`wu-${id}`] = url.trim();
  });
  return out;
}

// Local Graph icon component (acts like GoGraph from react-icons/go)
const GoGraph: React.FC<{ size?: number; className?: string }> = ({ size = 18, className }) => (
  <LineChartIcon size={size} className={className} />
);
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
  /** When true, village boundary is shown on map (user must click "Display boundary") */
  const [showVillageBoundary, setShowVillageBoundary] = useState(false);
  const [showLeftVillageBoundary, setShowLeftVillageBoundary] = useState(false);
  const [showRightVillageBoundary, setShowRightVillageBoundary] = useState(false);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [availablePlots, setAvailablePlots] = useState<string[]>([]);
  const [totalPlotsCount, setTotalPlotsCount] = useState<number>(0);

  // State for analysis
  const [activeTab, setActiveTab] = useState<AnalysisType | null>(null); // Start with no tab selected - data only loads when tab is clicked
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // State for all plots in selected taluka
  const [allPlots, setAllPlots] = useState<Array<{id: string; area_ha: string; boundary: Coordinate[]}>>([]);
  
  // State for plots in split screen mode (left and right sides)
  const [leftAllPlots, setLeftAllPlots] = useState<Array<{id: string; area_ha: string; boundary: Coordinate[]}>>([]);
  const [rightAllPlots, setRightAllPlots] = useState<Array<{id: string; area_ha: string; boundary: Coordinate[]}>>([]);

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
  
  
  // State for GeoJSON plots (e.g. from boundary load; currently unused)
  const [geojsonPlots, setGeojsonPlots] = useState<Array<{id: string; field_id?: string; area_ha: string; boundary: Coordinate[]}>>([]);
  const [geojsonLoading, setGeojsonLoading] = useState<boolean>(false);

  // Predict-area (crop): color and field_area_ha per field_id when crop + village selected
  const [predictAreaCropColor, setPredictAreaCropColor] = useState<string | null>(null);
  const [predictAreaFieldAreas, setPredictAreaFieldAreas] = useState<Record<string, number>>({});
  const [predictSugarcaneAreaHa, setPredictSugarcaneAreaHa] = useState<number | null>(null);
  const [predictSugarcaneAreaLoading, setPredictSugarcaneAreaLoading] = useState<boolean>(false);
  
  // State for ET and Weather data
  const [etData, setEtData] = useState<ETResponse | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherResponse | null>(null);
  const [etWeatherLoading, setEtWeatherLoading] = useState<boolean>(false);

  // State for Daily Weather (district/subdistrict/village)
  const [weatherDailyData, setWeatherDailyData] = useState<WeatherDailyResponse | null>(null);
  const [weatherDailyLoading, setWeatherDailyLoading] = useState<boolean>(false);
  const [weatherDailyError, setWeatherDailyError] = useState<string | null>(null);
  const [weatherChartHoverDay, setWeatherChartHoverDay] = useState<number | null>(null);
  // Weather card is opened from the rain icon, so start hidden
  const [showWeatherDaily, setShowWeatherDaily] = useState<boolean>(false);

  // State for Daily Weather in split screen mode (left and right sides)
  const [leftWeatherDailyData, setLeftWeatherDailyData] = useState<WeatherDailyResponse | null>(null);
  const [leftWeatherDailyLoading, setLeftWeatherDailyLoading] = useState<boolean>(false);
  const [leftWeatherDailyError, setLeftWeatherDailyError] = useState<string | null>(null);
  const [leftWeatherChartHoverDay, setLeftWeatherChartHoverDay] = useState<number | null>(null);
  const [rightWeatherDailyData, setRightWeatherDailyData] = useState<WeatherDailyResponse | null>(null);
  const [rightWeatherDailyLoading, setRightWeatherDailyLoading] = useState<boolean>(false);
  const [rightWeatherDailyError, setRightWeatherDailyError] = useState<string | null>(null);
  const [rightWeatherChartHoverDay, setRightWeatherChartHoverDay] = useState<number | null>(null);

  // Wind AOI (district / subdistrict / village) â€” same selection as daily weather
  const [windDirectData, setWindDirectData] = useState<WindDirectResponse | null>(null);
  /** Toggle animated wind particles + speed markers on the main map (Open-Meteo AOI). */
  const [showWindFlowLayer, setShowWindFlowLayer] = useState<boolean>(false);

  // State for Pest stored time series (year_month tabs)
  const [pestStoredSeries, setPestStoredSeries] = useState<PestStoredResponse | null>(null);
  const [pestStoredLoading, setPestStoredLoading] = useState<boolean>(false);
  const [pestStoredError, setPestStoredError] = useState<string | null>(null);
  const [selectedPestYearMonth, setSelectedPestYearMonth] = useState<string | null>(null);
  const [showPestSeries, setShowPestSeries] = useState<boolean>(true);
  const [selectedPestChildSeries, setSelectedPestChildSeries] = useState<string | null>(null);
  const [showAllTimeSeries, setShowAllTimeSeries] = useState<boolean>(false);

  // Shared time series selection across Growth, Water, Soil, Pest (null = "Current" for growth/water/soil)
  const [selectedTimeSeriesYearMonth, setSelectedTimeSeriesYearMonth] = useState<string | null>(null);

  // State for Growth stored time series (year_month from analyze_Growthclasswise response.stored)
  const [growthStoredSeries, setGrowthStoredSeries] = useState<GrowthStoredResponse | null>(null);
  const [growthStoredLoading, setGrowthStoredLoading] = useState<boolean>(false);
  const [growthStoredError, setGrowthStoredError] = useState<string | null>(null);
  const [growthCurrentData, setGrowthCurrentData] = useState<any>(null); // current snapshot for "Current" tab
  const [selectedGrowthYearMonth, setSelectedGrowthYearMonth] = useState<string | null>(null);
  const [showGrowthSeries, setShowGrowthSeries] = useState<boolean>(true);
  const [showAllGrowthTimeSeries, setShowAllGrowthTimeSeries] = useState<boolean>(false);
  const [growthChartViewMode, setGrowthChartViewMode] = useState<'all' | 'selected'>('selected');
  const [waterChartViewMode, setWaterChartViewMode] = useState<'all' | 'selected'>('selected');
  const [soilChartViewMode, setSoilChartViewMode] = useState<'all' | 'selected'>('selected');
  const [pestChartViewMode, setPestChartViewMode] = useState<'all' | 'selected'>('selected');

  // State for Water/Soil stored time series (year_month from analyze_wateruptakeclasswise / analyze_soilmoistureclasswise)
  const [waterStoredSeries, setWaterStoredSeries] = useState<GrowthStoredResponse | null>(null);
  const [soilStoredSeries, setSoilStoredSeries] = useState<GrowthStoredResponse | null>(null);
  const [selectedWaterYearMonth, setSelectedWaterYearMonth] = useState<string | null>(null);
  /** Latest POST wateruptakeclasswise "current" snapshot (classwise includes per-class tile_url). */
  const [waterCurrentSnapshot, setWaterCurrentSnapshot] = useState<Record<string, unknown> | null>(null);
  const [selectedSoilYearMonth, setSelectedSoilYearMonth] = useState<string | null>(null);

  // Dashboard indices store (frequency dropdown: weekly | monthly | yearly; indices dropdown from API)
  const [dashboardIndicesData, setDashboardIndicesData] = useState<DashboardIndicesStoreResponse | null>(null);
  const [dashboardIndicesLoading, setDashboardIndicesLoading] = useState<boolean>(false);
  const [dashboardIndicesError, setDashboardIndicesError] = useState<string | null>(null);
  const [dashboardIndicesFrequency, setDashboardIndicesFrequency] = useState<DashboardIndicesFrequency | ''>('');
  const [selectedDashboardIndex, setSelectedDashboardIndex] = useState<string | null>(null);
  /** Weekly/monthly: null = all lines equal weight; string = emphasize that year's colored line, dim others (all years still drawn). */
  const [indicesLegendHighlightedYear, setIndicesLegendHighlightedYear] = useState<string | null>(null);

  const toggleIndicesYearHighlight = useCallback((yearKey: string) => {
    setIndicesLegendHighlightedYear((prev) => (prev === yearKey ? null : yearKey));
  }, []);

  const clearIndicesYearHighlight = useCallback(() => {
    setIndicesLegendHighlightedYear(null);
  }, []);

  // State for pest graph size (normal screen)
  const [pestGraphSize, setPestGraphSize] = useState<{ width: number; height: number }>({ width: 800, height: 300 });

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
  const [leftShowPestChildren, setLeftShowPestChildren] = useState<boolean>(false);
  const [rightShowPestChildren, setRightShowPestChildren] = useState<boolean>(false);

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
  const [showGraphPage, setShowGraphPage] = useState<boolean>(false);
  const [showAnalysisTrendsPage, setShowAnalysisTrendsPage] = useState<boolean>(false);
  const [showGraphFrequencyDropdown, setShowGraphFrequencyDropdown] = useState<boolean>(false);
  const [isMapFullscreen, setIsMapFullScreen] = useState<boolean>(false);
  /** Indices graph fullscreen: chart opened via icon vs chart chosen in toolbar dropdown (compare). */
  const [fullscreenIndicesOpenedFrom, setFullscreenIndicesOpenedFrom] = useState<DashboardIndexKey | null>(null);
  const [fullscreenIndicesCompare, setFullscreenIndicesCompare] = useState<DashboardIndexKey | null>(null);
  const [fullscreenAnalysisTrendCard, setFullscreenAnalysisTrendCard] = useState<string | null>(null);
  const [analysisTrendSeriesFilter, setAnalysisTrendSeriesFilter] = useState<Record<string, string | null>>({});
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('ui-theme-mode');
      // Default to light theme (white UI) when nothing is saved yet
      return saved === 'dark';
    }
    return false;
  });
  // State for sidebar expanded (full dropdowns + %/area) vs collapsed (icon-only); double-click toggles
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(false);
  // Which icon card is shown next to left sidebar (click icon = show card beside it, not full sidebar)
  type SidebarIconCard = 'none' | 'totalArea' | 'district' | 'subdistrict' | 'village' | 'percentage';
  const [sidebarIconCard, setSidebarIconCard] = useState<SidebarIconCard>('none');
  const [rightSidebarExpanded, setRightSidebarExpanded] = useState<boolean>(false);
  // Flyout panel beside icon strip: click D/S/V/Total/% opens only that section to the side (no full sidebar)
  type SidebarPanel = 'none' | 'district' | 'subdistrict' | 'village' | 'totalarea' | 'percentage';
  const [leftSidebarPanel, setLeftSidebarPanel] = useState<SidebarPanel>('none');
  const [rightSidebarPanel, setRightSidebarPanel] = useState<SidebarPanel>('none');

  // State for download menu
  const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false);
  const [showDashboardIndicesDownloadMenu, setShowDashboardIndicesDownloadMenu] = useState<boolean>(false);

  // State for split screen mode
  const [splitScreenMode, setSplitScreenMode] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('ui-theme-mode', isDarkMode ? 'dark' : 'light');
    }
  }, [isDarkMode]);

  // When switching to graph mode, reset scroll so sidebar + graph area are visible.
  useEffect(() => {
    if (!showGraphPage && !showAnalysisTrendsPage) return;
    // Run after layout so overflow-y containers have correct scrollHeight.
    const t = window.setTimeout(() => {
      try {
        sidebarScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      } catch {
        // ignore
      }
      try {
        mainScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      } catch {
        // ignore
      }
      try {
        window.scrollTo({ top: 0, behavior: 'auto' });
      } catch {
        window.scrollTo(0, 0);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [showGraphPage, showAnalysisTrendsPage]);

  // Separate state for left and right sides in split screen mode - Location selections
  const [leftSelectedDistrict, setLeftSelectedDistrict] = useState<string>('');
  const [leftSelectedSubdistrict, setLeftSelectedSubdistrict] = useState<string>('');
  const [leftSelectedVillage, setLeftSelectedVillage] = useState<string>('');
  const [leftSubdistricts, setLeftSubdistricts] = useState<Array<{subdistrict: string; geometry?: any}>>([]);
  const [leftVillages, setLeftVillages] = useState<Array<{village: string; geom_type?: string; coordinates?: any; geometry?: any}>>([]);
  const [leftTotalAreaHectares, setLeftTotalAreaHectares] = useState<number | null>(null);
  const [leftTotalAreaLoading, setLeftTotalAreaLoading] = useState<boolean>(false);
  const [leftAllPlotsAnalysisData, setLeftAllPlotsAnalysisData] = useState<{
    growth: any;
    water: any;
    soil: any;
    pest: any;
    waterSource: any;
  } | null>(null);
  const [leftLoading, setLeftLoading] = useState<boolean>(false);
  const [leftError, setLeftError] = useState<string | null>(null);

  const [rightSelectedDistrict, setRightSelectedDistrict] = useState<string>('');
  const [rightSelectedSubdistrict, setRightSelectedSubdistrict] = useState<string>('');
  const [rightSelectedVillage, setRightSelectedVillage] = useState<string>('');
  const [rightSubdistricts, setRightSubdistricts] = useState<Array<{subdistrict: string; geometry?: any}>>([]);
  const [rightVillages, setRightVillages] = useState<Array<{village: string; geom_type?: string; coordinates?: any; geometry?: any}>>([]);
  const [rightTotalAreaHectares, setRightTotalAreaHectares] = useState<number | null>(null);
  const [rightTotalAreaLoading, setRightTotalAreaLoading] = useState<boolean>(false);
  const [rightAllPlotsAnalysisData, setRightAllPlotsAnalysisData] = useState<{
    growth: any;
    water: any;
    soil: any;
    pest: any;
    waterSource: any;
  } | null>(null);
  const [rightLoading, setRightLoading] = useState<boolean>(false);
  const [rightError, setRightError] = useState<string | null>(null);

  // Separate state for left and right sides in split screen mode - Tabs
  const [leftActiveTab, setLeftActiveTab] = useState<AnalysisType | null>(null);
  const [rightActiveTab, setRightActiveTab] = useState<AnalysisType | null>(null);
  const [leftShowPestSeries, setLeftShowPestSeries] = useState<boolean>(true);
  const [rightShowPestSeries, setRightShowPestSeries] = useState<boolean>(true);
  const [leftShowWeatherDaily, setLeftShowWeatherDaily] = useState<boolean>(false);
  const [rightShowWeatherDaily, setRightShowWeatherDaily] = useState<boolean>(false);
  const [leftSelectedPestYearMonth, setLeftSelectedPestYearMonth] = useState<string | null>(null);
  const [rightSelectedPestYearMonth, setRightSelectedPestYearMonth] = useState<string | null>(null);
  const [leftShowTileLayers, setLeftShowTileLayers] = useState<boolean>(true);
  const [rightShowTileLayers, setRightShowTileLayers] = useState<boolean>(true);
  const [leftAllPlotsTileUrls, setLeftAllPlotsTileUrls] = useState<Record<string, string>>({});
  const [rightAllPlotsTileUrls, setRightAllPlotsTileUrls] = useState<Record<string, string>>({});
  const [leftSelectedPestCategory, setLeftSelectedPestCategory] = useState<string | null>(null);
  const [rightSelectedPestCategory, setRightSelectedPestCategory] = useState<string | null>(null);
  const [leftShowAllTimeSeries, setLeftShowAllTimeSeries] = useState<boolean>(false);
  const [rightShowAllTimeSeries, setRightShowAllTimeSeries] = useState<boolean>(false);
  // Refs for drag-to-resize pest card via arrow icon (no dropdown)
  const pestResizeSourceRef = useRef<'left' | 'right' | null>(null);
  const pestResizeStartRef = useRef({ x: 0, y: 0 });
  const pestResizeAccumRef = useRef({ x: 0, y: 0 });
  const PEST_RESIZE_STEP = 18;
  // Draggable card positions (px from bottom-left); null = use default CSS position
  const [pestCardPosition, setPestCardPosition] = useState<{ left: number; bottom: number } | null>(null);
  const [weatherCardPosition, setWeatherCardPosition] = useState<{ left: number; bottom: number } | null>(null);
  const pestDragStartRef = useRef<{ x: number; y: number; left: number; bottom: number } | null>(null);
  const weatherDragStartRef = useRef<{ x: number; y: number; left: number; bottom: number } | null>(null);
  const bottomCardsRef = useRef<HTMLDivElement | null>(null);
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottomCards = () => {
    // Let React paint the card content before scrolling.
    window.requestAnimationFrame(() => {
      bottomCardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const lstClosedByUserRef = useRef(false);

  // State for Pest stored time series for left and right sides (split screen mode)
  const [leftPestStoredSeries, setLeftPestStoredSeries] = useState<PestStoredResponse | null>(null);
  const [leftPestStoredLoading, setLeftPestStoredLoading] = useState<boolean>(false);
  const [leftPestStoredError, setLeftPestStoredError] = useState<string | null>(null);
  const [rightPestStoredSeries, setRightPestStoredSeries] = useState<PestStoredResponse | null>(null);
  const [rightPestStoredLoading, setRightPestStoredLoading] = useState<boolean>(false);
  const [rightPestStoredError, setRightPestStoredError] = useState<string | null>(null);

  // Helper to get active tab based on split screen mode
  const getActiveTab = (side: 'left' | 'right' = 'left') => {
    if (!splitScreenMode) return activeTab;
    return side === 'left' ? leftActiveTab : rightActiveTab;
  };

  // Helper to set active tab based on split screen mode
  const setActiveTabForSide = (tab: AnalysisType | null, side: 'left' | 'right' = 'left') => {
    if (!splitScreenMode) {
      setActiveTab(tab);
    } else {
      if (side === 'left') {
        setLeftActiveTab(tab);
      } else {
        setRightActiveTab(tab);
      }
    }
  };

  const toggleActiveTabForSide = (tab: AnalysisType, side: 'left' | 'right' = 'left') => {
    if (getActiveTab(side) === tab) setActiveTabForSide(null, side);
    else setActiveTabForSide(tab, side);
  };

  const clearLstTileLayer = () => {
    lstClosedByUserRef.current = true;
    setLstTileUrl(null);
    setAllPlotsTileUrls((prev) => {
      const n = { ...prev };
      delete n['land-surface-temperature'];
      return n;
    });
    if (splitScreenMode) {
      setRightAllPlotsTileUrls((prev) => {
        const n = { ...prev };
        delete n['land-surface-temperature'];
        return n;
      });
    }
  };

  // Helper to get location selections based on side
  const getSelectedDistrict = (side: 'left' | 'right' = 'left') => {
    if (!splitScreenMode) return selectedDistrict;
    return side === 'left' ? leftSelectedDistrict : rightSelectedDistrict;
  };

  const getSelectedSubdistrict = (side: 'left' | 'right' = 'left') => {
    if (!splitScreenMode) return selectedSubdistrict;
    return side === 'left' ? leftSelectedSubdistrict : rightSelectedSubdistrict;
  };

  const getSelectedVillage = (side: 'left' | 'right' = 'left') => {
    if (!splitScreenMode) return selectedVillage;
    return side === 'left' ? leftSelectedVillage : rightSelectedVillage;
  };

  const getSubdistricts = (side: 'left' | 'right' = 'left') => {
    if (!splitScreenMode) return subdistricts;
    return side === 'left' ? leftSubdistricts : rightSubdistricts;
  };

  const getVillages = (side: 'left' | 'right' = 'left') => {
    if (!splitScreenMode) return villages;
    return side === 'left' ? leftVillages : rightVillages;
  };

  const getTotalAreaHectares = (side: 'left' | 'right' = 'left') => {
    if (!splitScreenMode) return totalAreaHectares;
    return side === 'left' ? leftTotalAreaHectares : rightTotalAreaHectares;
  };

  const getTotalAreaLoading = (side: 'left' | 'right' = 'left') => {
    if (!splitScreenMode) return totalAreaLoading;
    return side === 'left' ? leftTotalAreaLoading : rightTotalAreaLoading;
  };

  const getAllPlotsAnalysisData = (side: 'left' | 'right' = 'left') => {
    if (!splitScreenMode) return allPlotsAnalysisData;
    return side === 'left' ? leftAllPlotsAnalysisData : rightAllPlotsAnalysisData;
  };

  const getLoading = (side: 'left' | 'right' = 'left') => {
    if (!splitScreenMode) return loading;
    return side === 'left' ? leftLoading : rightLoading;
  };

  const getError = (side: 'left' | 'right' = 'left') => {
    if (!splitScreenMode) return error;
    return side === 'left' ? leftError : rightError;
  };

  useEffect(() => {
    const t = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
    return () => window.clearTimeout(t);
  }, [isMapFullscreen]);

  // Ref for time series scrollable container
  const timeSeriesScrollRef = useRef<HTMLDivElement>(null);
  const rightTimeSeriesScrollRef = useRef<HTMLDivElement>(null);

  // State for background images
  const [currentBgImageIndex, setCurrentBgImageIndex] = useState<number>(0);
  const backgroundImages = [
    '/images/Grapes.webp',
    '/images/kapus-kapas_cover_image.png',
    '/images/onion.jpg',
    '/images/weeds.jpg'
  ];

  // Download functions
  const getLocationString = () => {
    const parts = [];
    if (selectedPlotId) parts.push(`Field/Plot ID: ${selectedPlotId}`);
    if (selectedVillage) parts.push(`Village: ${selectedVillage}`);
    if (selectedSubdistrict) parts.push(`Subdistrict: ${selectedSubdistrict}`);
    if (selectedDistrict) parts.push(`District: ${selectedDistrict}`);
    return parts.length > 0 ? parts.join(', ') : 'No location selected';
  };

  // Helper function to add wrapped text to PDF - ensures full text display without truncation
  const addWrappedText = (pdf: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number = 6, pageMargin: number = 10): number => {
    // Use full content width minus small margin for better text wrapping
    const textWidth = maxWidth - 2; // Small margin for better wrapping
    const lines = pdf.splitTextToSize(text, textWidth);
    lines.forEach((line: string) => {
      // Check if we need a new page before adding text
      if (y > pdf.internal.pageSize.getHeight() - pageMargin - lineHeight) {
        pdf.addPage();
        y = pageMargin;
      }
      pdf.text(line, x, y);
      y += lineHeight;
    });
    return y;
  };

  const downloadChartPDF = async () => {
    try {
      const weatherElement = document.getElementById('weather-daily-chart');
      const exportTab = splitScreenMode ? leftActiveTab : activeTab;

      let graphElement: HTMLElement | null = null;
      if (showGraphPage) {
        graphElement = document.getElementById('indices/retrieve-aggregated-cards');
      } else if (showAnalysisTrendsPage) {
        graphElement = document.getElementById('analysis-trends-cards');
      }
      if (!graphElement) {
        graphElement =
          document.getElementById('health-trends-chart') ||
          document.getElementById('pest-time-series-graph') ||
          document.getElementById('pest-time-series-graph-right');
      }

      if (!graphElement) {
        alert(
          'Chart not found. For the indices dashboard, open the line-chart icon and wait for data to load. For map analysis, open Growth, Water, Soil, or Pest and scroll so the graph below the map is visible, then try again.'
        );
        return;
      }

      const isIndicesDashboard = graphElement.id === 'indices/retrieve-aggregated-cards';

      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = 297; // A4 landscape width in mm
      const pageHeight = 210; // A4 landscape height in mm
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;

      let yPos = margin;
      yPos = await appendPdfBrandedHeader(pdf, pageWidth, margin, yPos);

      // Location & view (below header rule)
      yPos = addWrappedText(pdf, getLocationString(), margin, yPos, contentWidth, 5.5, margin);
      yPos += 2;

      if (isIndicesDashboard) {
        yPos = addWrappedText(
          pdf,
          `Indices dashboard Â· Frequency: ${dashboardIndicesFrequency || 'â€”'} Â· spectral, weather, and soil metrics (NDVI, EVI, LST, precipitation, NDWI, radar, etc.)`,
          margin,
          yPos,
          contentWidth,
          5.5,
          margin
        );
        yPos += 2;
      } else {
        const pestCat = splitScreenMode ? leftSelectedPestCategory : selectedPestCategory;
        if (exportTab === 'pest' && pestCat) {
          yPos = addWrappedText(pdf, `Pest: ${pestCat.replace(/_/g, ' ')}`, margin, yPos, contentWidth, 6, margin);
          yPos += 2;
        } else if (exportTab) {
          yPos = addWrappedText(
            pdf,
            `View: ${String(exportTab).replace(/_/g, ' ')}`,
            margin,
            yPos,
            contentWidth,
            6,
            margin
          );
          yPos += 2;
        }
      }
      
      // Capture chart(s). Indices: rasterize each 6-card chunk separately (stable PDF pages).
      const indicesChunkEls: HTMLElement[] = [];
      for (let i = 0; i < 32; i++) {
        const el = document.getElementById(`indices/retrieve-aggregated-chunk-${i}`);
        if (!el) break;
        indicesChunkEls.push(el as HTMLElement);
      }

      const appendCanvasToPdf = (
        canvas: HTMLCanvasElement,
        startYmm: number,
        openWithNewPage: boolean
      ): number => {
        if (openWithNewPage) {
          pdf.addPage();
          startYmm = margin;
        }
        const chartImgDataUrl = canvas.toDataURL('image/png');
        const chartImgHeight = (canvas.height * contentWidth) / canvas.width;
        const maxChartHeight = pageHeight - startYmm - margin;
        const pxPerMmVert = canvas.height / chartImgHeight;

        if (chartImgHeight > maxChartHeight + 1) {
          let remainingMm = chartImgHeight;
          let imgDrawY = startYmm;
          while (remainingMm > 0.5) {
            if (imgDrawY > pageHeight - margin - 8) {
              pdf.addPage();
              imgDrawY = margin;
            }
            const pageAvail = Math.max(0, pageHeight - imgDrawY - margin - 0.35);
            const sliceMm = Math.min(remainingMm, pageAvail);
            const consumedMm = chartImgHeight - remainingMm;
            const srcY = consumedMm * pxPerMmVert;
            const srcH = sliceMm * pxPerMmVert;
            const sy = Math.max(0, Math.floor(srcY));
            const sh = Math.min(Math.max(1, Math.ceil(srcH)), canvas.height - sy);
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = sh;
            const ctx = sliceCanvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
              ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
            }
            pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, imgDrawY, contentWidth, sliceMm);
            remainingMm -= sliceMm;
            imgDrawY += sliceMm;
          }
          return imgDrawY + 8;
        }
        const actualChartHeight = Math.min(chartImgHeight, maxChartHeight);
        pdf.addImage(chartImgDataUrl, 'PNG', margin, startYmm, contentWidth, actualChartHeight);
        return startYmm + actualChartHeight + 8;
      };

      if (isIndicesDashboard && indicesChunkEls.length > 0) {
        for (let i = 0; i < indicesChunkEls.length; i++) {
          const c = await captureElementForPdf(indicesChunkEls[i], { indicesGrid: true });
          yPos = appendCanvasToPdf(c, i === 0 ? yPos : margin, i > 0);
        }
      } else {
        const chartCanvas = await captureElementForPdf(graphElement, {
          indicesGrid: isIndicesDashboard,
        });
        const chartImgData = chartCanvas.toDataURL('image/png');
        const chartImgHeight = (chartCanvas.height * contentWidth) / chartCanvas.width;
        const maxChartHeight = pageHeight - yPos - margin;
        const pxPerMmVert = chartCanvas.height / chartImgHeight;

        if (isIndicesDashboard && chartImgHeight > maxChartHeight + 1) {
          let remainingMm = chartImgHeight;
          let imgDrawY = yPos;
          while (remainingMm > 0.5) {
            if (imgDrawY > pageHeight - margin - 8) {
              pdf.addPage();
              imgDrawY = margin;
            }
            const pageAvail = Math.max(0, pageHeight - imgDrawY - margin - 0.35);
            const sliceMm = Math.min(remainingMm, pageAvail);
            const consumedMm = chartImgHeight - remainingMm;
            const srcY = consumedMm * pxPerMmVert;
            const srcH = sliceMm * pxPerMmVert;
            const sy = Math.max(0, Math.floor(srcY));
            const sh = Math.min(Math.max(1, Math.ceil(srcH)), chartCanvas.height - sy);
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = chartCanvas.width;
            sliceCanvas.height = sh;
            const ctx = sliceCanvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
              ctx.drawImage(chartCanvas, 0, sy, chartCanvas.width, sh, 0, 0, chartCanvas.width, sh);
            }
            pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, imgDrawY, contentWidth, sliceMm);
            remainingMm -= sliceMm;
            imgDrawY += sliceMm;
          }
          yPos = imgDrawY + 8;
        } else {
          const actualChartHeight = Math.min(chartImgHeight, maxChartHeight);
          pdf.addImage(chartImgData, 'PNG', margin, yPos, contentWidth, actualChartHeight);
          yPos += actualChartHeight + 8;
        }
      }
      
      // Add weather graph if available
      if (weatherElement && showWeatherDaily && weatherDailyData?.daily?.length) {
        // Check if we need a new page - leave more space for text
        if (yPos > pageHeight - 100) {
          pdf.addPage();
          yPos = margin;
        }
        
        // Add weather section title
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Daily Weather Data', margin, yPos);
        yPos += 8;
        
        // Capture weather chart
        const weatherCanvas = await captureElementForPdf(weatherElement, {});
        const weatherImgData = weatherCanvas.toDataURL('image/png');
        const weatherImgHeight = (weatherCanvas.height * contentWidth) / weatherCanvas.width;
        
        // Add weather graph - ensure it doesn't push content off page, leave space for text
        const maxWeatherHeight = pageHeight - yPos - 30; // Leave 30mm for bottom margin and any text
        pdf.addImage(weatherImgData, 'PNG', margin, yPos, contentWidth, Math.min(weatherImgHeight, maxWeatherHeight));
      }
      
      const fileSlug = isIndicesDashboard
        ? `indices-${dashboardIndicesFrequency || 'unset'}`
        : exportTab === 'pest' && (splitScreenMode ? leftSelectedPestCategory : selectedPestCategory)
          ? (splitScreenMode ? leftSelectedPestCategory : selectedPestCategory) || 'data'
          : exportTab || 'chart';
      pdf.save(`nearlive-crop-monitoring-${fileSlug}-${Date.now()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    }
  };

  const downloadPestTimeSeriesExcel = (series: PestStoredResponse | null, category: string | null) => {
    if (!series || !category) {
      alert('No pest time series data. Select a pest category and load stored months.');
      return;
    }
    const filtered = series
      .filter((item: PestStoredItem) => {
        const h = (item as any).response_data?.hierarchy || {};
        return h[category];
      })
      .sort((a: PestStoredItem, b: PestStoredItem) => a.year_month.localeCompare(b.year_month));

    if (!filtered.length) {
      alert('No rows to export for this category.');
      return;
    }

    const labels = filtered.map(s => s.year_month);
    const areaValues = filtered.map(s => {
      const h = (s as any).response_data?.hierarchy?.[category] || {};
      return Number(h.total_area_ha ?? 0);
    });

    const firstCategory: any = (filtered[0] as any).response_data?.hierarchy?.[category] || {};
    const childKeys: string[] = firstCategory.children ? Object.keys(firstCategory.children).sort() : [];

    const childrenData: { [key: string]: number[] } = {};
    childKeys.forEach(childKey => {
      childrenData[childKey] = filtered.map(s => {
        const child = (s as any).response_data?.hierarchy?.[category]?.children?.[childKey] || {};
        return Number((child as any).area_ha ?? (child as any).total_area_ha ?? 0);
      });
    });

    const worksheetData: any[] = [];
    worksheetData.push(['Nearlive Crop Monitoring']);
    worksheetData.push([getLocationString()]);
    worksheetData.push([`Pest: ${category.replace(/_/g, ' ')}`]);
    worksheetData.push([]);

    const headers = ['Year-Month', 'Parent (ha)', ...childKeys.map(k => k.replace(/_/g, ' ') + ' (ha)')];
    worksheetData.push(headers);

    labels.forEach((label, idx) => {
      const row = [label, areaValues[idx], ...childKeys.map(k => childrenData[k][idx])];
      worksheetData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pest Data');
    XLSX.writeFile(wb, `pest-data-${category}-${Date.now()}.xlsx`);
  };

  const downloadGrowthStoredExcel = () => {
    if (!growthStoredSeries?.length) {
      alert('No growth time series to export. Run analysis with stored history first.');
      return;
    }
    const classNames = ['Weak', 'Stress', 'Moderate', 'Healthy'];
    const rows: any[] = [['Nearlive Crop Monitoring'], [getLocationString()], ['Growth'], []];
    rows.push(['Year-Month', ...classNames.map((c) => `${c} (ha)`), ...classNames.map((c) => `${c} (%)`)]);
    [...growthStoredSeries]
      .sort((a, b) => a.year_month.localeCompare(b.year_month))
      .forEach((item) => {
        const cw = (item.response_data as any)?.classwise || [];
        const byClass = (name: string) =>
          cw.find((x: any) => (x.class_name || '').toString().toLowerCase() === name.toLowerCase());
        const ha = classNames.map((cn) => Number(byClass(cn)?.area_hectares ?? (byClass(cn) as any)?.area_ha ?? 0));
        const pct = classNames.map((cn) => Number(byClass(cn)?.percentage ?? 0));
        rows.push([item.year_month, ...ha, ...pct]);
      });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Growth');
    XLSX.writeFile(wb, `growth-data-${Date.now()}.xlsx`);
  };

  const downloadWaterStoredExcel = () => {
    if (!waterStoredSeries?.length) {
      alert('No water uptake time series to export.');
      return;
    }
    const classNames = ['Deficient', 'Less', 'Adequat', 'Excellent', 'Excess'];
    const rows: any[] = [['Nearlive Crop Monitoring'], [getLocationString()], ['Water uptake'], []];
    rows.push(['Year-Month', ...classNames.map((c) => `${c} (ha)`), ...classNames.map((c) => `${c} (%)`)]);
    [...waterStoredSeries]
      .sort((a, b) => a.year_month.localeCompare(b.year_month))
      .forEach((item) => {
        const cw = (item.response_data as any)?.classwise || [];
        const byClass = (name: string) =>
          cw.find((x: any) => (x.class_name || '').toString().toLowerCase() === name.toLowerCase());
        const ha = classNames.map((cn) => Number(byClass(cn)?.area_hectares ?? (byClass(cn) as any)?.area_ha ?? 0));
        const pct = classNames.map((cn) => Number(byClass(cn)?.percentage ?? 0));
        rows.push([item.year_month, ...ha, ...pct]);
      });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Water');
    XLSX.writeFile(wb, `water-uptake-data-${Date.now()}.xlsx`);
  };

  const downloadChartExcel = () => {
    try {
      if (showGraphPage) {
        downloadDashboardIndicesExcel();
        return;
      }
      if (showAnalysisTrendsPage) {
        alert('Excel export for this all-date trends page is not available yet. Use PDF export for now.');
        return;
      }
      const tab = splitScreenMode ? leftActiveTab : activeTab;
      if (tab === 'pest') {
        const series = splitScreenMode ? leftPestStoredSeries : pestStoredSeries;
        const category = splitScreenMode ? leftSelectedPestCategory : selectedPestCategory;
        downloadPestTimeSeriesExcel(series, category);
        return;
      }
      if (tab === 'growth') {
        downloadGrowthStoredExcel();
        return;
      }
      if (tab === 'water') {
        downloadWaterStoredExcel();
        return;
      }
      alert('Excel export is available on Growth, Water, and Pest tabs when time series data is loaded.');
    } catch (error) {
      console.error('Error generating Excel:', error);
      alert('Failed to generate Excel file');
    }
  };

  const downloadWeatherChartPDF = async () => {
    try {
      const graphElement = document.getElementById('pest-time-series-graph');
      const chartElement = document.getElementById('weather-daily-chart');
      
      if (!chartElement) {
        alert('Weather chart not found');
        return;
      }

      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;

      let yPos = margin;
      yPos = await appendPdfBrandedHeader(pdf, pageWidth, margin, yPos);

      yPos = addWrappedText(pdf, getLocationString(), margin, yPos, contentWidth, 5.5, margin);
      yPos += 2;

      // Add pest info if available with text wrapping - ensure full text display
      if (selectedPestCategory && graphElement) {
        yPos = addWrappedText(pdf, `Pest: ${selectedPestCategory.replace(/_/g, ' ')}`, margin, yPos, contentWidth, 6, margin);
        yPos += 4;
        
        // Capture and add pest graph - ensure it doesn't push content off page
        const pestCanvas = await captureElementForPdf(graphElement, {});
        const pestImgData = pestCanvas.toDataURL('image/png');
        const pestImgHeight = (pestCanvas.height * contentWidth) / pestCanvas.width;
        
        const maxPestHeight = pageHeight - yPos - 30; // Leave 30mm for bottom margin and any text
        const actualPestHeight = Math.min(pestImgHeight, maxPestHeight);
        pdf.addImage(pestImgData, 'PNG', margin, yPos, contentWidth, actualPestHeight);
        yPos += actualPestHeight + 10;
      }
      
      // Add weather section title
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Daily Weather Data', margin, yPos);
      yPos += 8;
      
      // Capture weather chart
      const weatherCanvas = await captureElementForPdf(chartElement, {});
      const weatherImgData = weatherCanvas.toDataURL('image/png');
      const weatherImgHeight = (weatherCanvas.height * contentWidth) / weatherCanvas.width;
      
      // Check if we need a new page - leave more space for text
      if (yPos + weatherImgHeight > pageHeight - 100) {
        pdf.addPage();
        yPos = margin;
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Daily Weather Data', margin, yPos);
        yPos += 8;
      }
      
      // Add weather graph - ensure it doesn't push content off page, leave space for text
      const maxWeatherHeight = pageHeight - yPos - 30; // Leave 30mm for bottom margin and any text
      pdf.addImage(weatherImgData, 'PNG', margin, yPos, contentWidth, Math.min(weatherImgHeight, maxWeatherHeight));
      
      pdf.save(`nearlive-crop-monitoring-weather-${Date.now()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    }
  };

  const downloadWeatherDataExcel = () => {
    try {
      if (!weatherDailyData?.daily) {
        alert('No weather data available');
        return;
      }

      const worksheetData: any[] = [];
      worksheetData.push(['Nearlive Crop Monitoring']);
      worksheetData.push([getLocationString()]);
      worksheetData.push(['Daily Weather Data']);
      worksheetData.push([]);
      
      const headers = ['Date', 'Temp Max (Â°C)', 'Temp Min (Â°C)', 'Rainfall (mm)', 'Wind Max (km/h)'];
      worksheetData.push(headers);

      weatherDailyData.daily.forEach((day: any) => {
        worksheetData.push([
          day.date,
          day.temp_max,
          day.temp_min,
          day.rainfall,
          day.wind_max
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(worksheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Weather Data');
      XLSX.writeFile(wb, `weather-data-${Date.now()}.xlsx`);
    } catch (error) {
      console.error('Error generating Excel:', error);
      alert('Failed to generate Excel file');
    }
  };

  const downloadDashboardIndicesPDF = async () => {
    try {
      setShowDashboardIndicesDownloadMenu(false);
      const stored = dashboardIndicesData?.stored && Array.isArray(dashboardIndicesData.stored)
        ? (dashboardIndicesData as { stored: Array<{ index_name: string; period_date: string; value: number }> }).stored
        : [];
      if (!stored.length) {
        alert('No indices data to export. Load data first.');
        return;
      }
      const filename = `Nearlive-crop-Monitoring-${selectedDistrict || 'export'}-${selectedSubdistrict || ''}-${selectedVillage || ''}-${Date.now()}.pdf`;
      await generateDashboardIndicesPdf(
        {
          district: selectedDistrict || '',
          subdistrict: selectedSubdistrict || '',
          village: selectedVillage || '',
          stored,
          ...(dashboardIndicesFrequency ? { frequency: dashboardIndicesFrequency } : {}),
        },
        filename
      );
    } catch (error) {
      console.error('Error generating dashboard indices PDF:', error);
      alert('Failed to generate PDF');
    }
  };

  const downloadDashboardIndicesExcel = () => {
    try {
      setShowDashboardIndicesDownloadMenu(false);
      const stored = dashboardIndicesData?.stored && Array.isArray(dashboardIndicesData.stored)
        ? (dashboardIndicesData as { stored: Array<{ index_name: string; period_date: string; value: number }> }).stored
        : [];
      if (!stored.length) {
        alert('No indices data to export. Load data first.');
        return;
      }

      const freqLabel =
        dashboardIndicesFrequency === 'yearly'
          ? 'Yearly'
          : dashboardIndicesFrequency === 'monthly'
            ? 'Monthly'
            : 'Weekly';

      const indexDisplayNames: Record<string, string> = { ...DASHBOARD_INDEX_LABELS };

      const periodYearMonth = (periodDate: string): { year: string; month: string } => {
        const d = new Date(periodDate);
        if (isNaN(d.getTime())) return { year: '', month: '' };
        const y = String(d.getFullYear());
        const monthShort = d.toLocaleString('en-US', { month: 'short' });
        const dayNum = d.getDate();
        if (dashboardIndicesFrequency === 'yearly') {
          return { year: y, month: 'â€”' };
        }
        if (dashboardIndicesFrequency === 'monthly') {
          return { year: y, month: monthShort };
        }
        return { year: y, month: `${monthShort} ${dayNum}` };
      };

      const headers = [
        'Index Name',
        'Year',
        'Month',
        'Value',
        'District',
        'Subdistrict',
        'Village',
        'Frequency',
      ];
      const locSummary = [selectedDistrict, selectedSubdistrict, selectedVillage].filter(Boolean).join(' Â· ') || 'â€”';
      const rows: (string | number)[][] = [
        ['Nearlive Crop Monitoring â€” Indices export'],
        [`Frequency: ${freqLabel}  |  Location: ${locSummary}`],
        [],
        headers,
      ];

      const sorted = [...stored].sort((a, b) => {
        const ia = String(a.index_name || '').toLowerCase();
        const ib = String(b.index_name || '').toLowerCase();
        if (ia !== ib) return ia.localeCompare(ib);
        return String(a.period_date || '').localeCompare(String(b.period_date || ''));
      });

      sorted.forEach((item: { index_name: string; period_date: string; value: number }) => {
        const key = String(item.index_name || '').toLowerCase();
        const { year, month } = periodYearMonth(item.period_date || '');
        const displayName = indexDisplayNames[key] || String(item.index_name || '').toUpperCase();
        const val = item.value;
        rows.push([
          displayName,
          year,
          month,
          typeof val === 'number' && !Number.isNaN(val) ? val : String(val ?? ''),
          selectedDistrict || '',
          selectedSubdistrict || '',
          selectedVillage || '',
          freqLabel,
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Indices');
      XLSX.writeFile(
        wb,
        `Nearlive-crop-Monitoring-indices-${freqLabel}-${selectedDistrict || 'export'}-${Date.now()}.xlsx`
      );
    } catch (error) {
      console.error('Error generating dashboard indices Excel:', error);
      alert('Failed to generate Excel file');
    }
  };

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
          setDistricts([]);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
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
            setSubdistricts([]);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
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
          
          // Use API for all subdistricts (including Palus)
          const data = await fetchVillages(selectedSubdistrict);
          if (Array.isArray(data)) {
            setVillages(data);
          } else {
            setVillages([]);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
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

  useEffect(() => {
    setShowVillageBoundary(false);
  }, [selectedVillage]);

  useEffect(() => {
    setShowLeftVillageBoundary(false);
  }, [leftSelectedVillage]);

  useEffect(() => {
    setShowRightVillageBoundary(false);
  }, [rightSelectedVillage]);

  // When a village is selected but boundary not confirmed, keep subdistrict boundary on map (non–split-screen)
  useEffect(() => {
    if (splitScreenMode) return;
    if (!selectedVillage || showVillageBoundary) return;
    if (!selectedSubdistrict || subdistricts.length === 0) return;
    const subdistrictData = subdistricts.find((s) => s.subdistrict === selectedSubdistrict);
    if (!subdistrictData?.geometry) return;
    try {
      let coordinates: Coordinate[] = [];
      const geom = subdistrictData.geometry;
      if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
        const coords = geom.coordinates;
        if (geom.type === 'Polygon') {
          const outerRing = coords[0] || [];
          coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
        } else {
          const firstPolygon = coords[0] || [];
          const outerRing = firstPolygon[0] || [];
          coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
        }
      } else if (geom.coordinates) {
        const coords = geom.coordinates;
        if (Array.isArray(coords[0])?.[0]) {
          const outerRing = coords[0] || [];
          coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
        } else {
          coordinates = coords.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
        }
      }
      setBoundaryPlot(selectedSubdistrict, coordinates);
    } catch {
      /* keep previous map state */
    }
  }, [selectedVillage, selectedSubdistrict, showVillageBoundary, splitScreenMode, subdistricts]);

  // Handle district selection and display coordinates on map (from list geometry or get-geojson API)
  useEffect(() => {
    if (!selectedDistrict) {
      setSelectedDistrictData(null);
      setAllPlots([]);
      setAvailablePlots([]);
      setTotalPlotsCount(0);
      setPlotBounds(null);
      return;
    }

    const districtData = districts.find(d => d.district === selectedDistrict);
    setSelectedDistrictData(districtData || null);

    const setDistrictBoundary = (coordinates: Coordinate[]) => {
      if (coordinates.length >= 3) {
        setAllPlots([{ id: selectedDistrict, area_ha: '0', boundary: coordinates }]);
        const bounds = L.latLngBounds([]);
        coordinates.forEach((coord: Coordinate) => bounds.extend([coord[1], coord[0]]));
        if (bounds.isValid()) setPlotBounds(bounds);
      } else {
        setAllPlots([]);
      }
    };

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

    if (districtData?.geometry) {
      try {
        let coordinates: Coordinate[] = [];
        const geom = districtData.geometry;
        if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
          const coords = geom.coordinates;
          if (geom.type === 'Polygon') {
            const outerRing = coords[0] || [];
            coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
          } else {
            const firstPolygon = coords[0] || [];
            const outerRing = firstPolygon[0] || [];
            coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
          }
        } else if (Array.isArray(geom)) {
          coordinates = geom.map((coord: number[]) =>
            Array.isArray(coord) && coord.length >= 2 ? [coord[0], coord[1]] as Coordinate : null
          ).filter((c: Coordinate | null): c is Coordinate => c !== null);
        } else if (geom.coordinates) {
          const coords = geom.coordinates;
          if (Array.isArray(coords[0])?.[0]) {
            const outerRing = coords[0] || [];
            coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
          } else {
            coordinates = coords.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
          }
        }
        setDistrictBoundary(coordinates);
      } catch (err) {
        setAllPlots([]);
      }
    } else {
      // Fallback: fetch boundary from get-geojson API when list has no geometry
      let cancelled = false;
      fetchBoundaryGeoJSON(selectedDistrict).then((coords) => {
        if (cancelled) return;
        if (coords && coords.length >= 3) setDistrictBoundary(coords);
        else setAllPlots([]);
      });
      return () => { cancelled = true; };
    }
  }, [selectedDistrict, districts]);

  // Helper: set boundary plot and bounds from coordinates
  const setBoundaryPlot = (id: string, coordinates: Coordinate[]) => {
    if (coordinates.length >= 3) {
      setAllPlots([{ id, area_ha: '0', boundary: coordinates }]);
      const bounds = L.latLngBounds([]);
      coordinates.forEach((coord: Coordinate) => bounds.extend([coord[1], coord[0]]));
      if (bounds.isValid()) setPlotBounds(bounds);
    } else {
      setAllPlots([]);
    }
  };

  // Handle subdistrict selection and display coordinates on map (from list geometry or get-geojson API)
  useEffect(() => {
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

    if (selectedSubdistrict && subdistricts.length > 0) {
      const subdistrictData = subdistricts.find(s => s.subdistrict === selectedSubdistrict);
      if (subdistrictData?.geometry) {
        try {
          let coordinates: Coordinate[] = [];
          const geom = subdistrictData.geometry;
          if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
            const coords = geom.coordinates;
            if (geom.type === 'Polygon') {
              const outerRing = coords[0] || [];
              coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            } else {
              const firstPolygon = coords[0] || [];
              const outerRing = firstPolygon[0] || [];
              coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            }
          } else if (geom.coordinates) {
            const coords = geom.coordinates;
            if (Array.isArray(coords[0])?.[0]) {
              const outerRing = coords[0] || [];
              coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            } else {
              coordinates = coords.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            }
          }
          setBoundaryPlot(selectedSubdistrict, coordinates);
        } catch (err) {
          setAllPlots([]);
        }
      } else {
        let cancelled = false;
        fetchBoundaryGeoJSON(selectedSubdistrict).then((coords) => {
          if (cancelled) return;
          if (coords && coords.length >= 3) setBoundaryPlot(selectedSubdistrict, coords);
          else setAllPlots([]);
        });
        return () => { cancelled = true; };
      }
    } else if (!selectedSubdistrict && selectedDistrict) {
      const districtData = districts.find(d => d.district === selectedDistrict);
      if (districtData?.geometry) {
        try {
          let coordinates: Coordinate[] = [];
          const geom = districtData.geometry;
          if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
            const coords = geom.coordinates;
            if (geom.type === 'Polygon') {
              const outerRing = coords[0] || [];
              coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            } else {
              const firstPolygon = coords[0] || [];
              const outerRing = firstPolygon[0] || [];
              coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            }
          } else if (geom.coordinates) {
            const coords = geom.coordinates;
            if (Array.isArray(coords[0])?.[0]) {
              const outerRing = coords[0] || [];
              coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            } else {
              coordinates = coords.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            }
          }
          setBoundaryPlot(selectedDistrict, coordinates);
        } catch (err) {
        }
      } else {
        let cancelled = false;
        fetchBoundaryGeoJSON(selectedDistrict).then((coords) => {
          if (cancelled) return;
          if (coords && coords.length >= 3) setBoundaryPlot(selectedDistrict, coords);
          else setAllPlots([]);
        });
        return () => { cancelled = true; };
      }
    }
  }, [selectedSubdistrict, subdistricts, selectedDistrict, districts]);

  // Handle village selection: fetch field boundaries from API and display on map
  useEffect(() => {
    if (!selectedVillage) return;
    if (!selectedDistrict || !selectedSubdistrict) {
      setAllPlots([]);
      return;
    }
    if (!showVillageBoundary) return;

    let cancelled = false;

    const loadVillageBoundary = async () => {
      try {
        // Prefer field-boundaries API for village boundaries (any village)
        const plots = await fetchFieldBoundaries(selectedDistrict, selectedSubdistrict, selectedVillage);
        if (cancelled) return;

        if (plots.length > 0) {
          setAllPlots(plots);
          const bounds = L.latLngBounds([]);
          plots.forEach((plot) => {
            (plot.boundary || []).forEach((coord: Coordinate) => {
              bounds.extend([coord[1], coord[0]]);
            });
          });
          if (bounds.isValid()) {
            setPlotBounds(bounds);
          }
          return;
        }
      } catch (err) {
        if (cancelled) return;
      }

      // Fallback: use village geometry from villages list if API returned nothing or failed
      if (villages.length === 0) {
        setAllPlots([]);
        return;
      }
      const villageData = villages.find((v) => v.village === selectedVillage);
      if (!villageData?.coordinates && !villageData?.geometry) {
        setAllPlots([]);
        return;
      }

      try {
        let coordinates: Coordinate[] = [];
        if (villageData.coordinates && villageData.geom_type) {
          const coords = villageData.coordinates;
          const geomType = villageData.geom_type.toUpperCase();
          if (geomType === 'POLYGON' || geomType === 'MULTIPOLYGON') {
            if (Array.isArray(coords) && coords.length > 0) {
              if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
                const outerRing = coords[0] || [];
                coordinates = outerRing.map((coord: number[]) =>
                  Array.isArray(coord) && coord.length >= 2 ? [coord[0], coord[1]] as Coordinate : null
                ).filter((c): c is Coordinate => c !== null);
              } else {
                coordinates = coords.map((coord: number[]) =>
                  Array.isArray(coord) && coord.length >= 2 ? [coord[0], coord[1]] as Coordinate : null
                ).filter((c): c is Coordinate => c !== null);
              }
            }
          }
        } else if (villageData.geometry) {
          const g = villageData.geometry;
          if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
            const c = g.coordinates;
            if (g.type === 'Polygon') {
              const outerRing = (c && c[0]) || [];
              coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            } else {
              const firstPolygon = (c && c[0]) || [];
              const outerRing = firstPolygon[0] || [];
              coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            }
          } else if (g.coordinates) {
            const c = g.coordinates;
            const outerRing = Array.isArray(c[0]) && Array.isArray(c[0][0]) ? c[0] : c;
            coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
          }
        }

        if (coordinates.length >= 3) {
          setAllPlots([{ id: selectedVillage, area_ha: '0', boundary: coordinates }]);
          const bounds = L.latLngBounds([]);
          coordinates.forEach((coord: Coordinate) => bounds.extend([coord[1], coord[0]]));
          if (bounds.isValid()) setPlotBounds(bounds);
        } else {
          setAllPlots([]);
        }
      } catch (err) {
        setAllPlots([]);
      }
    };

    loadVillageBoundary();
    return () => { cancelled = true; };
  }, [selectedVillage, selectedDistrict, selectedSubdistrict, villages, showVillageBoundary]);

  // When crop type + village selected, fetch predict-area for color and field_area_ha per field_id
  useEffect(() => {
    const district = splitScreenMode ? leftSelectedDistrict : selectedDistrict;
    const subdistrict = splitScreenMode ? leftSelectedSubdistrict : selectedSubdistrict;
    const village = splitScreenMode ? leftSelectedVillage : selectedVillage;

    if (!selectedCrop || !district || !subdistrict || !village) {
      setPredictAreaCropColor(null);
      setPredictAreaFieldAreas({});
      setPredictSugarcaneAreaHa(null);
      setPredictSugarcaneAreaLoading(false);
      return;
    }
    let cancelled = false;
    setPredictSugarcaneAreaLoading(true);
    fetchPredictArea(district, subdistrict, village, 1)
      .then((res) => {
        if (cancelled) return;
        const cropKey = selectedCrop.toLowerCase();
        const cropData = res[cropKey] as PredictAreaCropData | undefined;
        if (!cropData || typeof cropData !== 'object') {
          setPredictAreaCropColor(null);
          setPredictAreaFieldAreas({});
        } else {
          setPredictAreaCropColor(cropData.color ?? null);
          const areas: Record<string, number> = {};
          const boundaries = cropData.identified_field_boundaries ?? {};
          Object.values(boundaries).forEach((item) => {
            areas[String(item.field_id)] = item.field_area_ha;
          });
          setPredictAreaFieldAreas(areas);
        }

        const rootHa = res.sugarcane_area_ha;
        let sugarHa: number | null = null;
        if (typeof rootHa === 'number' && !Number.isNaN(rootHa)) {
          sugarHa = rootHa;
        } else if (selectedCrop === 'sugarcane' && cropData) {
          if (typeof cropData.sugarcane_area_ha === 'number' && !Number.isNaN(cropData.sugarcane_area_ha)) {
            sugarHa = cropData.sugarcane_area_ha;
          } else if (typeof cropData.crop_area_ha === 'number' && !Number.isNaN(cropData.crop_area_ha)) {
            sugarHa = cropData.crop_area_ha;
          }
        }
        setPredictSugarcaneAreaHa(selectedCrop === 'sugarcane' ? sugarHa : null);
      })
      .catch(() => {
        if (!cancelled) {
          setPredictAreaCropColor(null);
          setPredictAreaFieldAreas({});
          setPredictSugarcaneAreaHa(null);
        }
      })
      .finally(() => {
        if (!cancelled) setPredictSugarcaneAreaLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedCrop, splitScreenMode, selectedDistrict, selectedSubdistrict, selectedVillage, leftSelectedDistrict, leftSelectedSubdistrict, leftSelectedVillage]);

  // Clear analysis data when village changes; when village cleared, show subdistrict boundary
  useEffect(() => {
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
    setGeojsonPlots([]);

    if (!selectedVillage && selectedSubdistrict) {
      const subdistrictData = subdistricts.find((s) => s.subdistrict === selectedSubdistrict);
      if (subdistrictData?.geometry) {
        try {
          let coordinates: Coordinate[] = [];
          const g = subdistrictData.geometry;
          if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
            const c = g.coordinates;
            if (g.type === 'Polygon') {
              coordinates = (c[0] || []).map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            } else {
              const firstPolygon = c[0] || [];
              const outerRing = firstPolygon[0] || [];
              coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
            }
          } else if (g.coordinates) {
            const c = g.coordinates;
            const outerRing = Array.isArray(c[0]) && Array.isArray(c[0][0]) ? c[0] : c;
            coordinates = outerRing.map((coord: number[]) => [coord[0], coord[1]] as Coordinate);
          }
          if (coordinates.length >= 3) {
            setAllPlots([{ id: selectedSubdistrict, area_ha: '0', boundary: coordinates }]);
            const bounds = L.latLngBounds([]);
            coordinates.forEach((coord: Coordinate) => bounds.extend([coord[1], coord[0]]));
            if (bounds.isValid()) setPlotBounds(bounds);
          }
        } catch (err) {
        }
      }
    }
  }, [selectedVillage, selectedSubdistrict, subdistricts]);

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
          
          // Check for area_hectares in various possible locations
          let areaValue: number | null = null;
          
          // Check root level with different possible field names
          if (response.area_hectares !== undefined && response.area_hectares !== null) {
            areaValue = response.area_hectares;
          } else if ((response as any).total_area_hectares !== undefined && (response as any).total_area_hectares !== null) {
            areaValue = (response as any).total_area_hectares;
          } else if ((response as any).area !== undefined && (response as any).area !== null) {
            areaValue = (response as any).area;
          } else if ((response as any).total_area !== undefined && (response as any).total_area !== null) {
            areaValue = (response as any).total_area;
          }
          // Check in pixel_summary
          else if (response.pixel_summary && (response.pixel_summary as any).area_hectares !== undefined) {
            areaValue = (response.pixel_summary as any).area_hectares;
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
            }
          }
          
          if (areaValue !== null && areaValue !== undefined && !isNaN(areaValue) && areaValue > 0) {
            setTotalAreaHectares(areaValue);
          } else {
            setTotalAreaHectares(null);
          }
        } catch (err) {
          void err;
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
  
  // Fetch subdistricts for left side when district is selected (split screen mode)
  useEffect(() => {
    if (splitScreenMode && leftSelectedDistrict) {
      const loadSubdistricts = async () => {
        try {
          setLeftLoading(true);
          setLeftError(null);
          const data = await fetchSubdistricts(leftSelectedDistrict);
          if (Array.isArray(data)) {
            setLeftSubdistricts(data);
          } else {
            setLeftSubdistricts([]);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          setLeftError(`Failed to load subdistricts: ${errorMessage}`);
          setLeftSubdistricts([]);
        } finally {
          setLeftLoading(false);
        }
      };
      loadSubdistricts();
    } else {
      setLeftSubdistricts([]);
      setLeftSelectedSubdistrict('');
      setLeftVillages([]);
      setLeftSelectedVillage('');
    }
  }, [splitScreenMode, leftSelectedDistrict]);

  // Fetch villages for left side when subdistrict is selected (split screen mode)
  useEffect(() => {
    if (splitScreenMode && leftSelectedSubdistrict) {
      const loadVillages = async () => {
        try {
          setLeftLoading(true);
          setLeftError(null);
          const data = await fetchVillages(leftSelectedSubdistrict);
          if (Array.isArray(data)) {
            setLeftVillages(data);
          } else {
            setLeftVillages([]);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          setLeftError(`Failed to load villages: ${errorMessage}`);
          setLeftVillages([]);
        } finally {
          setLeftLoading(false);
        }
      };
      loadVillages();
    } else {
      setLeftVillages([]);
      setLeftSelectedVillage('');
    }
  }, [splitScreenMode, leftSelectedSubdistrict]);

  // Fetch total area for left side (split screen mode)
  useEffect(() => {
    if (splitScreenMode && leftSelectedDistrict) {
      const fetchTotalArea = async () => {
        try {
          setLeftTotalAreaLoading(true);
          setLeftError(null);
          
          const response = await fetchGrowthAnalysis1(
            leftSelectedDistrict,
            leftSelectedSubdistrict || undefined,
            leftSelectedVillage || undefined
          );
          
          // Check for area_hectares in various possible locations
          let areaValue: number | null = null;
          
          // Check root level with different possible field names
          if (response.area_hectares !== undefined && response.area_hectares !== null) {
            areaValue = response.area_hectares;
          } else if ((response as any).total_area_hectares !== undefined && (response as any).total_area_hectares !== null) {
            areaValue = (response as any).total_area_hectares;
          } else if ((response as any).area !== undefined && (response as any).area !== null) {
            areaValue = (response as any).area;
          } else if ((response as any).total_area !== undefined && (response as any).total_area !== null) {
            areaValue = (response as any).total_area;
          }
          // Check in pixel_summary
          else if (response.pixel_summary && (response.pixel_summary as any).area_hectares !== undefined) {
            areaValue = (response.pixel_summary as any).area_hectares;
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
            }
          }
          
          if (areaValue !== null && areaValue !== undefined && !isNaN(areaValue) && areaValue > 0) {
            setLeftTotalAreaHectares(areaValue);
          } else {
            setLeftTotalAreaHectares(null);
          }
        } catch (err) {
          void err;
          // Don't set error here as it might interfere with other operations
          setLeftTotalAreaHectares(null);
        } finally {
          setLeftTotalAreaLoading(false);
        }
      };
      fetchTotalArea();
    } else {
      setLeftTotalAreaHectares(null);
    }
  }, [splitScreenMode, leftSelectedDistrict, leftSelectedSubdistrict, leftSelectedVillage]);

  // Fetch subdistricts for right side when district is selected (split screen mode)
  useEffect(() => {
    if (splitScreenMode && rightSelectedDistrict) {
      const loadSubdistricts = async () => {
        try {
          setRightLoading(true);
          setRightError(null);
          const data = await fetchSubdistricts(rightSelectedDistrict);
          if (Array.isArray(data)) {
            setRightSubdistricts(data);
          } else {
            setRightSubdistricts([]);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          setRightError(`Failed to load subdistricts: ${errorMessage}`);
          setRightSubdistricts([]);
        } finally {
          setRightLoading(false);
        }
      };
      loadSubdistricts();
    } else {
      setRightSubdistricts([]);
      setRightSelectedSubdistrict('');
      setRightVillages([]);
      setRightSelectedVillage('');
    }
  }, [splitScreenMode, rightSelectedDistrict]);

  // Fetch villages for right side when subdistrict is selected (split screen mode)
  useEffect(() => {
    if (splitScreenMode && rightSelectedSubdistrict) {
      const loadVillages = async () => {
        try {
          setRightLoading(true);
          setRightError(null);
          const data = await fetchVillages(rightSelectedSubdistrict);
          if (Array.isArray(data)) {
            setRightVillages(data);
          } else {
            setRightVillages([]);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          setRightError(`Failed to load villages: ${errorMessage}`);
          setRightVillages([]);
        } finally {
          setRightLoading(false);
        }
      };
      loadVillages();
    } else {
      setRightVillages([]);
      setRightSelectedVillage('');
    }
  }, [splitScreenMode, rightSelectedSubdistrict]);

  // Fetch total area for right side (split screen mode)
  useEffect(() => {
    if (splitScreenMode && rightSelectedDistrict) {
      const fetchTotalArea = async () => {
        try {
          setRightTotalAreaLoading(true);
          setRightError(null);
          
          const response = await fetchGrowthAnalysis1(
            rightSelectedDistrict,
            rightSelectedSubdistrict || undefined,
            rightSelectedVillage || undefined
          );
          
          // Check for area_hectares in various possible locations
          let areaValue: number | null = null;
          
          // Check root level with different possible field names
          if (response.area_hectares !== undefined && response.area_hectares !== null) {
            areaValue = response.area_hectares;
          } else if ((response as any).total_area_hectares !== undefined && (response as any).total_area_hectares !== null) {
            areaValue = (response as any).total_area_hectares;
          } else if ((response as any).area !== undefined && (response as any).area !== null) {
            areaValue = (response as any).area;
          } else if ((response as any).total_area !== undefined && (response as any).total_area !== null) {
            areaValue = (response as any).total_area;
          }
          // Check in pixel_summary
          else if (response.pixel_summary && (response.pixel_summary as any).area_hectares !== undefined) {
            areaValue = (response.pixel_summary as any).area_hectares;
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
            }
          }
          
          if (areaValue !== null && areaValue !== undefined && !isNaN(areaValue) && areaValue > 0) {
            setRightTotalAreaHectares(areaValue);
          } else {
            setRightTotalAreaHectares(null);
          }
        } catch (err) {
          void err;
          // Don't set error here as it might interfere with other operations
          setRightTotalAreaHectares(null);
        } finally {
          setRightTotalAreaLoading(false);
        }
      };
      fetchTotalArea();
    } else {
      setRightTotalAreaHectares(null);
    }
  }, [splitScreenMode, rightSelectedDistrict, rightSelectedSubdistrict, rightSelectedVillage]);

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

          // Debug logging for full API response removed for production
          
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
          // Format 5: Growth API current object: { current: { feature | features } }
          else if (responseAny.current && Array.isArray(responseAny.current.features)) {
            plotsArray = responseAny.current.features;
          } else if (responseAny.current?.feature && responseAny.current.feature.type === 'Feature' && responseAny.current.feature.geometry) {
            plotsArray = [responseAny.current.feature];
          }
          // Format 6: Single feature at top level (fallback)
          else if (responseAny.feature && responseAny.feature.type === 'Feature' && responseAny.feature.geometry) {
            plotsArray = [responseAny.feature];
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
              
              // Store tile_url even if plotId is missing (use index as fallback)
              if (tileUrl) {
                // Ensure the tile URL is a valid string and properly formatted
                const cleanTileUrl = String(tileUrl).trim();
                if (cleanTileUrl && cleanTileUrl.includes('earthengine.googleapis.com')) {
                  tileUrlsMap[plotId] = cleanTileUrl;
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
              setAllPlotsTileUrls(tileUrlsMap);
              // Ensure showTileLayers is true when we have tile URLs
              setShowTileLayers(true);
            } else {
              setAllPlotsTileUrls({});
            }
            
            if (plotsForMap.length > 0) {
              setAllPlots(plotsForMap);
              const plotIds = plotsForMap.map(p => p.id);
              setAvailablePlots(plotIds);
              setTotalPlotsCount(plotIds.length);
            } else {
              // Keep existing boundary (district/subdistrict) visible when we have tile URLs but no boundaries from API
              if (Object.keys(tileUrlsMap).length === 0) {
                setAllPlots([]);
              }
            }
          } else {
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
            setAllPlotsAnalysisData(prev => ({
              ...prev,
              waterSource: waterSourceData,
            }));
          } else if (activeTab === 'pest') {
            const pestResponse: any = response;
            // New format: hierarchy with tile_url, total_area_ha, percentage, children per category (from POST pest-detectionclasswise current)
            if (pestResponse.hierarchy && typeof pestResponse.hierarchy === 'object') {
              setPestHierarchy({
                plot: pestResponse.plots?.[0]?.properties?.plot_id ?? '',
                total_area_ha: pestResponse.total_area_ha ?? pestResponse.plots?.[0]?.properties?.total_area_ha ?? 0,
                hierarchy: pestResponse.hierarchy,
              } as PestHierarchyResponse);
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
              // Current snapshot: set map tile from first feature so "Current" shows the right layer
              const currentTile = pestResponse.plots?.[0]?.properties?.tile_url ?? null;
              if (currentTile) {
                setPestTileUrl(currentTile);
                setAllPlotsTileUrls(prev => ({ ...prev, pest: currentTile }));
              }
              // Time series: use stored year_month from same response (Current + all stored dates on tab)
              const stored = Array.isArray(pestResponse.stored) ? (pestResponse.stored as PestStoredResponse) : [];
              setPestStoredSeries(stored);
              // Keep selectedPestYearMonth in sync if it exists in stored; default to null so "Current" is shown
              if (stored.length > 0 && selectedTimeSeriesYearMonth && stored.some((x: PestStoredItem) => x.year_month === selectedTimeSeriesYearMonth)) {
                setSelectedPestYearMonth(selectedTimeSeriesYearMonth);
              } else {
                setSelectedPestYearMonth(null);
              }
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
            // Growth/Water/Soil/Pest: set stored year_month from analyze_* response for time series tab
            const storedResponse = response as GrowthAnalysisWithStoredResponse;
            if (activeTab === 'growth') {
              setGrowthCurrentData(tabData); // keep current snapshot for "Current" tab
              setGrowthStoredSeries(Array.isArray(storedResponse.stored) ? storedResponse.stored : []);
              setGrowthStoredError(null);
            } else if (activeTab === 'water') {
              const wStored = Array.isArray(storedResponse.stored) ? storedResponse.stored : [];
              setWaterStoredSeries(wStored);
              const inList = Boolean(
                selectedTimeSeriesYearMonth && wStored.some((x: GrowthStoredItem) => x.year_month === selectedTimeSeriesYearMonth)
              );
              // Default to Current so sidebar + map use API current.classwise (includes tile_url per class).
              // Auto-selecting first stored month overwrote that with response_data often missing tile_url.
              setSelectedWaterYearMonth(inList ? selectedTimeSeriesYearMonth : null);
              setWaterCurrentSnapshot({ ...tabData });
              const wuTiles = waterClasswiseToTileUrlMap(tabData.classwise);
              if (Object.keys(wuTiles).length > 0) {
                setAllPlotsTileUrls((prev) => {
                  const rest = Object.fromEntries(
                    Object.entries(prev).filter(
                      ([key]) => !key.startsWith('wu-') && key !== WATER_UPTAKE_CLASS_TILE_KEY
                    )
                  );
                  return { ...rest, ...wuTiles };
                });
                setShowTileLayers(true);
              }
            } else if (activeTab === 'soil') {
              const sStored = Array.isArray(storedResponse.stored) ? storedResponse.stored : [];
              setSoilStoredSeries(sStored);
              if (sStored.length > 0) {
                const inList = selectedTimeSeriesYearMonth && sStored.some((x: GrowthStoredItem) => x.year_month === selectedTimeSeriesYearMonth);
                setSelectedSoilYearMonth(inList ? selectedTimeSeriesYearMonth : null);
              } else setSelectedSoilYearMonth(null);
            } else if (activeTab === 'pest' && Array.isArray(storedResponse.stored)) {
              const stored = storedResponse.stored as PestStoredResponse;
              setPestStoredSeries(stored);
              if (stored.length > 0) {
                const inList = selectedTimeSeriesYearMonth && stored.some((x: PestStoredItem) => x.year_month === selectedTimeSeriesYearMonth);
                setSelectedPestYearMonth(inList ? selectedTimeSeriesYearMonth! : null);
              } else {
                setSelectedPestYearMonth(null);
              }
            }
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
            
            // Try multiple possible field names and locations
            let waterArea: number | null = null;
            
            // FIRST: Check in area_summary (this is the correct location based on API response)
            if (ndwiResponse.area_summary?.water_area_hectare !== undefined && ndwiResponse.area_summary.water_area_hectare !== null) {
              waterArea = ndwiResponse.area_summary.water_area_hectare;
            } else if (responseAny.area_summary?.water_area_hectares !== undefined && responseAny.area_summary.water_area_hectares !== null) {
              waterArea = responseAny.area_summary.water_area_hectares;
            }
            // SECOND: Check root level with different possible field names
            else if (ndwiResponse.water_area_hectare !== undefined && ndwiResponse.water_area_hectare !== null) {
              waterArea = ndwiResponse.water_area_hectare;
            } else if (responseAny.water_area_hectares !== undefined && responseAny.water_area_hectares !== null) {
              waterArea = responseAny.water_area_hectares;
            } else if (responseAny.water_area_hectare !== undefined && responseAny.water_area_hectare !== null) {
              waterArea = responseAny.water_area_hectare;
            } else if (responseAny.total_water_area_hectare !== undefined && responseAny.total_water_area_hectare !== null) {
              waterArea = responseAny.total_water_area_hectare;
            } else if (responseAny.total_water_area_hectares !== undefined && responseAny.total_water_area_hectares !== null) {
              waterArea = responseAny.total_water_area_hectares;
            }
            
            // THIRD: Check in pixel_summary if available
            if (waterArea === null && response.pixel_summary) {
              const pixelSummary = response.pixel_summary as any;
              if (pixelSummary.water_area_hectare !== undefined && pixelSummary.water_area_hectare !== null) {
                waterArea = pixelSummary.water_area_hectare;
              } else if (pixelSummary.water_area_hectares !== undefined && pixelSummary.water_area_hectares !== null) {
                waterArea = pixelSummary.water_area_hectares;
              }
            }
            
            if (waterArea !== null && !isNaN(waterArea) && waterArea >= 0) {
              setWaterAreaHectares(waterArea);
            } else {
              setWaterAreaHectares(null);
            }
          } else {
            // Clear water area when switching away from waterSource tab
            setWaterAreaHectares(null);
          }
          
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
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
      setGrowthStoredSeries(null);
      setWaterStoredSeries(null);
      setSoilStoredSeries(null);
      setGrowthCurrentData(null);
    }
  }, [activeTab, selectedDistrict, selectedSubdistrict, selectedVillage]); // Fetch when tab OR location changes

  // Handle left district boundary display in split screen mode (when only district selected, no subdistrict/village)
  useEffect(() => {
    if (splitScreenMode && leftSelectedDistrict && !leftSelectedSubdistrict && !leftSelectedVillage) {
      // Find the selected district data
      const districtData = districts.find(d => d.district === leftSelectedDistrict);
      
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
              id: leftSelectedDistrict,
              area_ha: '0', // Area not provided
              boundary: coordinates
            };
            setLeftAllPlots([districtPlot]);
            
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
          } else {
            setLeftAllPlots([]);
          }
        } catch (err) {
          setLeftAllPlots([]);
        }
      } else {
        // No geometry available
        setLeftAllPlots([]);
      }
    } else if (splitScreenMode && (!leftSelectedDistrict || leftSelectedSubdistrict || leftSelectedVillage)) {
      if (!leftSelectedDistrict) setLeftAllPlots([]);
    }
  }, [splitScreenMode, leftSelectedDistrict, leftSelectedSubdistrict, leftSelectedVillage, districts]);

  // Handle right district boundary display in split screen mode (when only district selected, no subdistrict/village)
  useEffect(() => {
    if (splitScreenMode && rightSelectedDistrict && !rightSelectedSubdistrict && !rightSelectedVillage) {
      // Find the selected district data
      const districtData = districts.find(d => d.district === rightSelectedDistrict);
      
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
              id: rightSelectedDistrict,
              area_ha: '0', // Area not provided
              boundary: coordinates
            };
            setRightAllPlots([districtPlot]);
            
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
          } else {
            setRightAllPlots([]);
          }
        } catch (err) {
          setRightAllPlots([]);
        }
      } else {
        // No geometry available
        setRightAllPlots([]);
      }
    } else if (splitScreenMode && (!rightSelectedDistrict || rightSelectedSubdistrict || rightSelectedVillage)) {
      if (!rightSelectedDistrict) setRightAllPlots([]);
    }
  }, [splitScreenMode, rightSelectedDistrict, rightSelectedSubdistrict, rightSelectedVillage, districts]);

  // Handle left subdistrict boundary display in split screen mode (even without tab)
  useEffect(() => {
    if (splitScreenMode && leftSelectedSubdistrict && leftSubdistricts.length > 0 && !leftActiveTab && (!leftSelectedVillage || !showLeftVillageBoundary)) {
      // Find the selected subdistrict data
      const subdistrictData = leftSubdistricts.find(s => s.subdistrict === leftSelectedSubdistrict);
      
      if (subdistrictData?.geometry) {
        try {
          let coordinates: Coordinate[] = [];
          
          // Handle different geometry formats
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
          
          // Create a plot from subdistrict boundary for map display
          if (coordinates.length >= 3) {
            const subdistrictPlot = {
              id: leftSelectedSubdistrict,
              area_ha: '0',
              boundary: coordinates
            };
            setLeftAllPlots([subdistrictPlot]);
            
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
          } else {
            setLeftAllPlots([]);
          }
        } catch (err) {
          setLeftAllPlots([]);
        }
      } else {
        setLeftAllPlots([]);
      }
    } else if (splitScreenMode && !leftSelectedSubdistrict && !leftSelectedVillage && leftSelectedDistrict) {
      // If subdistrict is cleared, show district boundary again
      const districtData = districts.find(d => d.district === leftSelectedDistrict);
      if (districtData?.geometry && !leftActiveTab) {
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
              id: leftSelectedDistrict,
              area_ha: '0',
              boundary: coordinates
            };
            setLeftAllPlots([districtPlot]);
          }
        } catch (err) {
        }
      }
    }
  }, [splitScreenMode, leftSelectedSubdistrict, leftSubdistricts, leftSelectedDistrict, leftSelectedVillage, leftActiveTab, districts, showLeftVillageBoundary]);

  // Handle left village boundary in split screen (after "Display boundary" — same logic as main map)
  useEffect(() => {
    if (!splitScreenMode || !leftSelectedVillage || !showLeftVillageBoundary || !leftVillages.length || leftActiveTab) return;
    if (!leftSelectedDistrict || !leftSelectedSubdistrict) return;

    let cancelled = false;

    const run = async () => {
      try {
        const plots = await fetchFieldBoundaries(leftSelectedDistrict, leftSelectedSubdistrict, leftSelectedVillage);
        if (cancelled) return;
        if (plots.length > 0) {
          setLeftAllPlots(plots);
          const bounds = L.latLngBounds([]);
          plots.forEach((plot) => {
            (plot.boundary || []).forEach((coord: Coordinate) => {
              bounds.extend([coord[1], coord[0]]);
            });
          });
          if (bounds.isValid()) setPlotBounds(bounds);
          return;
        }
      } catch {
        if (cancelled) return;
      }

      const villageData = leftVillages.find((v) => v.village === leftSelectedVillage);
      if (!villageData?.coordinates && !villageData?.geometry) {
        setLeftAllPlots([]);
        return;
      }

      try {
        let coordinates: Coordinate[] = [];
        if (villageData.coordinates && villageData.geom_type) {
          const coords = villageData.coordinates;
          const geomType = villageData.geom_type.toUpperCase();
          if (geomType === 'POLYGON' || geomType === 'MULTIPOLYGON') {
            if (Array.isArray(coords) && coords.length > 0) {
              if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
                const outerRing = coords[0] || [];
                coordinates = outerRing.map((coord: number[]) => {
                  if (Array.isArray(coord) && coord.length >= 2) {
                    return [coord[0], coord[1]] as Coordinate;
                  }
                  return null;
                }).filter((c: Coordinate | null): c is Coordinate => c !== null);
              } else {
                coordinates = coords.map((coord: number[]) => {
                  if (Array.isArray(coord) && coord.length >= 2) {
                    return [coord[0], coord[1]] as Coordinate;
                  }
                  return null;
                }).filter((c: Coordinate | null): c is Coordinate => c !== null);
              }
            }
          }
        } else if (villageData.geometry) {
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
          }
        }

        if (coordinates.length >= 3) {
          setLeftAllPlots([{ id: leftSelectedVillage, area_ha: '0', boundary: coordinates }]);
          const bounds = L.latLngBounds([]);
          coordinates.forEach((coord: Coordinate) => bounds.extend([coord[1], coord[0]]));
          if (bounds.isValid()) setPlotBounds(bounds);
        } else {
          setLeftAllPlots([]);
        }
      } catch {
        setLeftAllPlots([]);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [splitScreenMode, leftSelectedVillage, showLeftVillageBoundary, leftVillages, leftSelectedDistrict, leftSelectedSubdistrict, leftActiveTab]);

  useEffect(() => {
    if (splitScreenMode && !leftSelectedVillage && leftSelectedSubdistrict) {
      // If village is cleared, show subdistrict boundary again
      const subdistrictData = leftSubdistricts.find(s => s.subdistrict === leftSelectedSubdistrict);
      if (subdistrictData?.geometry && !leftActiveTab) {
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
              id: leftSelectedSubdistrict,
              area_ha: '0',
              boundary: coordinates
            };
            setLeftAllPlots([subdistrictPlot]);
          }
        } catch (err) {
        }
      }
    }
  }, [splitScreenMode, leftSelectedVillage, leftVillages, leftSelectedSubdistrict, leftSubdistricts, leftActiveTab]);

  // Handle right subdistrict boundary display in split screen mode (even without tab)
  useEffect(() => {
    if (splitScreenMode && rightSelectedSubdistrict && rightSubdistricts.length > 0 && !rightActiveTab && (!rightSelectedVillage || !showRightVillageBoundary)) {
      // Find the selected subdistrict data
      const subdistrictData = rightSubdistricts.find(s => s.subdistrict === rightSelectedSubdistrict);
      
      if (subdistrictData?.geometry) {
        try {
          let coordinates: Coordinate[] = [];
          
          // Handle different geometry formats
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
          
          // Create a plot from subdistrict boundary for map display
          if (coordinates.length >= 3) {
            const subdistrictPlot = {
              id: rightSelectedSubdistrict,
              area_ha: '0',
              boundary: coordinates
            };
            setRightAllPlots([subdistrictPlot]);
            
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
          } else {
            setRightAllPlots([]);
          }
        } catch (err) {
          setRightAllPlots([]);
        }
      } else {
        setRightAllPlots([]);
      }
    } else if (splitScreenMode && !rightSelectedSubdistrict && !rightSelectedVillage && rightSelectedDistrict && !rightActiveTab) {
      // If subdistrict is cleared, show district boundary again
      const districtData = districts.find(d => d.district === rightSelectedDistrict);
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
              id: rightSelectedDistrict,
              area_ha: '0',
              boundary: coordinates
            };
            setRightAllPlots([districtPlot]);
          }
        } catch (err) {
        }
      }
    }
  }, [splitScreenMode, rightSelectedSubdistrict, rightSubdistricts, rightSelectedDistrict, rightSelectedVillage, rightActiveTab, districts, showRightVillageBoundary]);

  // Handle right village boundary in split screen (after "Display boundary")
  useEffect(() => {
    if (!splitScreenMode || !rightSelectedVillage || !showRightVillageBoundary || !rightVillages.length || rightActiveTab) return;
    if (!rightSelectedDistrict || !rightSelectedSubdistrict) return;

    let cancelled = false;

    const run = async () => {
      try {
        const plots = await fetchFieldBoundaries(rightSelectedDistrict, rightSelectedSubdistrict, rightSelectedVillage);
        if (cancelled) return;
        if (plots.length > 0) {
          setRightAllPlots(plots);
          const bounds = L.latLngBounds([]);
          plots.forEach((plot) => {
            (plot.boundary || []).forEach((coord: Coordinate) => {
              bounds.extend([coord[1], coord[0]]);
            });
          });
          if (bounds.isValid()) setPlotBounds(bounds);
          return;
        }
      } catch {
        if (cancelled) return;
      }

      const villageData = rightVillages.find((v) => v.village === rightSelectedVillage);
      if (!villageData?.coordinates && !villageData?.geometry) {
        setRightAllPlots([]);
        return;
      }

      try {
        let coordinates: Coordinate[] = [];
        if (villageData.coordinates && villageData.geom_type) {
          const coords = villageData.coordinates;
          const geomType = villageData.geom_type.toUpperCase();
          if (geomType === 'POLYGON' || geomType === 'MULTIPOLYGON') {
            if (Array.isArray(coords) && coords.length > 0) {
              if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
                const outerRing = coords[0] || [];
                coordinates = outerRing.map((coord: number[]) => {
                  if (Array.isArray(coord) && coord.length >= 2) {
                    return [coord[0], coord[1]] as Coordinate;
                  }
                  return null;
                }).filter((c: Coordinate | null): c is Coordinate => c !== null);
              } else {
                coordinates = coords.map((coord: number[]) => {
                  if (Array.isArray(coord) && coord.length >= 2) {
                    return [coord[0], coord[1]] as Coordinate;
                  }
                  return null;
                }).filter((c: Coordinate | null): c is Coordinate => c !== null);
              }
            }
          }
        } else if (villageData.geometry) {
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
          }
        }

        if (coordinates.length >= 3) {
          setRightAllPlots([{ id: rightSelectedVillage, area_ha: '0', boundary: coordinates }]);
          const bounds = L.latLngBounds([]);
          coordinates.forEach((coord: Coordinate) => bounds.extend([coord[1], coord[0]]));
          if (bounds.isValid()) setPlotBounds(bounds);
        } else {
          setRightAllPlots([]);
        }
      } catch {
        setRightAllPlots([]);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [splitScreenMode, rightSelectedVillage, showRightVillageBoundary, rightVillages, rightSelectedDistrict, rightSelectedSubdistrict, rightActiveTab]);

  useEffect(() => {
    if (splitScreenMode && !rightSelectedVillage && rightSelectedSubdistrict && !rightActiveTab) {
      // If village is cleared, show subdistrict boundary again
      const subdistrictData = rightSubdistricts.find(s => s.subdistrict === rightSelectedSubdistrict);
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
              id: rightSelectedSubdistrict,
              area_ha: '0',
              boundary: coordinates
            };
            setRightAllPlots([subdistrictPlot]);
          }
        } catch (err) {
        }
      }
    }
  }, [splitScreenMode, rightSelectedVillage, rightVillages, rightSelectedSubdistrict, rightSubdistricts, rightActiveTab]);

  // Fetch analysis data for left side (split screen mode)
  useEffect(() => {
    if (splitScreenMode && leftSelectedDistrict && leftActiveTab) {
      const loadAnalysisData = async () => {
        try {
          setLeftLoading(true);
          setLeftError(null);
          // Clear old data when location changes
          setLeftAllPlotsTileUrls({});
          
          // Preserve boundary - priority: Village > Subdistrict > District
          let locationBoundary: {id: string; area_ha: string; boundary: Coordinate[]} | null = null;
          
          // Check village first
          if (leftSelectedVillage && leftVillages.length > 0) {
            const villageData = leftVillages.find(v => v.village === leftSelectedVillage);
            if (villageData?.coordinates || villageData?.geometry) {
              try {
                let coordinates: Coordinate[] = [];
                
                if (villageData.coordinates && villageData.geom_type) {
                  const coords = villageData.coordinates;
                  const geomType = villageData.geom_type.toUpperCase();
                  if (geomType === 'POLYGON' || geomType === 'MULTIPOLYGON') {
                    if (Array.isArray(coords) && coords.length > 0) {
                      if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
                        const outerRing = coords[0] || [];
                        coordinates = outerRing.map((coord: number[]) => {
                          if (Array.isArray(coord) && coord.length >= 2) {
                            return [coord[0], coord[1]] as Coordinate;
                          }
                          return null;
                        }).filter((c: Coordinate | null): c is Coordinate => c !== null);
                      } else {
                        coordinates = coords.map((coord: number[]) => {
                          if (Array.isArray(coord) && coord.length >= 2) {
                            return [coord[0], coord[1]] as Coordinate;
                          }
                          return null;
                        }).filter((c: Coordinate | null): c is Coordinate => c !== null);
                      }
                    }
                  }
                } else if (villageData.geometry) {
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
                  }
                }
                
                if (coordinates.length >= 3) {
                  locationBoundary = {
                    id: leftSelectedVillage,
                    area_ha: '0',
                    boundary: coordinates
                  };
                }
              } catch (err) {
              }
            }
          }
          // Check subdistrict second
          else if (leftSelectedSubdistrict && leftSubdistricts.length > 0) {
            const subdistrictData = leftSubdistricts.find(s => s.subdistrict === leftSelectedSubdistrict);
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
                  locationBoundary = {
                    id: leftSelectedSubdistrict,
                    area_ha: '0',
                    boundary: coordinates
                  };
                }
              } catch (err) {
              }
            }
          }
          // Check district last
          else if (leftSelectedDistrict) {
            const districtData = districts.find(d => d.district === leftSelectedDistrict);
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
                } else if (Array.isArray(districtData.geometry)) {
                  coordinates = districtData.geometry.map((coord: number[]) => 
                    Array.isArray(coord) && coord.length >= 2 
                      ? [coord[0], coord[1]] as Coordinate 
                      : null
                  ).filter((c: Coordinate | null): c is Coordinate => c !== null);
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
                  locationBoundary = {
                    id: leftSelectedDistrict,
                    area_ha: '0',
                    boundary: coordinates
                  };
                }
              } catch (err) {
              }
            }
          }
          
          setLeftAllPlots([]);
          
          let response: GrowthAnalysisResponse | NDWIDetectionResponse;
          switch (leftActiveTab) {
            case 'growth':
              response = await fetchGrowthAnalysis1(
                leftSelectedDistrict, 
                leftSelectedSubdistrict || undefined, 
                leftSelectedVillage || undefined
              );
              break;
            case 'water':
              response = await fetchWaterUptakeAnalysis(
                leftSelectedDistrict, 
                leftSelectedSubdistrict || undefined, 
                leftSelectedVillage || undefined
              );
              break;
            case 'soil':
              response = await fetchSoilMoistureAnalysis(
                leftSelectedDistrict, 
                leftSelectedSubdistrict || undefined, 
                leftSelectedVillage || undefined
              );
              break;
            case 'pest':
              response = await fetchPestDetectionAnalysis(
                leftSelectedDistrict, 
                leftSelectedSubdistrict || undefined, 
                leftSelectedVillage || undefined
              );
              break;
            case 'waterSource':
              response = await fetchNDWIDetection(
                leftSelectedDistrict, 
                leftSelectedSubdistrict || undefined, 
                leftSelectedVillage || undefined
              );
              break;
            default:
              return;
          }

          // Extract plots and tile URLs (similar to main mode)
          const responseAny = response as any;
          let plotsArray: any[] = [];
          
          if (response.plots && Array.isArray(response.plots)) {
            plotsArray = response.plots;
          } else if (responseAny.features && Array.isArray(responseAny.features)) {
            plotsArray = responseAny.features;
          } else if (responseAny.data && Array.isArray(responseAny.data)) {
            plotsArray = responseAny.data;
          } else if (Array.isArray(response)) {
            plotsArray = response;
          } else if (responseAny.current && Array.isArray(responseAny.current.features)) {
            plotsArray = responseAny.current.features;
          } else if (responseAny.current?.feature && responseAny.current.feature.type === 'Feature' && responseAny.current.feature.geometry) {
            plotsArray = [responseAny.current.feature];
          } else if (responseAny.feature && responseAny.feature.type === 'Feature' && responseAny.feature.geometry) {
            plotsArray = [responseAny.feature];
          }
          
          // Extract tile URLs and plot boundaries from plots
          if (plotsArray.length > 0) {
            const tileUrlsMap: Record<string, string> = {};
            
            // First pass: Collect all tile URLs
            plotsArray.forEach((plot, index) => {
              const plotId = plot.properties?.plot_id || plot.plot_id || 
                            plot.properties?.plot_name || plot.plot_name || 
                            `plot-${index}`;
              const tileUrl = plot.properties?.tile_url || plot.tile_url;
              
              if (tileUrl) {
                const cleanTileUrl = String(tileUrl).trim();
                if (cleanTileUrl && cleanTileUrl.includes('earthengine.googleapis.com')) {
                  tileUrlsMap[plotId] = cleanTileUrl;
                }
              }
            });
            
            if (Object.keys(tileUrlsMap).length > 0) {
              setLeftAllPlotsTileUrls(tileUrlsMap);
              setLeftShowTileLayers(true);
            } else {
              setLeftAllPlotsTileUrls({});
            }
            
            // Second pass: Convert plots to map format (only plots with valid coordinates)
            const plotsForMap = plotsArray
              .map((plot, index) => {
                const plotId = plot.properties?.plot_id || plot.plot_id || 
                              plot.properties?.plot_name || plot.plot_name || 
                              `plot-${index}`;
                const areaAcres = plot.properties?.area_acres || plot.area_acres;
                
                if (!plotId) {
                  return null;
                }
                
                // Extract coordinates from different formats
                let coordinates: number[][] = [];
                
                // Format 1: GeoJSON Feature with geometry
                if (plot.geometry && plot.geometry.coordinates) {
                  const geomCoords = plot.geometry.coordinates;
                  if (plot.geometry.type === 'Polygon' && Array.isArray(geomCoords) && geomCoords.length > 0) {
                    const firstRing = geomCoords[0];
                    if (Array.isArray(firstRing) && firstRing.length > 0 && Array.isArray(firstRing[0])) {
                      if (firstRing[0].length === 2 && typeof firstRing[0][0] === 'number') {
                        coordinates = firstRing as unknown as number[][];
                      }
                    }
                  } else if (Array.isArray(geomCoords) && geomCoords.length > 0) {
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
                  return null;
                }
                
                return {
                  id: String(plotId),
                  area_ha: String(areaAcres || 0),
                  boundary: validCoords // [lng, lat] coordinates
                };
              })
              .filter((plot): plot is { id: string; area_ha: string; boundary: Coordinate[] } => plot !== null);
            
            // Merge location boundary with analysis plots
            const finalPlots = locationBoundary 
              ? [locationBoundary, ...plotsForMap]
              : plotsForMap;
            
            if (finalPlots.length > 0) {
              setLeftAllPlots(finalPlots);
            } else {
              // If no plots and no location boundary, still try to show location boundary if available
              if (locationBoundary) {
                setLeftAllPlots([locationBoundary]);
              } else {
                setLeftAllPlots([]);
              }
            }
          } else {
            setLeftAllPlotsTileUrls({});
            // If no analysis data, still show location boundary if available
            if (locationBoundary) {
              setLeftAllPlots([locationBoundary]);
            } else {
              setLeftAllPlots([]);
            }
          }

          // Process response similar to main analysis data
          if (response.pixel_summary || (response as any).classwise) {
            const classwise = responseAny.classwise;
            const tabData = (response.pixel_summary || {}) as any;
            if ((leftActiveTab === 'growth' || leftActiveTab === 'water' || leftActiveTab === 'soil') && classwise && Array.isArray(classwise) && classwise.length > 0) {
              tabData.classwise = classwise;
            }
            
            // Handle pest hierarchy
            if (leftActiveTab === 'pest') {
              const pestResponse: any = response;
              if (pestResponse.hierarchy && typeof pestResponse.hierarchy === 'object') {
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
                setLeftAllPlotsAnalysisData(prev => ({
                  ...prev,
                  pest: pestSummary,
                }));
              } else {
                const pct = pestResponse.percentage_summary || {};
                const area = pestResponse.area_summary_hectare || {};
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
                setLeftAllPlotsAnalysisData(prev => ({
                  ...prev,
                  pest: pestSummary,
                }));
              }
            } else if (leftActiveTab === 'waterSource') {
              const ndwiResponse = response as NDWIDetectionResponse;
              const waterSourceData = {
                ...(response.pixel_summary || {}),
                ...(ndwiResponse.area_summary || {}),
              };
              setLeftAllPlotsAnalysisData(prev => ({
                ...prev,
                waterSource: waterSourceData,
              }));
            } else {
              setLeftAllPlotsAnalysisData(prev => ({
                growth: leftActiveTab === 'growth' ? tabData : (prev?.growth || null),
                water: leftActiveTab === 'water' ? tabData : (prev?.water || null),
                soil: leftActiveTab === 'soil' ? tabData : (prev?.soil || null),
                pest: prev?.pest || null,
                waterSource: prev?.waterSource || null,
              }));
            }
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          setLeftError(`Failed to load ${leftActiveTab} analysis: ${errorMessage}`);
          setLeftAllPlotsAnalysisData(null);
          setLeftAllPlotsTileUrls({});
          setLeftAllPlots([]);
        } finally {
          setLeftLoading(false);
        }
      };
      loadAnalysisData();
    } else if (splitScreenMode && !leftSelectedDistrict) {
      setLeftAllPlotsAnalysisData(null);
      setLeftAllPlotsTileUrls({});
      setLeftAllPlots([]);
    }
  }, [splitScreenMode, leftActiveTab, leftSelectedDistrict, leftSelectedSubdistrict, leftSelectedVillage]);

  // Fetch analysis data for right side (split screen mode)
  useEffect(() => {
    if (splitScreenMode && rightSelectedDistrict && rightActiveTab) {
      const loadAnalysisData = async () => {
        try {
          setRightLoading(true);
          setRightError(null);
          // Clear old data when location changes
          setRightAllPlotsTileUrls({});
          
          // Preserve boundary - priority: Village > Subdistrict > District
          let locationBoundary: {id: string; area_ha: string; boundary: Coordinate[]} | null = null;
          
          // Check village first
          if (rightSelectedVillage && rightVillages.length > 0) {
            const villageData = rightVillages.find(v => v.village === rightSelectedVillage);
            if (villageData?.coordinates || villageData?.geometry) {
              try {
                let coordinates: Coordinate[] = [];
                
                if (villageData.coordinates && villageData.geom_type) {
                  const coords = villageData.coordinates;
                  const geomType = villageData.geom_type.toUpperCase();
                  if (geomType === 'POLYGON' || geomType === 'MULTIPOLYGON') {
                    if (Array.isArray(coords) && coords.length > 0) {
                      if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
                        const outerRing = coords[0] || [];
                        coordinates = outerRing.map((coord: number[]) => {
                          if (Array.isArray(coord) && coord.length >= 2) {
                            return [coord[0], coord[1]] as Coordinate;
                          }
                          return null;
                        }).filter((c: Coordinate | null): c is Coordinate => c !== null);
                      } else {
                        coordinates = coords.map((coord: number[]) => {
                          if (Array.isArray(coord) && coord.length >= 2) {
                            return [coord[0], coord[1]] as Coordinate;
                          }
                          return null;
                        }).filter((c: Coordinate | null): c is Coordinate => c !== null);
                      }
                    }
                  }
                } else if (villageData.geometry) {
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
                  }
                }
                
                if (coordinates.length >= 3) {
                  locationBoundary = {
                    id: rightSelectedVillage,
                    area_ha: '0',
                    boundary: coordinates
                  };
                }
              } catch (err) {
              }
            }
          }
          // Check subdistrict second
          else if (rightSelectedSubdistrict && rightSubdistricts.length > 0) {
            const subdistrictData = rightSubdistricts.find(s => s.subdistrict === rightSelectedSubdistrict);
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
                  locationBoundary = {
                    id: rightSelectedSubdistrict,
                    area_ha: '0',
                    boundary: coordinates
                  };
                }
              } catch (err) {
              }
            }
          }
          // Check district last
          else if (rightSelectedDistrict) {
            const districtData = districts.find(d => d.district === rightSelectedDistrict);
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
                } else if (Array.isArray(districtData.geometry)) {
                  coordinates = districtData.geometry.map((coord: number[]) => 
                    Array.isArray(coord) && coord.length >= 2 
                      ? [coord[0], coord[1]] as Coordinate 
                      : null
                  ).filter((c: Coordinate | null): c is Coordinate => c !== null);
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
                  locationBoundary = {
                    id: rightSelectedDistrict,
                    area_ha: '0',
                    boundary: coordinates
                  };
                }
              } catch (err) {
              }
            }
          }
          
          setRightAllPlots([]);
          
          let response: GrowthAnalysisResponse | NDWIDetectionResponse;
          switch (rightActiveTab) {
            case 'growth':
              response = await fetchGrowthAnalysis1(
                rightSelectedDistrict, 
                rightSelectedSubdistrict || undefined, 
                rightSelectedVillage || undefined
              );
              break;
            case 'water':
              response = await fetchWaterUptakeAnalysis(
                rightSelectedDistrict, 
                rightSelectedSubdistrict || undefined, 
                rightSelectedVillage || undefined
              );
              break;
            case 'soil':
              response = await fetchSoilMoistureAnalysis(
                rightSelectedDistrict, 
                rightSelectedSubdistrict || undefined, 
                rightSelectedVillage || undefined
              );
              break;
            case 'pest':
              response = await fetchPestDetectionAnalysis(
                rightSelectedDistrict, 
                rightSelectedSubdistrict || undefined, 
                rightSelectedVillage || undefined
              );
              break;
            case 'waterSource':
              response = await fetchNDWIDetection(
                rightSelectedDistrict, 
                rightSelectedSubdistrict || undefined, 
                rightSelectedVillage || undefined
              );
              break;
            default:
              return;
          }

          // Extract plots and tile URLs (similar to main mode)
          const responseAny = response as any;
          let plotsArray: any[] = [];
          
          if (response.plots && Array.isArray(response.plots)) {
            plotsArray = response.plots;
          } else if (responseAny.features && Array.isArray(responseAny.features)) {
            plotsArray = responseAny.features;
          } else if (responseAny.data && Array.isArray(responseAny.data)) {
            plotsArray = responseAny.data;
          } else if (Array.isArray(response)) {
            plotsArray = response;
          } else if (responseAny.current && Array.isArray(responseAny.current.features)) {
            plotsArray = responseAny.current.features;
          } else if (responseAny.current?.feature && responseAny.current.feature.type === 'Feature' && responseAny.current.feature.geometry) {
            plotsArray = [responseAny.current.feature];
          } else if (responseAny.feature && responseAny.feature.type === 'Feature' && responseAny.feature.geometry) {
            plotsArray = [responseAny.feature];
          }
          
          // Extract tile URLs and plot boundaries from plots
          if (plotsArray.length > 0) {
            const tileUrlsMap: Record<string, string> = {};
            
            // First pass: Collect all tile URLs
            plotsArray.forEach((plot, index) => {
              const plotId = plot.properties?.plot_id || plot.plot_id || 
                            plot.properties?.plot_name || plot.plot_name || 
                            `plot-${index}`;
              const tileUrl = plot.properties?.tile_url || plot.tile_url;
              
              if (tileUrl) {
                const cleanTileUrl = String(tileUrl).trim();
                if (cleanTileUrl && cleanTileUrl.includes('earthengine.googleapis.com')) {
                  tileUrlsMap[plotId] = cleanTileUrl;
                }
              }
            });
            
            if (Object.keys(tileUrlsMap).length > 0) {
              setRightAllPlotsTileUrls(tileUrlsMap);
              setRightShowTileLayers(true);
            } else {
              setRightAllPlotsTileUrls({});
            }
            
            // Second pass: Convert plots to map format (only plots with valid coordinates)
            const plotsForMap = plotsArray
              .map((plot, index) => {
                const plotId = plot.properties?.plot_id || plot.plot_id || 
                              plot.properties?.plot_name || plot.plot_name || 
                              `plot-${index}`;
                const areaAcres = plot.properties?.area_acres || plot.area_acres;
                
                if (!plotId) {
                  return null;
                }
                
                // Extract coordinates from different formats
                let coordinates: number[][] = [];
                
                // Format 1: GeoJSON Feature with geometry
                if (plot.geometry && plot.geometry.coordinates) {
                  const geomCoords = plot.geometry.coordinates;
                  if (plot.geometry.type === 'Polygon' && Array.isArray(geomCoords) && geomCoords.length > 0) {
                    const firstRing = geomCoords[0];
                    if (Array.isArray(firstRing) && firstRing.length > 0 && Array.isArray(firstRing[0])) {
                      if (firstRing[0].length === 2 && typeof firstRing[0][0] === 'number') {
                        coordinates = firstRing as unknown as number[][];
                      }
                    }
                  } else if (Array.isArray(geomCoords) && geomCoords.length > 0) {
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
                  return null;
                }
                
                return {
                  id: String(plotId),
                  area_ha: String(areaAcres || 0),
                  boundary: validCoords // [lng, lat] coordinates
                };
              })
              .filter((plot): plot is { id: string; area_ha: string; boundary: Coordinate[] } => plot !== null);
            
            // Merge location boundary with analysis plots
            const finalPlots = locationBoundary 
              ? [locationBoundary, ...plotsForMap]
              : plotsForMap;
            
            if (finalPlots.length > 0) {
              setRightAllPlots(finalPlots);
            } else {
              // If no plots and no location boundary, still try to show location boundary if available
              if (locationBoundary) {
                setRightAllPlots([locationBoundary]);
              } else {
                setRightAllPlots([]);
              }
            }
          } else {
            setRightAllPlotsTileUrls({});
            // If no analysis data, still show location boundary if available
            if (locationBoundary) {
              setRightAllPlots([locationBoundary]);
            } else {
              setRightAllPlots([]);
            }
          }

          // Process response similar to main analysis data
          if (response.pixel_summary || (response as any).classwise) {
            const classwise = responseAny.classwise;
            const tabData = (response.pixel_summary || {}) as any;
            if ((rightActiveTab === 'growth' || rightActiveTab === 'water' || rightActiveTab === 'soil') && classwise && Array.isArray(classwise) && classwise.length > 0) {
              tabData.classwise = classwise;
            }
            
            // Handle pest hierarchy
            if (rightActiveTab === 'pest') {
              const pestResponse: any = response;
              if (pestResponse.hierarchy && typeof pestResponse.hierarchy === 'object') {
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
                setRightAllPlotsAnalysisData(prev => ({
                  ...prev,
                  pest: pestSummary,
                }));
              } else {
                const pct = pestResponse.percentage_summary || {};
                const area = pestResponse.area_summary_hectare || {};
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
                setRightAllPlotsAnalysisData(prev => ({
                  ...prev,
                  pest: pestSummary,
                }));
              }
            } else if (rightActiveTab === 'waterSource') {
              const ndwiResponse = response as NDWIDetectionResponse;
              const waterSourceData = {
                ...(response.pixel_summary || {}),
                ...(ndwiResponse.area_summary || {}),
              };
              setRightAllPlotsAnalysisData(prev => ({
                ...prev,
                waterSource: waterSourceData,
              }));
            } else {
              setRightAllPlotsAnalysisData(prev => ({
                growth: rightActiveTab === 'growth' ? tabData : (prev?.growth || null),
                water: rightActiveTab === 'water' ? tabData : (prev?.water || null),
                soil: rightActiveTab === 'soil' ? tabData : (prev?.soil || null),
                pest: prev?.pest || null,
                waterSource: prev?.waterSource || null,
              }));
            }
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          setRightError(`Failed to load ${rightActiveTab} analysis: ${errorMessage}`);
          setRightAllPlotsAnalysisData(null);
          setRightAllPlotsTileUrls({});
          setRightAllPlots([]);
        } finally {
          setRightLoading(false);
        }
      };
      loadAnalysisData();
    } else if (splitScreenMode && !rightSelectedDistrict) {
      setRightAllPlotsAnalysisData(null);
      setRightAllPlotsTileUrls({});
      setRightAllPlots([]);
    }
  }, [splitScreenMode, rightActiveTab, rightSelectedDistrict, rightSelectedSubdistrict, rightSelectedVillage]);

  // Initialize left side data when split screen mode is activated
  useEffect(() => {
    if (splitScreenMode) {
      // Copy current location selections to left side if left side is empty
      if (!leftSelectedDistrict && selectedDistrict) {
        setLeftSelectedDistrict(selectedDistrict);
        setLeftSelectedSubdistrict(selectedSubdistrict);
        setLeftSelectedVillage(selectedVillage);
        // Copy subdistricts and villages lists
        if (subdistricts.length > 0) {
          setLeftSubdistricts([...subdistricts]);
        }
        if (villages.length > 0) {
          setLeftVillages([...villages]);
        }
      }
      
      // Copy current tile URLs to left side if left side is empty
      if (Object.keys(leftAllPlotsTileUrls).length === 0 && Object.keys(allPlotsTileUrls).length > 0) {
        setLeftAllPlotsTileUrls({ ...allPlotsTileUrls });
      }
      
      // Copy current analysis data to left side if left side is empty
      if (!leftAllPlotsAnalysisData && allPlotsAnalysisData) {
        setLeftAllPlotsAnalysisData({ ...allPlotsAnalysisData });
      }
      
      // Copy current active tab to left side if left side is empty
      if (!leftActiveTab && activeTab) {
        setLeftActiveTab(activeTab);
      }
    }
  }, [splitScreenMode, selectedDistrict, selectedSubdistrict, selectedVillage, subdistricts, villages, allPlotsTileUrls, allPlotsAnalysisData, activeTab, leftSelectedDistrict, leftSubdistricts, leftVillages, leftAllPlotsTileUrls, leftAllPlotsAnalysisData, leftActiveTab]);

  // Clear normal screen map display when exiting split screen mode
  useEffect(() => {
    if (!splitScreenMode) {
      // Clear all plots, boundaries, and tile layers to show clean base map
      setAllPlots([]);
      setAllPlotsTileUrls({});
      setShowTileLayers(false);
      setSelectedPlotId(null);
      setSelectedPlotArea(null);
      // Clear location selections to show clean base map
      setSelectedDistrict('');
      setSelectedSubdistrict('');
      setSelectedVillage('');
      setSelectedDistrictData(null);
      setSubdistricts([]);
      setVillages([]);
      setAllPlotsAnalysisData(null);
      setActiveTab(null);
      setPlotBounds(null);
      setTotalAreaHectares(null);
    }
  }, [splitScreenMode]);

  // When no analysis tab is selected, remove those tile layers (LST stays â€” separate control).
  useEffect(() => {
    if (splitScreenMode) return;
    if (activeTab !== null) return;
    setAllPlotsTileUrls((prev) => {
      const t = prev['land-surface-temperature'];
      return t ? { 'land-surface-temperature': t } : {};
    });
    setPestTileUrl(null);
    setForestTileUrl(null);
    setForestData(null);
    setSelectedForestAgeClass(null);
    setPestHierarchy(null);
    setSelectedPestCategory(null);
    setShowPestChildren(false);
    setWaterSources([]);
    setNdwiData(null);
    setSelectedWaterSource(null);
    setWaterAreaHectares(null);
  }, [activeTab, splitScreenMode]);

  useEffect(() => {
    if (!splitScreenMode) return;
    if (leftActiveTab !== null) return;
    setLeftAllPlotsTileUrls({});
    setLeftAllPlots([]);
  }, [splitScreenMode, leftActiveTab]);

  useEffect(() => {
    if (!splitScreenMode) return;
    if (rightActiveTab !== null) return;
    setRightAllPlotsTileUrls({});
    setRightAllPlots([]);
  }, [splitScreenMode, rightActiveTab]);

  // Reset pest graph size to smaller default when entering split screen mode
  useEffect(() => {
    if (splitScreenMode) {
      setPestGraphSize(prev => {
        // Only reset if current size is larger than split screen default
        if (prev.width > 400 || prev.height > 200) {
          return { width: 400, height: 200 };
        }
        return prev;
      });
    }
  }, [splitScreenMode]);

  // Clear water area when switching away from waterSource tab
  useEffect(() => {
    if (activeTab !== 'waterSource') {
      setWaterAreaHectares(null);
    }
  }, [activeTab]);

  // Sugarcane (and other crops): map styling and areas come from predict-area only — do not call analyze_Growthclasswise from the crop dropdown.
  useEffect(() => {
    setCropTileUrl(null);
    setCropAreaHa(null);
    setAllPlotsTileUrls((prev) => {
      if (!('sugarcane' in prev)) return prev;
      const next = { ...prev };
      delete next['sugarcane'];
      return next;
    });
  }, [selectedCrop, selectedDistrict, selectedSubdistrict, selectedVillage]);

  // Pest stored year_month now comes from analyze_pestclasswise response (set in loadAnalysisData). Clear when switching away.
  useEffect(() => {
    if (activeTab !== 'pest' || !selectedDistrict || !selectedSubdistrict) {
      setPestStoredSeries(null);
      setPestStoredError(null);
      setPestStoredLoading(false);
      setSelectedPestYearMonth(null);
    }
  }, [activeTab, selectedDistrict, selectedSubdistrict]);

  // Growth/Water/Soil time series year_month come from analyze_* response (set in loadAnalysisData). No separate api-stored fetch.

  // Fetch dashboard indices store when district/frequency are set; optional subdistrict/village refine data
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!selectedDistrict) {
        if (!cancelled) {
          setDashboardIndicesData(null);
          setDashboardIndicesError(null);
          setSelectedDashboardIndex(null);
        }
        return;
      }
      if (!dashboardIndicesFrequency) {
        if (!cancelled) {
          setDashboardIndicesData(null);
          setDashboardIndicesError(null);
          setDashboardIndicesLoading(false);
          setSelectedDashboardIndex(null);
        }
        return;
      }
      try {
        setDashboardIndicesLoading(true);
        setDashboardIndicesError(null);
        const data = await fetchDashboardIndicesStore(
          selectedDistrict,
          selectedSubdistrict || '',
          dashboardIndicesFrequency,
          selectedVillage || ''
        );
        if (!cancelled) {
          setDashboardIndicesData(data);
          const raw = data as any;
          const indices = Array.isArray(raw?.indices) ? raw.indices
            : Array.isArray(raw?.data) ? raw.data
            : Array.isArray(data) ? data
            : [];
          const firstIndex = indices.length > 0 ? (typeof indices[0] === 'string' ? indices[0] : indices[0]?.name ?? indices[0]?.id ?? null) : null;
          setSelectedDashboardIndex(firstIndex);
        }
      } catch (e) {
        if (!cancelled) {
          setDashboardIndicesData(null);
          setDashboardIndicesError(e instanceof Error ? e.message : 'Failed to load dashboard indices');
        }
      } finally {
        if (!cancelled) setDashboardIndicesLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [selectedDistrict, selectedSubdistrict, selectedVillage, dashboardIndicesFrequency]);

  useEffect(() => {
    setIndicesLegendHighlightedYear(null);
  }, [selectedDistrict, selectedSubdistrict, selectedVillage, dashboardIndicesFrequency]);

  // Fetch Pest stored time series for left side (split screen mode)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!splitScreenMode || getActiveTab('left') !== 'pest' || !leftSelectedDistrict || !leftSelectedSubdistrict) {
        if (!cancelled) {
          setLeftPestStoredSeries(null);
          setLeftPestStoredError(null);
          setLeftPestStoredLoading(false);
          setLeftSelectedPestYearMonth(null);
        }
        return;
      }
      try {
        setLeftPestStoredLoading(true);
        setLeftPestStoredError(null);
        const data = await fetchPestStoredSeries(leftSelectedDistrict, leftSelectedSubdistrict, 50);
        if (!cancelled) {
          setLeftPestStoredSeries(data);
          setLeftSelectedPestYearMonth(data.length > 0 ? data[0].year_month : null);
          
          // Auto-select first pest category from first month's data if available
          if (data.length > 0 && data[0].response_data?.hierarchy) {
            const hierarchy = data[0].response_data.hierarchy;
            const order = ['healthy', 'chewing', 'fungi', 'sucking', 'wilt', 'soilborne'];
            const firstCategory = order.find(k => hierarchy[k] != null);
            if (firstCategory && !leftSelectedPestCategory) {
              setLeftSelectedPestCategory(firstCategory);
              const children = hierarchy[firstCategory]?.children;
              if (children) {
                setLeftShowPestChildren(Object.keys(children).length > 0);
              }
            }
          }
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Failed to load pest time series';
          setLeftPestStoredSeries(null);
          setLeftPestStoredError(msg);
        }
      } finally {
        if (!cancelled) setLeftPestStoredLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [splitScreenMode, leftActiveTab, leftSelectedDistrict, leftSelectedSubdistrict, leftSelectedPestCategory]);

  // Fetch Pest stored time series for right side (split screen mode)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!splitScreenMode || getActiveTab('right') !== 'pest' || !rightSelectedDistrict || !rightSelectedSubdistrict) {
        if (!cancelled) {
          setRightPestStoredSeries(null);
          setRightPestStoredError(null);
          setRightPestStoredLoading(false);
          setRightSelectedPestYearMonth(null);
        }
        return;
      }
      try {
        setRightPestStoredLoading(true);
        setRightPestStoredError(null);
        const data = await fetchPestStoredSeries(rightSelectedDistrict, rightSelectedSubdistrict, 50);
        if (!cancelled) {
          setRightPestStoredSeries(data);
          setRightSelectedPestYearMonth(data.length > 0 ? data[0].year_month : null);
          
          // Auto-select first pest category from first month's data if available
          if (data.length > 0 && data[0].response_data?.hierarchy) {
            const hierarchy = data[0].response_data.hierarchy;
            const order = ['healthy', 'chewing', 'fungi', 'sucking', 'wilt', 'soilborne'];
            const firstCategory = order.find(k => hierarchy[k] != null);
            if (firstCategory && !rightSelectedPestCategory) {
              setRightSelectedPestCategory(firstCategory);
              const children = hierarchy[firstCategory]?.children;
              if (children) {
                setRightShowPestChildren(Object.keys(children).length > 0);
              }
            }
          }
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Failed to load pest time series';
          setRightPestStoredSeries(null);
          setRightPestStoredError(msg);
        }
      } finally {
        if (!cancelled) setRightPestStoredLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [splitScreenMode, rightActiveTab, rightSelectedDistrict, rightSelectedSubdistrict, rightSelectedPestCategory]);

  // When a stored pest year_month is selected, update hierarchy, sidebar cards and map tile
  useEffect(() => {
    if (activeTab !== 'pest' || !pestStoredSeries || !selectedPestYearMonth) return;

    const item = pestStoredSeries.find((it) => it.year_month === selectedPestYearMonth);
    if (!item || !item.response_data) return;

    const resp: any = item.response_data;
    const hierarchy = resp.hierarchy || {};
    const totalAreaHa = resp.total_area_ha ?? resp.features?.[0]?.properties?.total_area_ha ?? 0;

    // Update pest hierarchy so sidebar Percentage / Area uses stored data
    setPestHierarchy({
      plot: resp.plot ?? resp.features?.[0]?.properties?.plot_id ?? '',
      total_area_ha: totalAreaHa,
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
      total_area_hectare: totalAreaHa,
    };

    setAllPlotsAnalysisData((prev) => ({
      growth: prev?.growth || null,
      water: prev?.water || null,
      soil: prev?.soil || null,
      pest: pestSummary,
      waterSource: prev?.waterSource || null,
    }));

    // Update map tile_url for this month (overall pest tile; stored can have tile in .tile_url or .features[0].properties.tile_url)
    const tileForMonth = resp.tile_url ?? resp.features?.[0]?.properties?.tile_url;
    if (tileForMonth) {
      setPestTileUrl(tileForMonth);
      setAllPlotsTileUrls(prev => ({ ...prev, pest: tileForMonth }));
      setShowTileLayers(true);
    }

    // Auto-select first available pest category if none is selected
    if (!selectedPestCategory && hierarchy) {
      const order = ['healthy', 'chewing', 'fungi', 'sucking', 'wilt', 'soilborne'];
      const firstCategory = order.find(k => hierarchy[k] != null);
      if (firstCategory) {
        setSelectedPestCategory(firstCategory);
        const children = hierarchy[firstCategory]?.children;
        setShowPestChildren(!!children && Object.keys(children).length > 0);
      }
    }
  }, [activeTab, pestStoredSeries, selectedPestYearMonth, selectedPestCategory]);

  // Sync Growth tab selection from shared time series (so switching from Pest back to Growth keeps same month)
  useEffect(() => {
    if (activeTab !== 'growth' || !growthStoredSeries) return;
    const inList = selectedTimeSeriesYearMonth === null || growthStoredSeries.some((x: GrowthStoredItem) => x.year_month === selectedTimeSeriesYearMonth);
    setSelectedGrowthYearMonth(inList ? selectedTimeSeriesYearMonth : null);
  }, [activeTab, growthStoredSeries, selectedTimeSeriesYearMonth]);

  // When Growth tab: show current snapshot or selected stored year_month in sidebar/map
  useEffect(() => {
    if (activeTab !== 'growth') return;
    if (!selectedGrowthYearMonth) {
      // Show current data
      if (growthCurrentData) {
        setAllPlotsAnalysisData((prev) => ({
          growth: growthCurrentData,
          water: prev?.water || null,
          soil: prev?.soil || null,
          pest: prev?.pest || null,
          waterSource: prev?.waterSource || null,
        }));
      }
      return;
    }
    if (!growthStoredSeries) return;
    const item = growthStoredSeries.find((it) => it.year_month === selectedGrowthYearMonth);
    if (!item?.response_data) return;
    const rd = item.response_data as any;
    const pixelSummary = rd.pixel_summary || {};
    const classwise = rd.classwise;
    const tabData = { ...pixelSummary, classwise: classwise || [] };
    setAllPlotsAnalysisData((prev) => ({
      growth: tabData,
      water: prev?.water || null,
      soil: prev?.soil || null,
      pest: prev?.pest || null,
      waterSource: prev?.waterSource || null,
    }));
    // Support both features[] and single feature (e.g. stored 2026-03 has response_data.feature)
    const feat = (rd.features && rd.features[0]) ? rd.features[0] : rd.feature;
    if (feat?.properties?.tile_url) {
      setAllPlotsTileUrls((prev) => ({ ...prev, [feat.properties?.plot_id || 'growth']: feat.properties.tile_url }));
      setShowTileLayers(true);
    }
    // Keep boundary visible when switching stored month: set allPlots from feature geometry if present
    if (feat?.geometry?.type === 'Polygon' && feat.geometry.coordinates?.[0]?.length >= 3) {
      const coords = feat.geometry.coordinates[0].map((c: number[]) => [c[0], c[1]] as Coordinate);
      const plotId = feat.properties?.plot_id || selectedDistrict || 'growth';
      setAllPlots([{ id: plotId, area_ha: String(feat.properties?.area_acres || 0), boundary: coords }]);
    }
  }, [activeTab, growthStoredSeries, selectedGrowthYearMonth, growthCurrentData, selectedDistrict]);

  // When Water tab: when a stored year_month is selected, update sidebar cards, map tile and boundary from stored.response_data
  useEffect(() => {
    if (splitScreenMode) return; // Left side only for now
    if (getActiveTab('left') !== 'water') return;
    if (!selectedWaterYearMonth || !waterStoredSeries || waterStoredSeries.length === 0) return;

    const item = waterStoredSeries.find((it) => it.year_month === selectedWaterYearMonth);
    if (!item?.response_data) return;

    const rd: any = item.response_data;
    const pixelSummary = rd.pixel_summary || {};
    const classwise = rd.classwise;
    const tabData = { ...pixelSummary, classwise: Array.isArray(classwise) ? classwise : [] };

    // Update analysis data so percentage / area cards use stored month values
    setAllPlotsAnalysisData((prev) => ({
      growth: prev?.growth || null,
      water: tabData,
      soil: prev?.soil || null,
      pest: prev?.pest || null,
      waterSource: prev?.waterSource || null,
    }));

    // Build plots from stored response_data for map + tile_url
    let plotsArray: any[] = [];
    if (Array.isArray(rd.plots)) {
      plotsArray = rd.plots;
    } else if (Array.isArray(rd.features)) {
      plotsArray = rd.features;
    } else if (rd.feature && rd.feature.type === 'Feature' && rd.feature.geometry) {
      plotsArray = [rd.feature];
    }

    const wuFromStored = waterClasswiseToTileUrlMap(rd.classwise);

    const tileUrlsMap: Record<string, string> = {};
    const plotsForMap: { id: string; area_ha: string; boundary: Coordinate[] }[] = [];

    plotsArray.forEach((plot: any, index: number) => {
      const plotId =
        plot.properties?.plot_id ||
        plot.plot_id ||
        plot.properties?.plot_name ||
        plot.plot_name ||
        `plot-${index}`;
      const tileUrl = plot.properties?.tile_url || plot.tile_url;

      if (tileUrl && typeof tileUrl === 'string' && tileUrl.includes('earthengine.googleapis.com')) {
        tileUrlsMap[String(plotId)] = tileUrl.trim();
      }

      // Geometry â†’ boundary for map
      let coordinates: number[][] = [];
      if (plot.geometry && plot.geometry.coordinates) {
        const geomCoords = plot.geometry.coordinates;
        if (plot.geometry.type === 'Polygon' && Array.isArray(geomCoords) && geomCoords.length > 0) {
          const firstRing = geomCoords[0];
          if (Array.isArray(firstRing) && firstRing.length > 0 && Array.isArray(firstRing[0])) {
            if (firstRing[0].length === 2 && typeof firstRing[0][0] === 'number') {
              coordinates = firstRing as unknown as number[][];
            }
          }
        } else if (Array.isArray(geomCoords) && geomCoords.length > 0) {
          const firstItem = geomCoords[0];
          if (Array.isArray(firstItem) && firstItem.length === 2 && typeof firstItem[0] === 'number') {
            coordinates = geomCoords as unknown as number[][];
          }
        }
      } else if (plot.coordinates && Array.isArray(plot.coordinates)) {
        coordinates = plot.coordinates;
      }

      if (coordinates && coordinates.length >= 3) {
        const boundary: Coordinate[] = coordinates
          .filter((coord: any) => Array.isArray(coord) && coord.length >= 2)
          .map((coord: any) => [coord[0], coord[1]] as Coordinate);
        if (boundary.length >= 3 && plotId) {
          plotsForMap.push({
            id: String(plotId),
            area_ha: String(plot.properties?.area_acres || plot.area_acres || 0),
            boundary,
          });
        }
      }
    });

    setAllPlotsTileUrls((prev) => {
      const withoutWu = Object.fromEntries(Object.entries(prev).filter(([key]) => !key.startsWith('wu-')));
      return { ...withoutWu, ...tileUrlsMap, ...wuFromStored };
    });
    if (Object.keys(tileUrlsMap).length > 0 || Object.keys(wuFromStored).length > 0) {
      setShowTileLayers(true);
    }
    if (plotsForMap.length > 0) {
      setAllPlots(plotsForMap);
      const plotIds = plotsForMap.map((p) => p.id);
      setAvailablePlots(plotIds);
      setTotalPlotsCount(plotIds.length);
    }
  }, [splitScreenMode, selectedWaterYearMonth, waterStoredSeries, activeTab, selectedDistrict]);

  // Water tab: returning to "Current" restores sidebar + class tiles from latest API snapshot
  useEffect(() => {
    if (splitScreenMode) return;
    if (activeTab !== 'water') return;
    if (selectedWaterYearMonth != null) return;
    if (!waterCurrentSnapshot || !Array.isArray((waterCurrentSnapshot as any).classwise)) return;

    setAllPlotsAnalysisData((prev) => ({
      ...prev,
      water: waterCurrentSnapshot as any,
    }));
    const wuTiles = waterClasswiseToTileUrlMap((waterCurrentSnapshot as any).classwise);
    if (Object.keys(wuTiles).length === 0) return;
    setAllPlotsTileUrls((prev) => {
      const rest = Object.fromEntries(
        Object.entries(prev).filter(([key]) => !key.startsWith('wu-') && key !== WATER_UPTAKE_CLASS_TILE_KEY)
      );
      return { ...rest, ...wuTiles };
    });
    setShowTileLayers(true);
  }, [activeTab, selectedWaterYearMonth, waterCurrentSnapshot, splitScreenMode]);

  // When a stored pest year_month is selected for left side, update hierarchy, sidebar cards and map tile
  useEffect(() => {
    if (!splitScreenMode || getActiveTab('left') !== 'pest' || !leftPestStoredSeries || !leftSelectedPestYearMonth) return;

    const item = leftPestStoredSeries.find((it) => it.year_month === leftSelectedPestYearMonth);
    if (!item || !item.response_data) return;

    const resp: any = item.response_data;
    const hierarchy = resp.hierarchy || {};

    // Build pest summary from hierarchy for sidebar cards
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

    setLeftAllPlotsAnalysisData((prev) => ({
      growth: prev?.growth || null,
      water: prev?.water || null,
      soil: prev?.soil || null,
      pest: pestSummary,
      waterSource: prev?.waterSource || null,
    }));

    // Update map tile_url for this month (overall pest tile)
    if (resp.tile_url) {
      setLeftAllPlotsTileUrls({ pest: resp.tile_url });
      setLeftShowTileLayers(true);
    }

    // Auto-select first available pest category if none is selected
    if (!leftSelectedPestCategory && hierarchy) {
      const order = ['healthy', 'chewing', 'fungi', 'sucking', 'wilt', 'soilborne'];
      const firstCategory = order.find((k) => hierarchy[k] != null);
      if (firstCategory) {
        setLeftSelectedPestCategory(firstCategory);
        const children = hierarchy[firstCategory]?.children;
        if (children) {
          setLeftShowPestChildren(Object.keys(children).length > 0);
        }
      }
    }
  }, [splitScreenMode, leftActiveTab, leftPestStoredSeries, leftSelectedPestYearMonth, leftSelectedPestCategory]);

  // When a stored pest year_month is selected for right side, update hierarchy, sidebar cards and map tile
  useEffect(() => {
    if (!splitScreenMode || getActiveTab('right') !== 'pest' || !rightPestStoredSeries || !rightSelectedPestYearMonth) return;

    const item = rightPestStoredSeries.find((it) => it.year_month === rightSelectedPestYearMonth);
    if (!item || !item.response_data) return;

    const resp: any = item.response_data;
    const hierarchy = resp.hierarchy || {};

    // Build pest summary from hierarchy for sidebar cards
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

    setRightAllPlotsAnalysisData((prev) => ({
      growth: prev?.growth || null,
      water: prev?.water || null,
      soil: prev?.soil || null,
      pest: pestSummary,
      waterSource: prev?.waterSource || null,
    }));

    // Update map tile_url for this month (overall pest tile)
    if (resp.tile_url) {
      setRightAllPlotsTileUrls({ pest: resp.tile_url });
      setRightShowTileLayers(true);
    }

    // Auto-select first available pest category if none is selected
    if (!rightSelectedPestCategory && hierarchy) {
      const order = ['healthy', 'chewing', 'fungi', 'sucking', 'wilt', 'soilborne'];
      const firstCategory = order.find((k) => hierarchy[k] != null);
      if (firstCategory) {
        setRightSelectedPestCategory(firstCategory);
        const children = hierarchy[firstCategory]?.children;
        if (children) {
          setRightShowPestChildren(Object.keys(children).length > 0);
        }
      }
    }
  }, [splitScreenMode, rightActiveTab, rightPestStoredSeries, rightSelectedPestYearMonth, rightSelectedPestCategory]);

  // Reset selected pest child series when main category changes
  useEffect(() => {
    setSelectedPestChildSeries(null);
  }, [selectedPestCategory]);

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

  // Fetch wind AOI (/weather/wind-direct) for main map Wind layer (district / subdistrict / village)
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!selectedDistrict) {
        setWindDirectData(null);
        return;
      }
      try {
        const data = await fetchWindDirect(
          selectedDistrict,
          selectedSubdistrict || undefined,
          selectedVillage || undefined
        );
        if (!cancelled) setWindDirectData(data);
      } catch {
        if (!cancelled) setWindDirectData(null);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedDistrict, selectedSubdistrict, selectedVillage]);

  // Fetch Daily Weather for left side in split screen mode
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!splitScreenMode || !leftSelectedDistrict) {
        setLeftWeatherDailyData(null);
        setLeftWeatherDailyError(null);
        setLeftWeatherDailyLoading(false);
        return;
      }
      try {
        setLeftWeatherDailyLoading(true);
        setLeftWeatherDailyError(null);
        const data = await fetchWeatherDaily(
          leftSelectedDistrict,
          leftSelectedSubdistrict || undefined,
          leftSelectedVillage || undefined
        );
        if (!cancelled) setLeftWeatherDailyData(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load daily weather';
        if (!cancelled) {
          setLeftWeatherDailyData(null);
          setLeftWeatherDailyError(msg);
        }
      } finally {
        if (!cancelled) setLeftWeatherDailyLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [splitScreenMode, leftSelectedDistrict, leftSelectedSubdistrict, leftSelectedVillage]);

  // Fetch Daily Weather for right side in split screen mode
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!splitScreenMode || !rightSelectedDistrict) {
        setRightWeatherDailyData(null);
        setRightWeatherDailyError(null);
        setRightWeatherDailyLoading(false);
        return;
      }
      try {
        setRightWeatherDailyLoading(true);
        setRightWeatherDailyError(null);
        const data = await fetchWeatherDaily(
          rightSelectedDistrict,
          rightSelectedSubdistrict || undefined,
          rightSelectedVillage || undefined
        );
        if (!cancelled) setRightWeatherDailyData(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load daily weather';
        if (!cancelled) {
          setRightWeatherDailyData(null);
          setRightWeatherDailyError(msg);
        }
      } finally {
        if (!cancelled) setRightWeatherDailyLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [splitScreenMode, rightSelectedDistrict, rightSelectedSubdistrict, rightSelectedVillage]);

  // Use all plots from taluka, or selected plot if analysis data is loaded, or GeoJSON plots if loaded
  const plots = geojsonPlots.length > 0 
    ? geojsonPlots 
    : (allPlots.length > 0 ? allPlots : (plotBoundary.length > 0 ? [{
        id: selectedPlotId || '',
        area_ha: String(areaHa || 0),
        boundary: plotBoundary
      }] : []));

  // Helper function to get pixel data for a specific side
  const getCurrentPixelData = (side: 'left' | 'right' = 'left') => {
    const sideActiveTab = getActiveTab(side);
    const sideAllPlotsAnalysisData = getAllPlotsAnalysisData(side);
    
    if (sideActiveTab === 'growth') {
      return sideAllPlotsAnalysisData?.growth || growthData;
    } else if (sideActiveTab === 'water') {
      return sideAllPlotsAnalysisData?.water || waterData;
    } else if (sideActiveTab === 'soil') {
      return sideAllPlotsAnalysisData?.soil || soilData;
    } else if (sideActiveTab === 'pest') {
      return sideAllPlotsAnalysisData?.pest || pestData;
    } else if (sideActiveTab === 'waterSource') {
      return sideAllPlotsAnalysisData?.waterSource || null;
    } else if (sideActiveTab === 'forest') {
      return forestData; // Forest data for legend circles
    }
    return null;
  };

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

  /** Growth class colors when API does not send per-class color (matches chart legend). */
  const GROWTH_CLASS_COLORS: Record<string, string> = {
    weak: '#bc1e29',
    stress: '#58cf54',
    moderate: '#28ae31',
    healthy: '#00351d',
  };

  /** Water uptake class colors â€” same as bottom chart; used before load and when API omits `color`. */
  const WATER_CLASS_COLORS: Record<string, string> = {
    deficient: '#EBFF34',
    less: '#CC8213',
    adequat: '#1348E8',
    adequate: '#1348E8',
    excellent: '#2E199A',
    excess: '#060217',
  };

  const waterColorForLabel = (label: string): string => {
    const k = (label || '').toLowerCase().replace(/\s+/g, '');
    return WATER_CLASS_COLORS[k] ?? '#CC8213';
  };

  /** Readable text (black or white) on top of arbitrary hex background. */
  const textColorOnBackground = (hex: string | undefined): string => {
    const raw = (hex || '#888888').replace(/^#/, '');
    const full =
      raw.length === 3
        ? raw
            .split('')
            .map((c) => c + c)
            .join('')
        : raw.padEnd(6, '0').slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#111827';
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? '#111827' : '#ffffff';
  };

  // Format percentage for display (small values show 2 decimals)
  const formatPct = (p: number) =>
    p > 0 && p < 1 ? p.toFixed(2) : String(Math.round(p));

  // Format class_name for display: "shallow_water" -> "Shallow Water"
  const formatClassLabel = (name: string) =>
    (name || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // Tab name for Health Trends card header (e.g. growth -> "Growth", waterSource -> "Water Source")
  const getActiveTabDisplayName = (side: 'left' | 'right' = 'left'): string => {
    const tab = getActiveTab(side);
    if (!tab && lstTileUrl) return 'LST';
    if (!tab) return 'Health Trends';
    const names: Record<string, string> = {
      growth: 'Growth',
      water: 'Water',
      soil: 'Soil',
      pest: 'Pest',
      waterSource: 'Water Source',
      forest: 'Forest',
    };
    return names[tab] || (tab.charAt(0).toUpperCase() + tab.slice(1));
  };

  // Location name for Daily Weather card header: village, or subdistrict, or district
  const getWeatherCardLocationName = (side: 'left' | 'right' = 'left'): string => {
    if (!splitScreenMode) {
      return selectedVillage || selectedSubdistrict || selectedDistrict || 'â€”';
    }
    if (side === 'left') return leftSelectedVillage || leftSelectedSubdistrict || leftSelectedDistrict || 'â€”';
    return rightSelectedVillage || rightSelectedSubdistrict || rightSelectedDistrict || 'â€”';
  };

  // Helper function to calculate area cards for a specific side
  const calculateAreaCards = (side: 'left' | 'right' = 'left'): { label: string; value: number; percentage?: number; color?: string; tileUrl?: string | null; pestKey?: string }[] => {
    const sideActiveTab = getActiveTab(side);
    const sidePixelData = getCurrentPixelData(side);
    const sidePestHierarchy = side === 'left' ? (splitScreenMode ? null : pestHierarchy) : null; // TODO: Add right side pest hierarchy
    const areaCards: { label: string; value: number; percentage?: number; color?: string; tileUrl?: string | null; pestKey?: string }[] = [];
    const ps: any = sidePixelData || {};

    // Build from classwise array when API returns it (analyze_Growthclasswise, wateruptakeclasswise, SoilMoistureclasswise)
    const classwise = ps.classwise;
    if ((sideActiveTab === 'growth' || sideActiveTab === 'water' || sideActiveTab === 'soil') && classwise && Array.isArray(classwise) && classwise.length > 0) {
      classwise.forEach((c: any) => {
        const lbl = formatClassLabel(c.class_name || '');
        const rawColor = c.color != null && String(c.color).trim() !== '' ? String(c.color).trim() : null;
        const fallback =
          sideActiveTab === 'water'
            ? waterColorForLabel(lbl)
            : sideActiveTab === 'growth'
              ? (() => {
                  const lk = lbl.toLowerCase();
                  if (lk.includes('weak')) return GROWTH_CLASS_COLORS.weak;
                  if (lk.includes('stress')) return GROWTH_CLASS_COLORS.stress;
                  if (lk.includes('moderate')) return GROWTH_CLASS_COLORS.moderate;
                  if (lk.includes('healthy')) return GROWTH_CLASS_COLORS.healthy;
                  return '#f97316';
                })()
              : '#f97316';
        areaCards.push({
          label: lbl,
          value: Number(c.area_hectares ?? 0),
          percentage: Number(c.percentage ?? 0),
          color: rawColor || fallback,
          tileUrl: c.tile_url ?? undefined,
        });
      });
    } else if (sideActiveTab === 'growth') {
      areaCards.push(
        { label: 'Weak', value: Number(ps.weak_area_hectares || 0), percentage: Number(ps.weak_pixel_percentage ?? 0), color: GROWTH_CLASS_COLORS.weak },
        { label: 'Stress', value: Number(ps.stress_area_hectares || 0), percentage: Number(ps.stress_pixel_percentage ?? 0), color: GROWTH_CLASS_COLORS.stress },
        { label: 'Moderate', value: Number(ps.moderate_area_hectares || 0), percentage: Number(ps.moderate_pixel_percentage ?? 0), color: GROWTH_CLASS_COLORS.moderate },
        { label: 'Healthy', value: Number(ps.healthy_area_hectares || 0), percentage: Number(ps.healthy_pixel_percentage ?? 0), color: GROWTH_CLASS_COLORS.healthy },
      );
    } else if (sideActiveTab === 'water') {
      areaCards.push(
        { label: 'Deficient', value: Number(ps.deficient_area_hectare || 0), percentage: Number(ps.deficient_pixel_percentage ?? 0), color: WATER_CLASS_COLORS.deficient },
        { label: 'Less', value: Number(ps.less_area_hectare || 0), percentage: Number(ps.less_pixel_percentage ?? 0), color: WATER_CLASS_COLORS.less },
        { label: 'Adequate', value: Number(ps.adequat_area_hectare || 0), percentage: Number(ps.adequate_pixel_percentage ?? ps.adequat_pixel_percentage ?? 0), color: WATER_CLASS_COLORS.adequate },
        { label: 'Excellent', value: Number(ps.excellent_area_hectare || 0), percentage: Number(ps.excellent_pixel_percentage ?? 0), color: WATER_CLASS_COLORS.excellent },
        { label: 'Excess', value: Number(ps.excess_area_hectare || 0), percentage: Number(ps.excess_pixel_percentage ?? 0), color: WATER_CLASS_COLORS.excess },
      );
    } else if (sideActiveTab === 'soil') {
      areaCards.push(
        { label: 'Less', value: Number(ps.less_area_hectare || 0), percentage: Number(ps.less_pixel_percentage ?? 0), color: '#f97316' },
        { label: 'Adequate', value: Number(ps.adequate_area_hectare || 0), percentage: Number(ps.adequate_pixel_percentage ?? 0), color: '#f97316' },
        { label: 'Excellent', value: Number(ps.excellent_area_hectare || 0), percentage: Number(ps.excellent_pixel_percentage ?? 0), color: '#f97316' },
        { label: 'Excess', value: Number(ps.excess_area_hectare || 0), percentage: Number(ps.excess_pixel_percentage ?? 0), color: '#f97316' },
        { label: 'Shallow Water', value: Number(ps.shallow_water_area_hectare || 0), percentage: Number(ps.shallow_water_pixel_percentage ?? 0), color: '#f97316' },
      );
    } else if (sideActiveTab === 'pest') {
      if (sidePestHierarchy?.hierarchy) {
        const order = ['chewing', 'fungi', 'sucking', 'wilt', 'soilborne'];
        order.forEach(k => {
          const node = sidePestHierarchy.hierarchy[k];
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
    return areaCards;
  };

  /** Compact area (ha) bar chart docked to map bottom â€” split screen only, one instance per pane. */
  const renderSplitScreenMapBottomGraph = (side: 'left' | 'right'): React.ReactNode => {
    if (!splitScreenMode) return null;
    const district = side === 'left' ? leftSelectedDistrict : rightSelectedDistrict;
    if (!district) return null;
    const tab = getActiveTab(side);
    if (!tab || !['growth', 'water', 'soil', 'pest'].includes(tab)) return null;
    const cardsAll = calculateAreaCards(side);
    if (!cardsAll.length) return null;

    const clipId = `split-map-bottom-clip-${side}-${tab}`;
    const H = 128;
    const W = 440;
    const paddingLeft = 40;
    const paddingRight = 10;
    const paddingTop = 6;
    const paddingBottom = 22;
    const chartW = W - paddingLeft - paddingRight;
    const chartH = H - paddingTop - paddingBottom;
    const values = cardsAll.map((c) => c.value);
    const maxVal = values.length > 0 ? Math.max(1, ...values.filter((v) => !Number.isNaN(v) && v >= 0)) : 1;
    const paddedMax = maxVal * 1.1;
    const n = cardsAll.length;
    const barGap = n > 6 ? 3 : n > 4 ? 5 : 7;
    const barWidth = n > 0 ? Math.max(3, (chartW - barGap * Math.max(0, n - 1)) / n) : 0;
    const axisMain = '#cbd5e1';
    const axisTick = '#475569';
    const labelFill = '#1e293b';

    return (
      <div
        className="absolute bottom-2 left-2 right-2 z-[850] flex max-h-[42vmin] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg ring-1 ring-black/5"
      >
        <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-800">
          {getActiveTabDisplayName(side)} Â· Area (ha)
        </div>
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden bg-white px-2 py-2">
          <svg width="100%" height={H} className="block min-w-[260px]" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMinYMid meet">
            <defs>
              <clipPath id={clipId}>
                <rect x={paddingLeft} y={paddingTop} width={chartW} height={chartH} />
              </clipPath>
            </defs>
            <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={H - paddingBottom} stroke={axisMain} strokeWidth={1} />
            <line
              x1={paddingLeft}
              y1={H - paddingBottom}
              x2={paddingLeft + chartW}
              y2={H - paddingBottom}
              stroke={axisMain}
              strokeWidth={1}
            />
            {[0, 0.5, 1].map((r) => {
              const value = paddedMax * r;
              const y = paddingTop + chartH - r * chartH;
              return (
                <g key={r}>
                  <line x1={paddingLeft - 4} y1={y} x2={paddingLeft} y2={y} stroke={axisMain} strokeWidth={1} />
                  <text x={paddingLeft - 6} y={y + 3} textAnchor="end" fontSize={9} fill={axisTick}>
                    {value.toFixed(0)}
                  </text>
                </g>
              );
            })}
            <g clipPath={`url(#${clipId})`}>
              {cardsAll.map((c, ci) => {
                const val = c.value ?? 0;
                const bh = paddedMax > 0 ? (val / paddedMax) * chartH : 0;
                const y = paddingTop + chartH - bh;
                const x = paddingLeft + ci * (barWidth + barGap);
                const fill = c.color || '#6b7280';
                return (
                  <rect
                    key={`${side}-split-btm-${c.label}-${ci}`}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(bh, 0)}
                    fill={fill}
                    rx={2}
                  />
                );
              })}
            </g>
            {cardsAll.map((c, ci) => {
              const x = paddingLeft + ci * (barWidth + barGap) + barWidth / 2;
              const short =
                c.label.length > 11 ? `${c.label.slice(0, 10)}â€¦` : c.label;
              return (
                <text
                  key={`${side}-split-btm-lbl-${ci}`}
                  x={x}
                  y={H - 5}
                  textAnchor="middle"
                  fontSize={8}
                  fill={labelFill}
                >
                  {short}
                </text>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  // Area cards data for sidebar: ha + percentage; for pest optionally tileUrl + pestKey for click-to-show on map + children panel
  const areaCards: { label: string; value: number; percentage?: number; color?: string; tileUrl?: string | null; pestKey?: string }[] = [];
  const ps: any = currentPixelData || {};

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
    <div className={`flex flex-col h-screen w-full font-sans overflow-hidden relative ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-[#eaf6f0] text-gray-900'} ${!isDarkMode ? 'theme-white' : ''}`}>
      {/* Bar Graph page - full screen when opened from header icon */}
      {false ? (
        <div className={`flex-1 flex flex-col overflow-auto ${isDarkMode ? 'bg-gray-900' : 'bg-[#eaf6f0]'}`}>
          <div className={`flex-shrink-0 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-emerald-100 bg-[#eaf6f0]'}`}>
            <div className="flex items-center gap-3 px-4 md:px-6 py-3">
              <button
                type="button"
                onClick={() => setShowGraphPage(false)}
                className="p-2 rounded-lg bg-gray-800 border border-white/40 text-white hover:bg-gray-700 transition-all flex items-center justify-center w-9 h-9 shrink-0"
                title="Home"
              >
                <Home size={18} />
              </button>
              <button
                type="button"
                onClick={() => setShowGraphPage(false)}
                className="p-2 rounded-lg bg-gray-800 border border-white/40 text-white hover:bg-gray-700 transition-all flex items-center justify-center w-9 h-9 shrink-0"
                title="Back"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center justify-center text-green-400">
                <TrendingUp size={22} />
              </div>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3 px-4 md:px-6 pb-3">
              <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">District</label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => { setSelectedDistrict(e.target.value); setSelectedSubdistrict(''); setSelectedVillage(''); }}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 min-w-[140px]"
                >
                  <option value="">-- Select District --</option>
                  {districts.map((d) => (
                    <option key={d.district} value={d.district}>{d.district}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Subdistrict</label>
                <select
                  value={selectedSubdistrict}
                  onChange={(e) => { setSelectedSubdistrict(e.target.value); setSelectedVillage(''); }}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 min-w-[140px]"
                  disabled={!selectedDistrict || subdistricts.length === 0}
                >
                  <option value="">-- Select Subdistrict --</option>
                  {subdistricts.map((s) => (
                    <option key={s.subdistrict} value={s.subdistrict}>{s.subdistrict}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Village</label>
                <select
                  value={selectedVillage}
                  onChange={(e) => setSelectedVillage(e.target.value)}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 min-w-[140px]"
                  disabled={!selectedSubdistrict || villages.length === 0}
                >
                  <option value="">-- Select Village --</option>
                  {villages.map((v) => (
                    <option key={v.village} value={v.village}>{v.village}</option>
                  ))}
                </select>
                {selectedVillage && (
                  <button
                    type="button"
                    onClick={() => setShowVillageBoundary(true)}
                    className="mt-2 w-full px-3 py-2 rounded-lg text-sm font-medium bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500"
                  >
                    Display boundary
                  </button>
                )}
              </div>
              {/* Frequency dropdown - same row as other filters */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Frequency</label>
                <select
                  value={dashboardIndicesFrequency}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDashboardIndicesFrequency(v === '' ? '' : (v as DashboardIndicesFrequency));
                  }}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 min-w-[140px]"
                >
                  <option value=""></option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              {dashboardIndicesError && selectedDistrict && (
                <div className="text-[10px] text-red-400 flex items-center gap-1 w-full basis-full">
                  {dashboardIndicesError}
                </div>
              )}
              </div>
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDashboardIndicesDownloadMenu(!showDashboardIndicesDownloadMenu)}
                  className="p-2 rounded-lg bg-gray-700 border border-gray-600 text-white hover:bg-gray-600 transition-all flex items-center justify-center w-9 h-9"
                  title="Download"
                >
                  <Download size={18} />
                </button>
                {showDashboardIndicesDownloadMenu && (
                  <>
                    <div className="fixed inset-0 z-[998]" onClick={() => setShowDashboardIndicesDownloadMenu(false)} aria-hidden="true" />
                    <div className="absolute right-0 top-full mt-1 z-[999] py-1 rounded-lg border border-gray-600 bg-gray-800 shadow-xl min-w-[120px]">
                      <button
                        type="button"
                        onClick={() => downloadDashboardIndicesPDF()}
                        className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                      >
                        <FileText size={14} /> PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadDashboardIndicesExcel()}
                        className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                      >
                        <FileSpreadsheet size={14} /> Excel
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 p-4 md:p-6 overflow-auto">
            {!selectedDistrict ? (
              <div className="w-full max-w-4xl mx-auto rounded-lg border border-gray-700 bg-gray-800/80 p-8 text-center">
                <p className="text-gray-400">Select District, then choose Frequency to load indices data. Subdistrict and Village are optional filters.</p>
              </div>
            ) : dashboardIndicesLoading ? (
              <div className="w-full max-w-4xl mx-auto rounded-lg border border-gray-700 bg-gray-800/80 p-8 flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-green-400" size={32} />
                <p className="text-gray-400">Loading indices dataâ€¦</p>
              </div>
            ) : dashboardIndicesData?.stored && Array.isArray(dashboardIndicesData.stored) ? (
              (() => {
                const stored = (dashboardIndicesData as { stored: Array<{ index_name: string; period_date: string; value: number }> }).stored;
                const INDEX_NAMES = DASHBOARD_INDEX_ORDER;
                const INDEX_DISPLAY_LABELS = DASHBOARD_INDEX_LABELS;
                const byIndex: Record<string, Array<{ period_date: string; value: number }>> = {};
                INDEX_NAMES.forEach((name) => {
                  byIndex[name] = [];
                });
                stored.forEach((item: { index_name: string; period_date: string; value: number }) => {
                  const key = item.index_name.toLowerCase();
                  if (byIndex[key]) {
                    byIndex[key].push({ period_date: item.period_date, value: item.value });
                  }
                });
                INDEX_NAMES.forEach((name) => {
                  byIndex[name].sort((a, b) => a.period_date.localeCompare(b.period_date));
                });
                const cardColors = DASHBOARD_INDEX_CARD_COLORS_HEX;
                const yearPalette = INDICES_CHART_YEAR_PALETTE;
                const idxMeta = dashboardIndicesData as DashboardIndicesStoreResponse;
                const emptyIndicesSeries = stored.length === 0;
                return (
                  <div className="w-full px-4 md:px-6 space-y-6">
                    {emptyIndicesSeries && (
                      <div className="rounded-lg border border-amber-700/50 bg-gray-800/90 px-3 py-2 text-xs text-amber-100/95">
                        {idxMeta.count === 0 ? (
                          <p className="font-medium">No indices rows for this selection (count: 0).</p>
                        ) : (
                          <p className="font-medium">
                            No numeric values to chart
                            {typeof idxMeta.count === 'number' ? ` (${idxMeta.count} periods in response)` : ''}.
                          </p>
                        )}
                        {idxMeta.note ? <p className="mt-1 text-gray-400">{idxMeta.note}</p> : null}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                      {INDEX_NAMES.map((indexName) => {
                        const points = byIndex[indexName] || [];
                        const titleColor = cardColors[indexName] ?? '#6b7280';

                        const isYearlyFreq = dashboardIndicesFrequency === 'yearly';

                        // Yearly API: one value per calendar year â€” x-axis shows years, not months
                        let chartData: Array<Record<string, string | number | null>>;
                        let years: string[];
                        const isWeeklyFreq = dashboardIndicesFrequency === 'weekly';
                        if (isYearlyFreq) {
                          const currentCalendarYear = new Date().getFullYear();
                          const byYear = new Map<number, number>();
                          points.forEach((p) => {
                            const date = new Date(p.period_date);
                            if (isNaN(date.getTime())) return;
                            const y = date.getFullYear();
                            if (y > currentCalendarYear) return;
                            byYear.set(y, p.value);
                          });
                          chartData = Array.from(byYear.entries())
                            .sort((a, b) => a[0] - b[0])
                            .map(([y, value]) => ({ year: String(y), value }));
                          years = [];
                        } else if (isWeeklyFreq) {
                          // Weekly: keep all period_date points and place them between month ticks
                          const yearsSet = new Set<number>();
                          const xRows: Record<string, Record<string, string | number | null>> = {};
                          points.forEach((p) => {
                            const date = new Date(p.period_date);
                            if (isNaN(date.getTime())) return;
                            const year = date.getFullYear();
                            yearsSet.add(year);
                            const monthIndex = date.getMonth();
                            const day = date.getDate();
                            const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
                            const x = monthIndex + (Math.max(1, day) - 1) / Math.max(1, daysInMonth);
                            const xKey = x.toFixed(4);
                            if (!xRows[xKey]) {
                              xRows[xKey] = { x };
                            }
                            xRows[xKey][String(year)] = p.value;
                          });
                          years = Array.from(yearsSet).sort((a, b) => a - b).map((y) => String(y));
                          chartData = Object.values(xRows).sort((a, b) => Number(a.x) - Number(b.x));
                        } else {
                          // Fixed 12 months (Janâ€“Dec) on x-axis so each year draws one continuous line
                          const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                          const monthMap: Record<string, { month: string; monthIndex: number; [k: string]: string | number }> = {};
                          const monthYearAgg: Record<string, Record<string, { sum: number; count: number }>> = {};
                          const yearsSet = new Set<number>();

                          points.forEach((p) => {
                            const date = new Date(p.period_date);
                            if (isNaN(date.getTime())) return;
                            const year = date.getFullYear();
                            const monthIndex = date.getMonth();
                            const monthLabel = date.toLocaleString('en-US', { month: 'short' });
                            const key = `${monthIndex}-${monthLabel}`;
                            yearsSet.add(year);
                            if (!monthMap[key]) {
                              monthMap[key] = { month: monthLabel, monthIndex };
                            }
                            const yearKey = String(year);
                            if (!monthYearAgg[key]) monthYearAgg[key] = {};
                            if (!monthYearAgg[key][yearKey]) monthYearAgg[key][yearKey] = { sum: 0, count: 0 };
                            monthYearAgg[key][yearKey].sum += p.value;
                            monthYearAgg[key][yearKey].count += 1;
                          });

                          years = Array.from(yearsSet).sort((a, b) => a - b).map((y) => String(y));
                          chartData = MONTH_LABELS.map((month, monthIndex) => {
                            const key = `${monthIndex}-${month}`;
                            const entry = monthMap[key];
                            const row: Record<string, string | number | null> = { month };
                            years.forEach((y) => {
                              const agg = monthYearAgg[key]?.[y];
                              const val = agg && agg.count > 0 ? agg.sum / agg.count : undefined;
                              row[y] = typeof val === 'number' && !isNaN(val) ? val : null;
                            });
                            return row;
                          });
                        }

                        const latestForHeader = (() => {
                          if (isYearlyFreq) {
                            if (chartData.length === 0) return null;
                            const lastRow = chartData[chartData.length - 1];
                            const v = lastRow.value;
                            return typeof v === 'number' ? { value: v } : null;
                          }
                          return points.length > 0 ? points[points.length - 1] : null;
                        })();

                        return (
                          <div
                            key={indexName}
                            className="rounded-lg border border-gray-600 bg-gray-800/90 p-4 flex flex-col min-h-[280px]"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-gray-200 leading-tight pr-2" style={{ color: titleColor }}>
                                {INDEX_DISPLAY_LABELS[indexName] ?? indexName}
                              </span>
                              <div className="flex items-center gap-2">
                                {latestForHeader && (
                                  <span className="text-xs text-gray-400">
                                    {typeof latestForHeader.value === 'number' && (latestForHeader.value > 1000 || latestForHeader.value < -1000)
                                      ? latestForHeader.value.toExponential(2)
                                      : typeof latestForHeader.value === 'number'
                                        ? latestForHeader.value.toFixed(4)
                                        : String(latestForHeader.value)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-[10px] text-gray-500 mb-1">
                              {(isYearlyFreq ? chartData.length : points.length)} points Â· {dashboardIndicesFrequency}
                            </div>
                            {chartData.length > 0 ? (
                              <div className="w-full flex-1 min-h-[220px]" style={{ maxWidth: '100%', maxHeight: '70vh' }}>
                                <ResponsiveContainer width="100%" height={220}>
                                  <LineChart
                                    data={chartData}
                                    margin={{
                                      top: 10,
                                      right: 10,
                                      left: 0,
                                      bottom: isYearlyFreq && chartData.length > 10 ? 36 : 20,
                                    }}
                                  >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis
                                      dataKey={isYearlyFreq ? 'year' : (isWeeklyFreq ? 'x' : 'month')}
                                      type={isWeeklyFreq ? 'number' : 'category'}
                                      domain={isWeeklyFreq ? [0, 11.999] : undefined}
                                      ticks={
                                        isWeeklyFreq
                                          ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
                                          : isYearlyFreq
                                            ? chartData.map((row) => String(row.year ?? ''))
                                            : undefined
                                      }
                                      tickFormatter={isWeeklyFreq
                                        ? (v: number) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Math.max(0, Math.min(11, Math.floor(v)))] ?? ''
                                        : undefined}
                                      tick={{ fill: '#9ca3af', fontSize: isYearlyFreq && chartData.length > 12 ? 9 : 10 }}
                                      interval={isYearlyFreq || isWeeklyFreq ? 0 : 'preserveStartEnd'}
                                      angle={isYearlyFreq && chartData.length > 10 ? -40 : 0}
                                      textAnchor={isYearlyFreq && chartData.length > 10 ? 'end' : 'middle'}
                                      height={isYearlyFreq && chartData.length > 10 ? 48 : 24}
                                    />
                                    <YAxis
                                      width={48}
                                      tick={{ fill: '#9ca3af', fontSize: 10 }}
                                      tickFormatter={(v) => {
                                        if (v === 0) return '0';
                                        if (Math.abs(v) >= 1000 || (Math.abs(v) < 0.0001 && v !== 0)) return v.toExponential(1);
                                        if (Math.abs(v) < 1) return v.toFixed(3);
                                        return v.toFixed(2);
                                      }}
                                    />
                                    <Tooltip
                                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #4b5563', borderRadius: 6 }}
                                      labelStyle={{ color: '#d1d5db' }}
                                      formatter={(value: number, name: string) => [
                                        typeof value === 'number' ? value.toFixed(4) : value,
                                        name,
                                      ]}
                                      labelFormatter={(label) => {
                                        if (isYearlyFreq) return `Year ${label}`;
                                        if (!isWeeklyFreq) return label;
                                        const x = typeof label === 'number' ? label : Number(label);
                                        if (!Number.isFinite(x)) return label;
                                        const monthIdx = Math.max(0, Math.min(11, Math.floor(x)));
                                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                        const approxDay = Math.max(1, Math.min(31, Math.round((x - monthIdx) * 31 + 1)));
                                        return `${monthNames[monthIdx]} ${approxDay}`;
                                      }}
                                    />
                                    {!isYearlyFreq && (
                                      <Legend
                                        verticalAlign="bottom"
                                        align="center"
                                        content={({ payload }) => (
                                          <ul
                                            className="recharts-default-legend"
                                            style={{
                                              listStyle: 'none',
                                              margin: 0,
                                              padding: '6px 0 0',
                                              display: 'flex',
                                              flexWrap: 'wrap',
                                              justifyContent: 'center',
                                              alignItems: 'center',
                                              gap: '6px 12px',
                                              rowGap: '8px',
                                              maxWidth: '100%',
                                              fontSize: 10,
                                            }}
                                          >
                                            {(payload ?? []).map(
                                              (entry: { value?: string; color?: string; dataKey?: string | number }, i: number) => {
                                                const yk = String(entry.dataKey ?? entry.value ?? '');
                                                const dimmed =
                                                  indicesLegendHighlightedYear !== null && yk !== indicesLegendHighlightedYear;
                                                return (
                                                  <li key={String(entry.dataKey ?? entry.value ?? i)} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                                    <button
                                                      type="button"
                                                      onClick={() => toggleIndicesYearHighlight(yk)}
                                                      title="Highlight this year on the chart (others stay visible, dimmed). Click again to clear."
                                                      className="inline-flex items-center gap-1.5 bg-transparent border-0 p-0 cursor-pointer"
                                                      style={{ opacity: dimmed ? 0.4 : 1 }}
                                                    >
                                                      <span
                                                        style={{
                                                          width: 14,
                                                          height: 3,
                                                          backgroundColor: entry.color,
                                                          borderRadius: 1,
                                                          flexShrink: 0,
                                                        }}
                                                      />
                                                      <span
                                                        style={{
                                                          color: isDarkMode ? '#e7e5e4' : '#57534e',
                                                          fontWeight: indicesLegendHighlightedYear === yk ? 700 : 500,
                                                        }}
                                                      >
                                                        {entry.value}
                                                      </span>
                                                    </button>
                                                  </li>
                                                );
                                              }
                                            )}
                                          </ul>
                                        )}
                                      />
                                    )}
                                    {isYearlyFreq ? (
                                      <Line
                                        type="monotone"
                                        dataKey="value"
                                        name="Value"
                                        stroke={titleColor}
                                        dot={{
                                          r: 4,
                                          strokeWidth: 2,
                                          fill: isDarkMode ? '#111827' : '#f8fafc',
                                          stroke: titleColor,
                                        }}
                                        strokeWidth={2}
                                        connectNulls
                                        isAnimationActive
                                        animationDuration={600}
                                      />
                                    ) : (
                                      years.map((yearKey, idx) => {
                                          const isHi = indicesLegendHighlightedYear === yearKey;
                                          const isDim =
                                            indicesLegendHighlightedYear !== null && !isHi;
                                          const lineColor = yearPalette[idx % yearPalette.length];
                                          return (
                                            <Line
                                              key={yearKey}
                                              type="monotone"
                                              dataKey={yearKey}
                                              stroke={lineColor}
                                              dot={{
                                                r: isHi ? 3.5 : 2.5,
                                                strokeWidth: 1.5,
                                                fill: isDarkMode ? '#111827' : '#ffffff',
                                                stroke: lineColor,
                                              }}
                                              strokeWidth={isHi ? 3.5 : isDim ? 1.2 : 1.8}
                                              strokeOpacity={isDim ? 0.28 : 1}
                                              connectNulls
                                              isAnimationActive
                                              animationDuration={600}
                                            />
                                          );
                                        })
                                    )}
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            ) : (
                              <div className="min-h-[220px] flex items-center justify-center text-gray-500 text-xs">No data</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="w-full max-w-4xl mx-auto rounded-lg border border-gray-700 bg-gray-800/80 p-8 text-center">
                <p className="text-gray-400">Select District and Frequency to load indices. Subdistrict and Village can be selected to further filter data.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
      {/* Top strip: dark mode header; white mode thin border only */}
      {isDarkMode ? (
      <header className={`flex-shrink-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 md:gap-3 px-4 md:px-6 py-2 border-b z-20 ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-emerald-100 bg-[#eaf6f0]'}`}>
        <div className="justify-self-start min-w-0" />

        <div className="justify-self-center min-w-0 max-w-[min(100vw-12rem,52rem)] flex justify-center">
          {!splitScreenMode && (
            <div className="flex gap-1 md:gap-1.5 bg-black/40 backdrop-blur-sm rounded-lg border border-gray-700 p-1 overflow-x-auto scrollbar-hide">
              <button
                type="button"
                onClick={() => toggleActiveTabForSide('growth', 'left')}
                className={`px-1.5 py-1 rounded-md transition-colors flex items-center justify-center shrink-0 min-w-[32px] ${
                  getActiveTab('left') === 'growth' ? 'bg-emerald-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                }`}
                title="Growth (click again to hide)"
              >
                <Sprout size={16} />
              </button>
              <button
                type="button"
                onClick={() => toggleActiveTabForSide('water', 'left')}
                className={`px-1.5 py-1 rounded-md transition-colors flex items-center justify-center shrink-0 min-w-[32px] ${
                  getActiveTab('left') === 'water' ? 'bg-sky-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                }`}
                title="Water Uptake (click again to hide)"
              >
                <Droplets size={16} />
              </button>
              <button
                type="button"
                onClick={() => toggleActiveTabForSide('soil', 'left')}
                className={`px-1.5 py-1 rounded-md transition-colors flex items-center justify-center shrink-0 min-w-[32px] ${
                  getActiveTab('left') === 'soil' ? 'bg-teal-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                }`}
                title="Soil Moisture (click again to hide)"
              >
                <Droplet size={16} />
              </button>
              <button
                type="button"
                onClick={() => toggleActiveTabForSide('pest', 'left')}
                className={`px-1.5 py-1 rounded-md transition-colors flex items-center justify-center shrink-0 min-w-[32px] ${
                  getActiveTab('left') === 'pest' ? 'bg-rose-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                }`}
                title="Pest (click again to hide)"
              >
                <Bug size={16} />
              </button>
              <button
                type="button"
                onClick={() => toggleActiveTabForSide('waterSource', 'left')}
                className={`px-1.5 py-1 rounded-md transition-colors flex items-center justify-center shrink-0 min-w-[32px] ${
                  getActiveTab('left') === 'waterSource' ? 'bg-blue-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                }`}
                title="Water Source (click again to hide)"
              >
                <Waves size={16} />
              </button>
              <button
                type="button"
                onClick={() => toggleActiveTabForSide('forest', 'left')}
                className={`px-1.5 py-1 rounded-md transition-colors flex items-center justify-center shrink-0 min-w-[32px] ${
                  getActiveTab('left') === 'forest' ? 'bg-lime-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                }`}
                title="Forest (click again to hide)"
              >
                <Trees size={16} />
              </button>
              <div
                onClick={async () => {
                  if (lstTileUrl) {
                    clearLstTileLayer();
                    return;
                  }
                  if (lstLoading || loading || !selectedDistrict) return;
                  lstClosedByUserRef.current = false;
                  try {
                    setLstLoading(true);
                    setError(null);
                    const response = await fetchLandSurfaceTemperature(selectedDistrict);
                    if (lstClosedByUserRef.current) return;
                    if (response.tile_url) {
                      setLstTileUrl(response.tile_url);
                      setAllPlotsTileUrls(prev => ({ ...prev, 'land-surface-temperature': response.tile_url }));
                      setShowTileLayers(true);
                    } else {
                      throw new Error('No tile_url in response');
                    }
                  } catch (err) {
                    if (lstClosedByUserRef.current) return;
                    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
                    setError(`Failed to load Land Surface Temperature: ${errorMessage}`);
                    setLstTileUrl(null);
                  } finally {
                    setLstLoading(false);
                  }
                }}
                role="button"
                tabIndex={0}
                className={`px-1.5 py-1 rounded-md border-2 transition-all duration-200 flex items-center shrink-0 ${
                  (lstTileUrl || (selectedDistrict && !lstLoading && !loading))
                    ? 'cursor-pointer hover:border-green-500 hover:bg-gray-600'
                    : 'cursor-not-allowed opacity-50'
                } ${lstTileUrl ? 'bg-green-600/20 border-green-500' : 'bg-gray-700 border-gray-600'}`}
                title="Land Surface Temperature (click again to hide)"
              >
                <Thermometer size={18} strokeWidth={2.2} className="shrink-0" />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 md:gap-2 justify-self-end">
          <button
            type="button"
            onClick={() => setIsDarkMode((prev) => !prev)}
            className={`p-2 rounded-lg border transition-all flex items-center justify-center w-9 h-9 shrink-0 ${
              isDarkMode
                ? 'bg-gray-800 border-white/40 text-white hover:bg-gray-700'
                : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100'
            }`}
            title={isDarkMode ? 'Switch to White Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <MdLightMode size={18} /> : <MdModeNight size={18} />}
          </button>
          {/* Download - right side */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              className="p-2 rounded-lg bg-gray-800 border border-white/40 text-white hover:bg-gray-700 transition-all flex items-center justify-center w-9 h-9 shrink-0"
              title="Download Data"
            >
              <Download size={18} />
            </button>
            {showDownloadMenu && (
              <>
                <div className="fixed inset-0 z-[998]" onClick={() => setShowDownloadMenu(false)} />
                <div className="absolute right-0 top-full mt-2 bg-black/90 backdrop-blur-sm rounded-md border border-gray-600 shadow-xl overflow-hidden z-[1000] min-w-[120px]">
                  <button
                    type="button"
                    onClick={() => { setShowDownloadMenu(false); downloadChartPDF(); }}
                    className="w-full px-3 py-2 text-white hover:bg-red-500/30 hover:text-red-300 flex items-center justify-center gap-2 transition-colors"
                  >
                    <FileText size={16} />
                    <span className="text-xs">PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDownloadMenu(false); downloadChartExcel(); }}
                    className="w-full px-3 py-2 text-white hover:bg-green-500/30 hover:text-green-300 flex items-center justify-center gap-2 transition-colors border-t border-gray-600/50"
                  >
                    <FileSpreadsheet size={16} />
                    <span className="text-xs">Excel</span>
                  </button>
                </div>
              </>
            )}
          </div>
          {/* Logout - right side */}
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-lg bg-gray-800 border border-white/40 text-white hover:bg-red-600/30 hover:border-red-500/50 transition-all flex items-center justify-center w-9 h-9 shrink-0"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      ) : (
        <div className="flex-shrink-0 h-2 bg-emerald-100 w-full" />
      )}

      <div className="flex flex-1 min-h-0 relative">
        {/* Mobile Overlay when sidebar is visible */}
        {sidebarVisible && (
          <div 
            className="md:hidden fixed inset-0 bg-black/50 z-[9]"
            onClick={() => setSidebarVisible(false)}
          />
        )}
        
        {/* Sidebar - no header inside; starts with CONFIGURATION */}
        {sidebarVisible && (
          <aside 
            className="w-full md:w-64 md:max-w-64 flex-shrink-0 min-w-0 border-r border-gray-700 flex flex-col z-10 shadow-xl relative overflow-hidden"
            style={{
              // White mode: mint canvas behind the configuration card (like your screenshot)
              backgroundColor: isDarkMode ? '#0f172a' : '#eaf6f0',
              backgroundImage: 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          >
            {/* Overlay for better text readability */}
            {isDarkMode && <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm"></div>}
            
            <div ref={sidebarScrollRef} className="relative z-10 flex flex-col h-full flex-1 overflow-y-auto p-4 space-y-4 pt-4">
              {/* Sidebar branding (Type-2) */}
              {!isDarkMode && (
                <div className="px-1">
                  <div className="leading-none font-extrabold text-[28px] tracking-tight">
                    <span className="text-emerald-800">Nearlive</span>
                    <br />
                    <span className="text-emerald-500">Crop</span>
                    <br />
                    <span className="text-emerald-400">Monitoring</span>
                  </div>
                  <div className="mt-2 text-[10px] tracking-[0.35em] font-semibold text-slate-500">
                    PRECISION INTELLIGENCE
                  </div>
                </div>
              )}

              {/* Sidebar nav (icon-only): split-screen, dashboard, download, 9-graphs */}
              <div className={`${!isDarkMode ? 'bg-white rounded-2xl border border-emerald-100 shadow-sm p-2' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setShowGraphPage(false);
                      setShowAnalysisTrendsPage(false);
                      setFullscreenAnalysisTrendCard(null);
                      setShowGraphFrequencyDropdown(false);
                      setSplitScreenMode((p) => !p);
                    }}
                    className={`h-10 w-10 rounded-xl border flex items-center justify-center transition-colors ${
                      isDarkMode
                        ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'
                        : 'bg-white border-emerald-100 text-gray-900 hover:bg-emerald-50'
                    }`}
                    title="Split screen"
                  >
                    <Columns size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowGraphPage(false);
                      setShowAnalysisTrendsPage(false);
                      setFullscreenAnalysisTrendCard(null);
                      setShowGraphFrequencyDropdown(false);
                      setSplitScreenMode(false);
                    }}
                    className={`h-10 w-10 rounded-xl border flex items-center justify-center transition-colors ${
                      isDarkMode
                        ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'
                        : 'bg-white border-emerald-100 text-gray-900 hover:bg-emerald-50'
                    }`}
                    title="Dashboard"
                  >
                    <Home size={18} />
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                      className={`h-10 w-10 rounded-xl border flex items-center justify-center transition-colors ${
                        isDarkMode
                          ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'
                          : 'bg-white border-emerald-100 text-gray-900 hover:bg-emerald-50'
                      }`}
                      title="Download"
                    >
                      <Download size={18} />
                    </button>
                    {showDownloadMenu && (
                      <>
                        <div className="fixed inset-0 z-[1199]" onClick={() => setShowDownloadMenu(false)} />
                        <div className="absolute left-0 top-full mt-2 bg-white rounded-xl border border-emerald-100 shadow-xl overflow-hidden z-[1200] min-w-[140px]">
                          <button
                            type="button"
                            onClick={() => { setShowDownloadMenu(false); downloadChartPDF(); }}
                            className="w-full px-3 py-2 text-gray-900 hover:bg-emerald-50 flex items-center justify-center gap-2 transition-colors"
                          >
                            <FileText size={16} />
                            <span className="text-xs">PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowDownloadMenu(false); downloadChartExcel(); }}
                            className="w-full px-3 py-2 text-gray-900 hover:bg-emerald-50 flex items-center justify-center gap-2 transition-colors border-t border-emerald-100"
                          >
                            <FileSpreadsheet size={16} />
                            <span className="text-xs">Excel</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowGraphPage(true);
                      setShowAnalysisTrendsPage(false);
                      setFullscreenAnalysisTrendCard(null);
                      setShowGraphFrequencyDropdown(true);
                    }}
                    className={`h-10 w-10 rounded-xl border flex items-center justify-center transition-colors ${
                      showGraphFrequencyDropdown
                        ? isDarkMode
                          ? 'bg-emerald-900/40 border-emerald-600 text-emerald-200'
                          : 'bg-emerald-100 border-emerald-300 text-emerald-900'
                        : isDarkMode
                          ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'
                          : 'bg-white border-emerald-100 text-gray-900 hover:bg-emerald-50'
                    }`}
                    title="9 graphs dashboard"
                  >
                    <LineChartIcon size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAnalysisTrendsPage(true);
                      setFullscreenAnalysisTrendCard(null);
                      setShowGraphPage(false);
                      setShowGraphFrequencyDropdown(false);
                    }}
                    className={`h-10 w-10 rounded-xl border flex items-center justify-center transition-colors ${
                      showAnalysisTrendsPage
                        ? isDarkMode
                          ? 'bg-emerald-900/40 border-emerald-600 text-emerald-200'
                          : 'bg-emerald-100 border-emerald-300 text-emerald-900'
                        : isDarkMode
                          ? 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'
                          : 'bg-white border-emerald-100 text-gray-900 hover:bg-emerald-50'
                    }`}
                    title="All-date analysis trends"
                  >
                    <BarChart3 size={18} />
                  </button>
                </div>
              </div>

              <div className={!isDarkMode ? 'bg-white rounded-2xl border border-emerald-100 shadow-sm p-4' : ''}>
                {showGraphPage && showGraphFrequencyDropdown && (
                  <div className={`${isDarkMode ? 'bg-gray-800/60' : 'bg-white'} rounded-xl border ${isDarkMode ? 'border-gray-700' : 'border-emerald-100'} p-3 mb-3`}>
                    <div className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>
                      Frequency
                    </div>
                    <select
                      value={dashboardIndicesFrequency}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDashboardIndicesFrequency(v === '' ? '' : (v as DashboardIndicesFrequency));
                      }}
                      className={`mt-2 w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                        isDarkMode
                          ? 'bg-gray-700 border border-gray-600 text-white'
                          : 'bg-white border border-emerald-100 text-slate-800'
                      }`}
                    >
                      <option value=""></option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                    <div className={`mt-2 text-[10px] ${isDarkMode ? 'text-gray-300' : 'text-slate-500'}`}>
                      (Graphs will update for this frequency.)
                    </div>
                    {(dashboardIndicesFrequency === 'weekly' || dashboardIndicesFrequency === 'monthly') && (
                      <div className="mt-3 pt-3 border-t border-dashed border-gray-600/60">
                        <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                          Year lines
                        </div>
                        <button
                          type="button"
                          onClick={clearIndicesYearHighlight}
                          disabled={indicesLegendHighlightedYear === null}
                          className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            indicesLegendHighlightedYear === null
                              ? isDarkMode
                                ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : isDarkMode
                                ? 'bg-emerald-800/80 text-emerald-100 hover:bg-emerald-700 border border-emerald-600'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-500'
                          }`}
                          title="Remove highlight — all years stay visible with equal emphasis"
                        >
                          Clear highlight
                        </button>
                        {indicesLegendHighlightedYear !== null && (
                          <p className={`mt-2 text-[10px] leading-snug ${isDarkMode ? 'text-emerald-200/90' : 'text-emerald-900'}`}>
                            <span className="font-semibold">{indicesLegendHighlightedYear}</span> is emphasized; other years are dimmed. All lines remain on the chart.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-white mb-3' : 'text-slate-400 mb-3'}`}>
                  CONFIGURATION
                </div>
          {/* Crops Dropdown - before District, independent */}
          {!showGraphPage && !showAnalysisTrendsPage && (
            <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
              Crops
            </label>
            <select
              value={selectedCrop}
              onChange={(e) => {
                setSelectedCrop(e.target.value);
                setSelectedVillage('');
                if (splitScreenMode) setLeftSelectedVillage('');
              }}
              className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                isDarkMode
                  ? 'bg-gray-700 border border-gray-600 text-white'
                  : 'bg-white border border-emerald-100 text-slate-800'
              }`}
            >
              <option value="">-- Select Crop --</option>
              <option value="sugarcane">Sugarcane</option>
            </select>
          </div>
          )}

          {/* District Dropdown */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
              Select District
            </label>
            <select
              value={getSelectedDistrict('left')}
              onChange={(e) => {
                if (splitScreenMode) {
                  setLeftSelectedDistrict(e.target.value);
                  setLeftSelectedSubdistrict('');
                  setLeftSelectedVillage('');
                } else {
                  setSelectedDistrict(e.target.value);
                  setSelectedSubdistrict('');
                  setSelectedVillage('');
                }
              }}
              className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                isDarkMode
                  ? 'bg-gray-700 border border-gray-600 text-white'
                  : 'bg-white border border-emerald-100 text-slate-800'
              }`}
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
          {getSelectedDistrict('left') && (
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                Select Subdistrict
              </label>
              <select
                value={getSelectedSubdistrict('left')}
                onChange={(e) => {
                  if (splitScreenMode) {
                    setLeftSelectedSubdistrict(e.target.value);
                    setLeftSelectedVillage('');
                  } else {
                    setSelectedSubdistrict(e.target.value);
                    setSelectedVillage('');
                  }
                }}
                className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                  isDarkMode
                    ? 'bg-gray-700 border border-gray-600 text-white'
                    : 'bg-white border border-emerald-100 text-slate-800'
                }`}
                disabled={getSubdistricts('left').length === 0}
              >
                <option value="">-- Select Subdistrict --</option>
                {getSubdistricts('left').map((subdistrict, index) => (
                  <option key={`left-subdistrict-${index}-${subdistrict.subdistrict || 'empty'}`} value={subdistrict.subdistrict}>
                    {subdistrict.subdistrict}
                  </option>
                ))}
              </select>
              </div>
          )}

          {/* Village Dropdown */}
          {getSelectedSubdistrict('left') && (
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                Select Village
              </label>
              <select
                value={getSelectedVillage('left')}
                onChange={(e) => {
                  if (splitScreenMode) {
                    setLeftSelectedVillage(e.target.value);
                  } else {
                    setSelectedVillage(e.target.value);
                  }
                }}
                className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                  isDarkMode
                    ? 'bg-gray-700 border border-gray-600 text-white'
                    : 'bg-white border border-emerald-100 text-slate-800'
                }`}
                disabled={getVillages('left').length === 0}
              >
                <option value="">-- Select Village --</option>
                {getVillages('left').map((village, index) => (
                  <option key={`left-village-${index}-${village.village || 'empty'}`} value={village.village}>
                    {village.village}
                  </option>
                ))}
              </select>
              {getSelectedVillage('left') && (
                <button
                  type="button"
                  onClick={() => {
                    if (splitScreenMode) {
                      if (getSelectedVillage('left')) setShowLeftVillageBoundary(true);
                    } else {
                      setShowVillageBoundary(true);
                    }
                  }}
                  className={`mt-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDarkMode
                      ? 'bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500'
                  }`}
                >
                  Display boundary
                </button>
              )}
            </div>
          )}

          {selectedCrop === 'sugarcane' && (splitScreenMode
            ? (leftSelectedDistrict && leftSelectedSubdistrict && leftSelectedVillage)
            : (selectedDistrict && selectedSubdistrict && selectedVillage)) && (
            <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-emerald-100 shadow-sm'}`}>
              <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                Sugarcane area (predicted)
              </div>
              {predictSugarcaneAreaLoading ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className={`animate-spin ${isDarkMode ? 'text-green-400' : 'text-emerald-600'}`} size={20} />
                </div>
              ) : predictSugarcaneAreaHa !== null && predictSugarcaneAreaHa !== undefined ? (
                <div className={`text-lg font-bold ${isDarkMode ? 'text-green-400' : 'text-emerald-700'}`}>
                  {predictSugarcaneAreaHa.toFixed(2)} ha
                </div>
              ) : (
                <div className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>No sugarcane area data</div>
              )}
            </div>
          )}
              </div>

          {/* Total Area Card */}
          {getSelectedDistrict('left') && (
            splitScreenMode || !['growth', 'water', 'soil', 'pest'].includes(getActiveTab('left') || '')
          ) && (
            <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {selectedPlotArea !== null ? 'Plot Area' : 'Total Area'}
              </div>
              {selectedPlotArea !== null ? (
                // Show selected plot area (from GeoJSON)
                <div className="text-xs font-bold text-green-400">
                  {selectedPlotArea.toFixed(2)} ha
                </div>
              ) : getTotalAreaLoading('left') ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="animate-spin text-green-400" size={20} />
                </div>
              ) : getTotalAreaHectares('left') !== null && getTotalAreaHectares('left') !== undefined ? (
                <div className="text-lg font-bold text-green-400">
                  {getTotalAreaHectares('left')!.toFixed(2)} ha
                </div>
              ) : (
                <div className="text-sm text-gray-500">No area data available</div>
              )}
            </div>
          )}

          {/* Total Water Area Card - Show when waterSource tab is active */}
          {getActiveTab('left') === 'waterSource' && getSelectedDistrict('left') && (
            <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Total Water Area
              </div>
              {getLoading('left') && getActiveTab('left') === 'waterSource' ? (
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

          {/* Percentage / Area (ha) â€” grid 2 per row; click loads tile on map */}
          {splitScreenMode && ['growth', 'water', 'soil', 'pest'].includes(getActiveTab('left') || '') && calculateAreaCards('left').length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Percentage / Area (ha)
              </div>
              <div className="grid grid-cols-2 gap-2">
              {calculateAreaCards('left').map((item, idx) => {
                const currentTab = getActiveTab('left');
                const cardBg = item.color || '#f97316';
                const cardFg = textColorOnBackground(cardBg);
                return (
                <div
                  key={`pct-${item.label}-${idx}`}
                  role={(currentTab === 'pest' && (item.tileUrl != null || item.pestKey != null)) || (['growth', 'water', 'soil'].includes(currentTab || '') && item.tileUrl != null) ? 'button' : undefined}
                  tabIndex={(currentTab === 'pest' && (item.tileUrl != null || item.pestKey != null)) || (['growth', 'water', 'soil'].includes(currentTab || '') && item.tileUrl != null) ? 0 : undefined}
                  onClick={() => {
                    if (currentTab === 'pest') {
                      if (item.tileUrl != null) {
                        setPestTileUrl(item.tileUrl!);
                        if (splitScreenMode) {
                          setLeftAllPlotsTileUrls({ pest: item.tileUrl! });
                          setLeftShowTileLayers(true);
                        } else {
                          setAllPlotsTileUrls({ pest: item.tileUrl! });
                          setShowTileLayers(true);
                        }
                      }
                      if (item.pestKey != null) {
                        if (splitScreenMode) {
                          setLeftSelectedPestCategory(item.pestKey);
                        } else {
                          setSelectedPestCategory(item.pestKey);
                        }
                        const children = pestHierarchy?.hierarchy[item.pestKey]?.children;
                        setShowPestChildren(!!children && Object.keys(children).length > 0);
                      }
                    } else if (['growth', 'water', 'soil'].includes(currentTab || '') && item.tileUrl != null) {
                      if (currentTab === 'water') {
                        // Keep district/plot base tile; add class raster on top (replacing whole map dropped base layer)
                        if (splitScreenMode) {
                          setLeftAllPlotsTileUrls((prev) => ({
                            ...prev,
                            [WATER_UPTAKE_CLASS_TILE_KEY]: item.tileUrl!,
                          }));
                          setLeftShowTileLayers(true);
                        } else {
                          setAllPlotsTileUrls((prev) => ({
                            ...prev,
                            [WATER_UPTAKE_CLASS_TILE_KEY]: item.tileUrl!,
                          }));
                          setShowTileLayers(true);
                        }
                      } else if (splitScreenMode) {
                        setLeftAllPlotsTileUrls({ [currentTab!]: item.tileUrl! });
                        setLeftShowTileLayers(true);
                      } else {
                        setAllPlotsTileUrls({ [currentTab!]: item.tileUrl! });
                        setShowTileLayers(true);
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      if ((currentTab === 'pest' && (item.tileUrl != null || item.pestKey != null)) || (['growth', 'water', 'soil'].includes(currentTab || '') && item.tileUrl != null))
                        e.currentTarget.click();
                    }
                  }}
                  style={{ backgroundColor: cardBg, color: cardFg }}
                  className={`p-3 rounded-xl border border-black/15 flex flex-col items-center text-center gap-1.5 min-w-0 ${
                    ((currentTab === 'pest' && (item.tileUrl != null || item.pestKey != null)) || (['growth', 'water', 'soil'].includes(currentTab || '') && item.tileUrl != null))
                      ? 'cursor-pointer hover:brightness-95 transition-all'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-center w-full min-w-0">
                    <span className="text-xs font-medium truncate w-full" style={{ color: cardFg }}>
                      {item.label}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 mt-1 w-full">
                    <span className="font-semibold text-xs md:text-sm break-words" style={{ color: cardFg }}>
                      {item.percentage != null ? `${formatPct(item.percentage)}%` : '0%'}
                    </span>
                    <span className="font-semibold text-xs md:text-sm break-words" style={{ color: cardFg }}>
                      {item.value.toFixed(2)} ha
                    </span>
                  </div>
                </div>
                );
              })}
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
          {getError('left') && (
            <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm flex flex-col items-center text-center gap-2">
              <AlertCircle size={20} />
              {getError('left')}
            </div>
          )}

          {/* Loading Indicator */}
          {getLoading('left') && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Loader2 className="animate-spin mb-2" size={32} />
              <span>Loading...</span>
            </div>
          )}
            </div>
            
            {/* Logout Button at Bottom */}
            <div className="p-1 border-t border-gray-700 bg-gray-900/50">
              <button
                onClick={handleLogout}
                // className="w-full logout-btn px-1 py-0.5 rounded text-[10px] transition-colors flex items-center justify-center gap-0.5 bg-red-600/20 hover:bg-red-600/30 border border-red-700/50 hover:border-red-600 text-red-300 hover:text-red-200"
                title="Logout"
              >
                <LogOut size={25} />
                {/* <span className="text-[10px]">Logout</span> */}
              </button>
            </div>
      </aside>
      )}

      {/* Home Icon Toggle Button removed (do not display) */}

      {/* Main Map Area - Shows two maps in split screen mode; scroll at 1440/1024 so map is viewable */}
      <main
        ref={mainScrollRef}
        className={`flex-1 w-full min-h-0 relative bg-gray-950 overflow-y-auto ${
          splitScreenMode
            ? 'flex'
            : !isMapFullscreen &&
              !showGraphPage &&
              !showAnalysisTrendsPage &&
              ['growth', 'water', 'soil', 'pest'].includes(getActiveTab('left') || '')
              ? 'flex flex-col md:flex-row md:items-stretch'
              : 'flex flex-col'
        }`}
      >
        {/* Pest graph PDF/Excel: use Download in sidebar only (no floating control on map) */}

          {/* Map Container - Reduced height when not split so two cards show below; min-height so map is viewable */}
        <div
          className={`relative w-full min-h-[min(320px,40vh)] ${
            splitScreenMode
              ? 'flex-1 w-1/2 border-r border-gray-700'
              : isMapFullscreen
                ? 'flex-1 min-h-[calc(100vh-140px)]'
                : (showGraphPage || showAnalysisTrendsPage)
                  ? 'flex-1 min-h-[calc(100vh-140px)]'
                  : ['growth', 'water', 'soil', 'pest'].includes(getActiveTab('left') || '')
                    ? 'flex-1 min-h-[calc(100vh-140px)] md:border-r md:border-gray-800'
                    : 'flex-1 min-h-[calc(100vh-140px)]'
          }`}
        >
          {showGraphPage && (
            <div
              className={`absolute inset-0 z-[1200] overflow-auto ${isDarkMode ? 'bg-gray-900' : 'bg-[#eaf6f0]'}`}
            >
              <div className="min-h-[100%]">
                <div className="flex-1 p-4 md:p-6 overflow-auto">
                  {!selectedDistrict ? (
                    <div className="w-full max-w-4xl mx-auto rounded-lg border border-gray-700 bg-gray-800/80 p-8 text-center">
                      <p className="text-gray-400">Select District, then choose Frequency to load indices data. Subdistrict and Village are optional filters.</p>
                    </div>
                  ) : dashboardIndicesLoading ? (
                    <div className="w-full max-w-4xl mx-auto rounded-lg border border-gray-700 bg-gray-800/80 p-8 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="animate-spin text-green-400" size={32} />
                      <p className="text-gray-400">Loading indices dataâ€¦</p>
                    </div>
                  ) : dashboardIndicesData?.stored && Array.isArray(dashboardIndicesData.stored) ? (
                    (() => {
                      const stored = (dashboardIndicesData as { stored: Array<{ index_name: string; period_date: string; value: number }> }).stored;
                      const INDEX_NAMES = DASHBOARD_INDEX_ORDER;
                      const INDEX_DISPLAY_LABELS = DASHBOARD_INDEX_LABELS;
                      const byIndex: Record<string, Array<{ period_date: string; value: number }>> = {};
                      INDEX_NAMES.forEach((name) => {
                        byIndex[name] = [];
                      });
                      stored.forEach((item: { index_name: string; period_date: string; value: number }) => {
                        const key = item.index_name.toLowerCase();
                        if (byIndex[key]) {
                          byIndex[key].push({ period_date: item.period_date, value: item.value });
                        }
                      });
                      INDEX_NAMES.forEach((name) => {
                        byIndex[name].sort((a, b) => a.period_date.localeCompare(b.period_date));
                      });
                      const cardColors = DASHBOARD_INDEX_CARD_COLORS_HEX;
                      const yearPalette = INDICES_CHART_YEAR_PALETTE;
                      const INDICES_CHUNK = 6;
                      const indexChunks: DashboardIndexKey[][] = [];
                      for (let i = 0; i < INDEX_NAMES.length; i += INDICES_CHUNK) {
                        indexChunks.push([...INDEX_NAMES.slice(i, i + INDICES_CHUNK)]);
                      }
                      const idxMetaFull = dashboardIndicesData as DashboardIndicesStoreResponse;
                      const emptyIndicesSeriesFull = stored.length === 0;
                      const renderIndexCard = (
                        indexName: DashboardIndexKey,
                        mode: 'grid' | 'fullscreen' | 'fullscreen-split' = 'grid',
                        fullscreenInstanceKey = 'main',
                      ) => {
                        const isSplitFullscreen = mode === 'fullscreen-split';
                              const points = byIndex[indexName] || [];
                              const titleColor = cardColors[indexName] ?? '#6b7280';

                              const isYearlyFreq = dashboardIndicesFrequency === 'yearly';
                              const isWeeklyFreq = dashboardIndicesFrequency === 'weekly';

                              // Yearly API: one value per calendar year â€” x-axis shows years, not months
                              let chartData: Array<Record<string, string | number | null>>;
                              let years: string[];

                              if (isYearlyFreq) {
                                const currentCalendarYear = new Date().getFullYear();
                                const byYear = new Map<number, number>();
                                points.forEach((p) => {
                                  const date = new Date(p.period_date);
                                  if (isNaN(date.getTime())) return;
                                  const y = date.getFullYear();
                                  if (y > currentCalendarYear) return;
                                  byYear.set(y, p.value);
                                });
                                chartData = Array.from(byYear.entries())
                                  .sort((a, b) => a[0] - b[0])
                                  .map(([y, value]) => ({ year: String(y), value }));
                                years = [];
                              } else if (isWeeklyFreq) {
                                // Weekly: keep all period_date points and place them between month ticks
                                const yearsSet = new Set<number>();
                                const xRows: Record<string, Record<string, string | number | null>> = {};
                                points.forEach((p) => {
                                  const date = new Date(p.period_date);
                                  if (isNaN(date.getTime())) return;
                                  const year = date.getFullYear();
                                  yearsSet.add(year);
                                  const monthIndex = date.getMonth();
                                  const day = date.getDate();
                                  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
                                  const x = monthIndex + (Math.max(1, day) - 1) / Math.max(1, daysInMonth);
                                  const xKey = x.toFixed(4);
                                  if (!xRows[xKey]) {
                                    xRows[xKey] = { x };
                                  }
                                  xRows[xKey][String(year)] = p.value;
                                });
                                years = Array.from(yearsSet).sort((a, b) => a - b).map((y) => String(y));
                                chartData = Object.values(xRows).sort((a, b) => Number(a.x) - Number(b.x));
                              } else {
                                // Fixed 12 months (Janâ€“Dec) on x-axis so each year draws one continuous line
                                const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                const monthMap: Record<string, { month: string; monthIndex: number; [k: string]: string | number }> = {};
                                const monthYearAgg: Record<string, Record<string, { sum: number; count: number }>> = {};
                                const yearsSet = new Set<number>();

                                points.forEach((p) => {
                                  const date = new Date(p.period_date);
                                  if (isNaN(date.getTime())) return;
                                  const year = date.getFullYear();
                                  const monthIndex = date.getMonth();
                                  const monthLabel = date.toLocaleString('en-US', { month: 'short' });
                                  const key = `${monthIndex}-${monthLabel}`;
                                  yearsSet.add(year);
                                  if (!monthMap[key]) {
                                    monthMap[key] = { month: monthLabel, monthIndex };
                                  }
                                  const yearKey = String(year);
                                  if (!monthYearAgg[key]) monthYearAgg[key] = {};
                                  if (!monthYearAgg[key][yearKey]) monthYearAgg[key][yearKey] = { sum: 0, count: 0 };
                                  monthYearAgg[key][yearKey].sum += p.value;
                                  monthYearAgg[key][yearKey].count += 1;
                                });

                                years = Array.from(yearsSet).sort((a, b) => a - b).map((y) => String(y));
                                chartData = MONTH_LABELS.map((month, monthIndex) => {
                                  const key = `${monthIndex}-${month}`;
                                  const entry = monthMap[key];
                                  const row: Record<string, string | number | null> = { month };
                                  years.forEach((y) => {
                                    const agg = monthYearAgg[key]?.[y];
                                    const val = agg && agg.count > 0 ? agg.sum / agg.count : undefined;
                                    row[y] = typeof val === 'number' && !isNaN(val) ? val : null;
                                  });
                                  return row;
                                });
                              }

                              const latestForHeader = (() => {
                                if (isYearlyFreq) {
                                  if (chartData.length === 0) return null;
                                  const lastRow = chartData[chartData.length - 1];
                                  const v = lastRow.value;
                                  return typeof v === 'number' ? { value: v } : null;
                                }
                                return points.length > 0 ? points[points.length - 1] : null;
                              })();

                              return (
                                <div
                                  key={mode === 'grid' ? indexName : `${indexName}-fs-${fullscreenInstanceKey}`}
                                  className={`rounded-lg border flex flex-col ${
                                    isSplitFullscreen
                                      ? isDarkMode
                                        ? 'h-full min-h-0 w-full flex-1 overflow-hidden border-gray-600 bg-gray-800/90 p-2 sm:p-3'
                                        : 'h-full min-h-0 w-full flex-1 overflow-hidden border-emerald-200/80 bg-white p-2 sm:p-3 shadow-sm'
                                      : mode === 'fullscreen'
                                        ? isDarkMode
                                          ? 'w-full min-h-0 border-gray-600 bg-gray-800/90 p-4'
                                          : 'w-full min-h-0 border-emerald-200/80 bg-white p-4 shadow-sm'
                                        : 'min-h-[280px] border-gray-600 bg-gray-800/90 p-4'
                                  }`}
                                >
                                  <div className={`flex items-center justify-between ${isSplitFullscreen ? 'mb-1 shrink-0' : 'mb-2'}`}>
                                    <span
                                      className={`text-sm font-semibold leading-tight pr-2 ${
                                        (mode === 'fullscreen' || isSplitFullscreen) && !isDarkMode ? 'text-stone-800' : 'text-gray-200'
                                      }`}
                                      style={{ color: titleColor }}
                                    >
                                      {INDEX_DISPLAY_LABELS[indexName] ?? indexName}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      {latestForHeader && (
                                        <span
                                          className={`text-xs ${(mode === 'fullscreen' || isSplitFullscreen) && !isDarkMode ? 'text-stone-600' : 'text-gray-400'}`}
                                        >
                                          {typeof latestForHeader.value === 'number' && (latestForHeader.value > 1000 || latestForHeader.value < -1000)
                                            ? latestForHeader.value.toExponential(2)
                                            : typeof latestForHeader.value === 'number'
                                              ? latestForHeader.value.toFixed(4)
                                              : String(latestForHeader.value)}
                                        </span>
                                      )}
                                      {mode === 'grid' && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setFullscreenIndicesOpenedFrom(indexName);
                                            setFullscreenIndicesCompare(indexName);
                                          }}
                                          className="p-1 rounded text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                                          title="Fullscreen"
                                        >
                                          <MdFullscreen size={18} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div
                                    className={`text-[10px] ${isSplitFullscreen ? 'mb-0.5 shrink-0' : 'mb-1'} ${
                                      (mode === 'fullscreen' || isSplitFullscreen) && !isDarkMode ? 'text-stone-500' : 'text-gray-500'
                                    }`}
                                  >
                                    {(isYearlyFreq ? chartData.length : points.length)} points Â· {dashboardIndicesFrequency}
                                  </div>
                                  {chartData.length > 0 ? (
                                    <div
                                      className={
                                        isSplitFullscreen
                                          ? 'relative w-full min-h-0 flex-1 overflow-hidden'
                                          : 'w-full flex-1 min-h-[220px]'
                                      }
                                      style={
                                        isSplitFullscreen
                                          ? { maxWidth: '100%', minHeight: 0, flex: '1 1 0%' }
                                          : {
                                              maxWidth: '100%',
                                              maxHeight: mode === 'fullscreen' ? '75vh' : '70vh',
                                              height: mode === 'fullscreen' ? 440 : 220,
                                            }
                                      }
                                    >
                                      <ResponsiveContainer width="100%" height="100%">
                                        <LineChart
                                          data={chartData}
                                          margin={{
                                            top: isSplitFullscreen ? 4 : 10,
                                            right: 8,
                                            left: 0,
                                            bottom: isSplitFullscreen
                                              ? isYearlyFreq && chartData.length > 10
                                                ? 28
                                                : isYearlyFreq
                                                  ? 16
                                                  : years.length > 6
                                                    ? 40
                                                    : 32
                                              : isYearlyFreq && chartData.length > 10
                                                ? 36
                                                : isYearlyFreq
                                                  ? 20
                                                  : years.length > 6
                                                    ? 52
                                                    : 42,
                                          }}
                                        >
                                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                          <XAxis
                                            dataKey={isYearlyFreq ? 'year' : isWeeklyFreq ? 'x' : 'month'}
                                            type={isWeeklyFreq ? 'number' : 'category'}
                                            domain={isWeeklyFreq ? [0, 11.999] : undefined}
                                            ticks={
                                              isWeeklyFreq
                                                ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
                                                : isYearlyFreq
                                                  ? chartData.map((row) => String(row.year ?? ''))
                                                  : undefined
                                            }
                                            tickFormatter={
                                              isWeeklyFreq
                                                ? (v: number) =>
                                                    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Math.max(0, Math.min(11, Math.floor(v)))] ?? ''
                                                : undefined
                                            }
                                            tick={{
                                              fill: '#9ca3af',
                                              fontSize:
                                                isYearlyFreq && chartData.length > 12
                                                  ? isSplitFullscreen
                                                    ? 8
                                                    : 9
                                                  : isSplitFullscreen
                                                    ? 9
                                                    : 10,
                                            }}
                                            interval={isYearlyFreq || isWeeklyFreq ? 0 : 'preserveStartEnd'}
                                            angle={isYearlyFreq && chartData.length > 10 ? -40 : 0}
                                            textAnchor={isYearlyFreq && chartData.length > 10 ? 'end' : 'middle'}
                                            height={
                                              isYearlyFreq && chartData.length > 10 ? (isSplitFullscreen ? 34 : 48) : isSplitFullscreen ? 20 : 24
                                            }
                                          />
                                          <YAxis
                                            width={48}
                                            tick={{ fill: '#9ca3af', fontSize: 10 }}
                                            tickFormatter={(v) => {
                                              if (v === 0) return '0';
                                              if (Math.abs(v) >= 1000 || (Math.abs(v) < 0.0001 && v !== 0)) return (v as number).toExponential(1);
                                              if (Math.abs(v) < 1) return (v as number).toFixed(3);
                                              return (v as number).toFixed(2);
                                            }}
                                          />
                                          <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #4b5563', borderRadius: 6 }}
                                            labelStyle={{ color: '#d1d5db' }}
                                            formatter={(value: number, name: string) => [typeof value === 'number' ? value.toFixed(4) : value, name]}
                                            labelFormatter={(label) => {
                                              if (isYearlyFreq) return `Year ${label}`;
                                              if (!isWeeklyFreq) return label;
                                              const x = typeof label === 'number' ? label : Number(label);
                                              if (!Number.isFinite(x)) return label;
                                              const monthIdx = Math.max(0, Math.min(11, Math.floor(x)));
                                              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                              const approxDay = Math.max(1, Math.min(31, Math.round((x - monthIdx) * 31 + 1)));
                                              return `${monthNames[monthIdx]} ${approxDay}`;
                                            }}
                                          />
                                          {!isYearlyFreq && (
                                            <Legend
                                              verticalAlign="bottom"
                                              align="center"
                                              content={({ payload }) => (
                                                <ul
                                                  className="recharts-default-legend"
                                                  style={{
                                                    listStyle: 'none',
                                                    margin: 0,
                                                    padding: '6px 0 0',
                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    gap: '6px 12px',
                                                    rowGap: '8px',
                                                    maxWidth: '100%',
                                                    fontSize: isSplitFullscreen ? 8 : 11,
                                                  }}
                                                >
                                                  {(payload ?? []).map(
                                                    (entry: { value?: string; color?: string; dataKey?: string | number }, i: number) => {
                                                      const yk = String(entry.dataKey ?? entry.value ?? '');
                                                      const dimmed =
                                                        indicesLegendHighlightedYear !== null && yk !== indicesLegendHighlightedYear;
                                                      return (
                                                        <li
                                                          key={String(entry.dataKey ?? entry.value ?? i)}
                                                          style={{ display: 'inline-flex', alignItems: 'center' }}
                                                        >
                                                          <button
                                                            type="button"
                                                            onClick={() => toggleIndicesYearHighlight(yk)}
                                                            title="Highlight this year (all years stay on chart). Click again to clear."
                                                            className="inline-flex items-center gap-1.5 bg-transparent border-0 p-0 cursor-pointer"
                                                            style={{ opacity: dimmed ? 0.4 : 1 }}
                                                          >
                                                            <span
                                                              style={{
                                                                width: 14,
                                                                height: 3,
                                                                backgroundColor: entry.color,
                                                                borderRadius: 1,
                                                                flexShrink: 0,
                                                              }}
                                                            />
                                                            <span
                                                              style={{
                                                                color: isDarkMode ? '#e7e5e4' : '#57534e',
                                                                fontWeight: indicesLegendHighlightedYear === yk ? 700 : 500,
                                                              }}
                                                            >
                                                              {entry.value}
                                                            </span>
                                                          </button>
                                                        </li>
                                                      );
                                                    }
                                                  )}
                                                </ul>
                                              )}
                                            />
                                          )}
                                          {isYearlyFreq ? (
                                            <Line
                                              type="monotone"
                                              dataKey="value"
                                              name="Value"
                                              stroke={titleColor}
                                              dot={{
                                                r: 4,
                                                strokeWidth: 2,
                                                fill: isDarkMode ? '#111827' : '#f8fafc',
                                                stroke: titleColor,
                                              }}
                                              strokeWidth={2}
                                              connectNulls
                                              isAnimationActive
                                              animationDuration={600}
                                            />
                                          ) : (
                                            years.map((yearKey, idx) => {
                                                const isHi = indicesLegendHighlightedYear === yearKey;
                                                const isDim =
                                                  indicesLegendHighlightedYear !== null && !isHi;
                                                const lineColor = yearPalette[idx % yearPalette.length];
                                                return (
                                                  <Line
                                                    key={yearKey}
                                                    type="monotone"
                                                    dataKey={yearKey}
                                                    stroke={lineColor}
                                                    dot={{
                                                      r: isHi ? 3.5 : 2.5,
                                                      strokeWidth: 1.5,
                                                      fill: isDarkMode ? '#111827' : '#ffffff',
                                                      stroke: lineColor,
                                                    }}
                                                    strokeWidth={isHi ? 3.5 : isDim ? 1.2 : 1.8}
                                                    strokeOpacity={isDim ? 0.28 : 1}
                                                    connectNulls
                                                    isAnimationActive
                                                    animationDuration={600}
                                                  />
                                                );
                                              })
                                          )}
                                        </LineChart>
                                      </ResponsiveContainer>
                                    </div>
                                  ) : (
                                    <div
                                      className={`flex items-center justify-center text-xs ${
                                        isSplitFullscreen ? 'min-h-0 flex-1' : 'min-h-[220px]'
                                      } ${
                                        (mode === 'fullscreen' || isSplitFullscreen) && !isDarkMode ? 'text-stone-500' : 'text-gray-500'
                                      }`}
                                    >
                                      No data
                                    </div>
                                  )}
                                </div>
                              );
                      };
                      return (
                        <div id="indices/retrieve-aggregated-cards" className="w-full px-4 md:px-6 space-y-6">
                          {fullscreenIndicesOpenedFrom && fullscreenIndicesCompare && (
                            <>
                              <div
                                className="fixed inset-0 z-[1190] bg-black/60"
                                onClick={() => {
                                  setFullscreenIndicesOpenedFrom(null);
                                  setFullscreenIndicesCompare(null);
                                }}
                                aria-hidden="true"
                              />
                              <div className="fixed inset-0 z-[1210] flex pointer-events-none">
                                <div
                                  role="dialog"
                                  aria-modal="true"
                                  aria-labelledby="indices-fullscreen-title"
                                  className={`pointer-events-auto flex h-[100dvh] max-h-[100dvh] w-full min-h-0 flex-col overflow-hidden rounded-none shadow-none border-0 ${
                                    isDarkMode ? 'bg-gray-900' : 'bg-[#f8fafc]'
                                  }`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div
                                    className={`flex flex-wrap items-center gap-2 sm:gap-3 px-4 py-2.5 sm:px-6 border-b shrink-0 ${
                                      isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-emerald-100 bg-[#f0fdf4]'
                                    }`}
                                  >
                                    <span
                                      id="indices-fullscreen-title"
                                      className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-stone-800'}`}
                                    >
                                      Compare index
                                    </span>
                                    <select
                                      id="indices-fullscreen-select"
                                      value={fullscreenIndicesCompare}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        if ((INDEX_NAMES as readonly string[]).includes(v)) {
                                          setFullscreenIndicesCompare(v as DashboardIndexKey);
                                        }
                                      }}
                                      className={`min-w-[12rem] max-w-[min(100%,28rem)] rounded-lg border px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/60 ${
                                        isDarkMode
                                          ? 'border-gray-500 bg-gray-800 text-gray-100'
                                          : 'border-emerald-300 bg-white text-stone-900'
                                      }`}
                                    >
                                      {INDEX_NAMES.map((n) => (
                                        <option key={n} value={n}>
                                          {INDEX_DISPLAY_LABELS[n] ?? n}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFullscreenIndicesOpenedFrom(null);
                                        setFullscreenIndicesCompare(null);
                                      }}
                                      className={`ml-auto inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                                        isDarkMode
                                          ? 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700'
                                          : 'border-emerald-300 bg-white text-stone-800 hover:bg-emerald-50'
                                      }`}
                                      title="Close"
                                    >
                                      <MdFullscreenExit size={18} />
                                      <span>Close</span>
                                    </button>
                                  </div>
                                  <div
                                    className={`flex flex-1 min-h-0 w-full flex-col gap-2 overflow-hidden px-3 py-2 sm:px-4 ${
                                      isDarkMode ? 'bg-gray-900' : 'bg-[#f8fafc]'
                                    }`}
                                  >
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden">
                                      <p
                                        className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${
                                          isDarkMode ? 'text-gray-400' : 'text-stone-600'
                                        }`}
                                      >
                                        Opened from (this chart)
                                      </p>
                                      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                                        {renderIndexCard(fullscreenIndicesOpenedFrom, 'fullscreen-split', 'primary')}
                                      </div>
                                    </div>
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden">
                                      <p
                                        className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${
                                          isDarkMode ? 'text-gray-400' : 'text-stone-600'
                                        }`}
                                      >
                                        Compare (dropdown)
                                      </p>
                                      {fullscreenIndicesCompare !== fullscreenIndicesOpenedFrom ? (
                                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                                          {renderIndexCard(fullscreenIndicesCompare, 'fullscreen-split', 'compare')}
                                        </div>
                                      ) : (
                                        <div
                                          className={`flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed px-4 text-center text-xs ${
                                            isDarkMode
                                              ? 'border-gray-600 bg-gray-800/50 text-gray-400'
                                              : 'border-emerald-200 bg-white text-stone-600'
                                          }`}
                                        >
                                          Choose a <strong className="font-semibold">different</strong> index in
                                          &quot;Compare index&quot; above to show a second graph here.
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                          {emptyIndicesSeriesFull && (
                            <div className="rounded-lg border border-amber-700/50 bg-gray-800/90 px-3 py-2 text-xs text-amber-100/95">
                              {idxMetaFull.count === 0 ? (
                                <p className="font-medium">No indices rows for this selection (count: 0).</p>
                              ) : (
                                <p className="font-medium">
                                  No numeric values to chart
                                  {typeof idxMetaFull.count === 'number'
                                    ? ` (${idxMetaFull.count} periods in response)`
                                    : ''}
                                  .
                                </p>
                              )}
                              {idxMetaFull.note ? <p className="mt-1 text-gray-400">{idxMetaFull.note}</p> : null}
                            </div>
                          )}
                          {(dashboardIndicesFrequency === 'weekly' || dashboardIndicesFrequency === 'monthly') && (
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-600 bg-gray-800/80 px-3 py-2">
                              <span className="text-xs text-gray-400">
                                {indicesLegendHighlightedYear !== null ? (
                                  <>
                                    Emphasizing <span className="font-semibold text-emerald-300">{indicesLegendHighlightedYear}</span>
                                    <span className="text-gray-500"> — other years dimmed, all still shown</span>
                                  </>
                                ) : (
                                  <>Click a year in any legend to emphasize that line; all years stay on the chart</>
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={clearIndicesYearHighlight}
                                disabled={indicesLegendHighlightedYear === null}
                                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                  indicesLegendHighlightedYear === null
                                    ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                                    : 'bg-emerald-700 text-white hover:bg-emerald-600 border border-emerald-500'
                                }`}
                                title="Clear highlight — equal emphasis on every year"
                              >
                                Clear highlight
                              </button>
                            </div>
                          )}
                          <div className="flex flex-col gap-5 md:gap-6 w-full">
                            {indexChunks.map((chunk, chunkIdx) => (
                              <div
                                key={chunkIdx}
                                id={`indices/retrieve-aggregated-chunk-${chunkIdx}`}
                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6"
                              >
                                {chunk.map((n) => renderIndexCard(n))}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="w-full max-w-4xl mx-auto rounded-lg border border-gray-700 bg-gray-800/80 p-8 text-center">
                      <p className="text-gray-400">Select District and Frequency to load indices. Subdistrict and Village can be selected to further filter data.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {showAnalysisTrendsPage && (
            <div
              className={`absolute inset-0 z-[1200] overflow-auto ${isDarkMode ? 'bg-gray-900' : 'bg-[#eaf6f0]'}`}
            >
              <div className="min-h-[100%]">
                <div className="flex-1 p-4 md:p-6 overflow-auto">
                  {!selectedDistrict ? (
                    <div className={`w-full max-w-4xl mx-auto rounded-lg p-8 text-center border ${
                      isDarkMode ? 'border-gray-700 bg-gray-800/80' : 'border-emerald-100 bg-white shadow-sm'
                    }`}>
                      <p className={isDarkMode ? 'text-gray-400' : 'text-slate-600'}>
                        Select District to load all-date trend graphs. Subdistrict and Village are optional filters.
                      </p>
                    </div>
                  ) : (
                    (() => {
                      const monthLabel = (ym: string | null) => {
                        if (!ym) return 'Current';
                        const [y, m] = ym.split('-');
                        if (!m) return ym;
                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const shortYear = y && y.length >= 2 ? y.slice(-2) : y;
                        return `${months[parseInt(m, 10) - 1] || m} '${shortYear}`;
                      };
                      const palette = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#14b8a6', '#ef4444', '#f59e0b', '#84cc16'];
                      const classwiseToMap = (classwise: any[] | undefined): Record<string, number> => {
                        if (!Array.isArray(classwise)) return {};
                        const out: Record<string, number> = {};
                        classwise.forEach((c) => {
                          const label = String(c?.class_name ?? c?.name ?? c?.label ?? '').trim();
                          if (!label) return;
                          out[label] = Number(c?.area_hectares ?? c?.area_ha ?? 0);
                        });
                        return out;
                      };
                      const normalizeLabel = (label: string): string => label.toLowerCase().replace(/\s+/g, '');
                      const buildClasswiseTrend = (
                        currentClasswise: any[] | undefined,
                        storedSeries: GrowthStoredResponse | null,
                        preferredOrder: string[],
                        colorMap: Record<string, string>
                      ): {
                        rows: Array<Record<string, string | number>>;
                        seriesKeys: string[];
                        seriesColors: Record<string, string>;
                      } => {
                        const periods = [
                          { label: 'Current', classwise: currentClasswise || [] },
                          ...((storedSeries || []).map((item: GrowthStoredItem) => ({
                            label: monthLabel(item.year_month),
                            classwise: (item.response_data as any)?.classwise || [],
                          }))),
                        ];
                        const discovered = new Set<string>();
                        periods.forEach((p) => Object.keys(classwiseToMap(p.classwise)).forEach((k) => discovered.add(k)));
                        const preferredLower = preferredOrder.map((v) => normalizeLabel(v));
                        const preferredFound = preferredOrder.filter((v) =>
                          Array.from(discovered).some((d) => normalizeLabel(d) === normalizeLabel(v))
                        );
                        const remaining = Array.from(discovered)
                          .filter((k) => !preferredLower.includes(normalizeLabel(k)))
                          .sort((a, b) => a.localeCompare(b));
                        const seriesKeys = [...preferredFound, ...remaining];
                        const rows = periods.map((p) => {
                          const areaMap = classwiseToMap(p.classwise);
                          const row: Record<string, string | number> = { label: p.label };
                          seriesKeys.forEach((k) => {
                            const matched = Object.keys(areaMap).find((name) => normalizeLabel(name) === normalizeLabel(k));
                            row[k] = Number(matched ? areaMap[matched] : 0);
                          });
                          return row;
                        });
                        const hasValues = rows.some((r) => seriesKeys.some((k) => Number(r[k] ?? 0) > 0));
                        const seriesColors: Record<string, string> = {};
                        seriesKeys.forEach((k, idx) => {
                          seriesColors[k] = colorMap[k] || colorMap[normalizeLabel(k)] || palette[idx % palette.length];
                        });
                        return hasValues ? { rows, seriesKeys, seriesColors } : { rows: [], seriesKeys: [], seriesColors: {} };
                      };
                      const growthTrend = buildClasswiseTrend(
                        growthCurrentData?.classwise,
                        growthStoredSeries,
                        ['Weak', 'Stress', 'Moderate', 'Healthy'],
                        { weak: '#bc1e29', stress: '#58cf54', moderate: '#28ae31', healthy: '#00351d' }
                      );
                      const waterTrend = buildClasswiseTrend(
                        (allPlotsAnalysisData as any)?.water?.classwise ?? (waterData as any)?.classwise,
                        waterStoredSeries,
                        ['Very low', 'Low', 'Moderate', 'High'],
                        {}
                      );
                      const soilTrend = buildClasswiseTrend(
                        (allPlotsAnalysisData as any)?.soil?.classwise ?? (soilData as any)?.classwise,
                        soilStoredSeries,
                        ['Very dry', 'Dry', 'Moderate', 'Wet'],
                        {}
                      );
                      const pestCategoryForGraph =
                        selectedPestCategory ||
                        ((pestStoredSeries && pestStoredSeries.length > 0)
                          ? Object.keys(((pestStoredSeries[0] as any).response_data?.hierarchy || {}))[0]
                          : null);
                      const pestTrend = (() => {
                        if (!pestCategoryForGraph) {
                          return { rows: [] as Array<Record<string, string | number>>, seriesKeys: [] as string[], seriesColors: {} as Record<string, string> };
                        }
                        const currentNode = (pestHierarchy?.hierarchy?.[pestCategoryForGraph] as any) || {};
                        const childKeys = new Set<string>();
                        Object.keys((currentNode?.children || {}) as Record<string, unknown>).forEach((k) => childKeys.add(k));
                        (pestStoredSeries || []).forEach((item: PestStoredItem) => {
                          const node = (item as any)?.response_data?.hierarchy?.[pestCategoryForGraph];
                          Object.keys((node?.children || {}) as Record<string, unknown>).forEach((k) => childKeys.add(k));
                        });
                        const seriesKeys = ['Total', ...Array.from(childKeys)];
                        const rows = [
                          (() => {
                            const row: Record<string, string | number> = { label: 'Current', Total: Number(currentNode?.total_area_ha ?? 0) };
                            Array.from(childKeys).forEach((child) => {
                              row[child] = Number((currentNode?.children?.[child] as any)?.area_ha ?? (currentNode?.children?.[child] as any)?.total_area_ha ?? 0);
                            });
                            return row;
                          })(),
                          ...(pestStoredSeries || [])
                            .filter((item: PestStoredItem) => (item as any)?.response_data?.hierarchy?.[pestCategoryForGraph])
                            .map((item: PestStoredItem) => {
                              const node = (item as any).response_data?.hierarchy?.[pestCategoryForGraph] || {};
                              const row: Record<string, string | number> = {
                                label: monthLabel(item.year_month),
                                Total: Number(node?.total_area_ha ?? 0),
                              };
                              Array.from(childKeys).forEach((child) => {
                                row[child] = Number((node?.children?.[child] as any)?.area_ha ?? (node?.children?.[child] as any)?.total_area_ha ?? 0);
                              });
                              return row;
                            }),
                        ];
                        const hasValues = rows.some((r) => seriesKeys.some((k) => Number(r[k] ?? 0) > 0));
                        const seriesColors: Record<string, string> = {};
                        seriesKeys.forEach((k, idx) => {
                          seriesColors[k] = k === 'Total' ? '#f97316' : palette[(idx + 1) % palette.length];
                        });
                        return hasValues ? { rows, seriesKeys, seriesColors } : { rows: [], seriesKeys: [], seriesColors: {} };
                      })();
                      const renderAnalysisTrendCard = (
                        cardKey: string,
                        title: string,
                        data: Array<Record<string, string | number>>,
                        seriesKeys: string[],
                        seriesColors: Record<string, string>,
                        emptyText: string,
                        isFullscreen: boolean = false
                      ) => (
                        <div className={`rounded-lg border ${isDarkMode ? 'border-gray-700 bg-gray-800/80' : 'border-emerald-100 bg-white shadow-sm'} p-4 ${isFullscreen ? 'min-h-[82vh]' : 'min-h-[460px]'}`}>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className={`text-[11px] font-semibold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-800'}`}>
                              {title} Â· all dates
                            </div>
                            <button
                              type="button"
                              onClick={() => setFullscreenAnalysisTrendCard(isFullscreen ? null : cardKey)}
                              className={`h-7 w-7 rounded-md border flex items-center justify-center transition-colors ${
                                isDarkMode
                                  ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600'
                                  : 'border-emerald-200 bg-white text-gray-700 hover:bg-emerald-50'
                              }`}
                              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                            >
                              {isFullscreen ? <MdFullscreenExit size={15} /> : <Maximize2 size={14} />}
                            </button>
                          </div>
                          {data.length > 0 && seriesKeys.length > 0 ? (
                            <div className={isFullscreen ? 'h-[70vh]' : 'h-[380px]'}>
                              {(() => {
                                const selectedSeries = analysisTrendSeriesFilter[cardKey] ?? null;
                                const visibleSeriesKeys = selectedSeries
                                  ? seriesKeys.filter((k) => k === selectedSeries)
                                  : seriesKeys;
                                const handleLegendToggle = (seriesKey: string) => {
                                  setAnalysisTrendSeriesFilter((prev) => ({
                                    ...prev,
                                    [cardKey]: prev[cardKey] === seriesKey ? null : seriesKey,
                                  }));
                                };
                                return (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data} barCategoryGap="22%">
                                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                                  <XAxis
                                    dataKey="label"
                                    tick={{ fill: isDarkMode ? '#d1d5db' : '#374151', fontSize: 11 }}
                                    interval={0}
                                    angle={-35}
                                    textAnchor="end"
                                    height={64}
                                  />
                                  <YAxis tick={{ fill: isDarkMode ? '#d1d5db' : '#374151', fontSize: 11 }} />
                                  <Tooltip />
                                  <Legend
                                    wrapperStyle={{ fontSize: 11, cursor: 'pointer' }}
                                    payload={seriesKeys.map((k) => ({
                                      value: k,
                                      id: k,
                                      type: 'square' as const,
                                      color: seriesColors[k],
                                    }))}
                                    content={() => (
                                      <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px]">
                                        {seriesKeys.map((k) => {
                                          const isActive = !selectedSeries || selectedSeries === k;
                                          return (
                                            <button
                                              key={`${cardKey}-${k}`}
                                              type="button"
                                              onClick={() => handleLegendToggle(k)}
                                              className={`inline-flex items-center gap-1.5 transition-opacity ${isActive ? 'opacity-100' : 'opacity-35'}`}
                                              title={`Show only ${k}`}
                                            >
                                              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: seriesColors[k] }} />
                                              <span className={isDarkMode ? 'text-gray-200' : 'text-slate-700'}>{k}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  />
                                  {visibleSeriesKeys.map((k) => (
                                    <Bar key={k} dataKey={k} fill={seriesColors[k]} radius={[2, 2, 0, 0]} />
                                  ))}
                                </BarChart>
                              </ResponsiveContainer>
                                );
                              })()}
                            </div>
                          ) : (
                            <div className={`${isFullscreen ? 'h-[70vh]' : 'h-[380px]'} flex items-center justify-center text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {emptyText}
                            </div>
                          )}
                        </div>
                      );
                      const trendCards = [
                        {
                          key: 'growth',
                          title: 'Growth',
                          data: growthTrend.rows,
                          seriesKeys: growthTrend.seriesKeys,
                          seriesColors: growthTrend.seriesColors,
                          emptyText: 'Growth all-date series not loaded yet',
                        },
                        {
                          key: 'water',
                          title: 'Water uptake',
                          data: waterTrend.rows,
                          seriesKeys: waterTrend.seriesKeys,
                          seriesColors: waterTrend.seriesColors,
                          emptyText: 'Water uptake all-date series not loaded yet',
                        },
                        {
                          key: 'soil',
                          title: 'Soil moisture',
                          data: soilTrend.rows,
                          seriesKeys: soilTrend.seriesKeys,
                          seriesColors: soilTrend.seriesColors,
                          emptyText: 'Soil moisture all-date series not loaded yet',
                        },
                        {
                          key: 'pest',
                          title: 'Pest',
                          data: pestTrend.rows,
                          seriesKeys: pestTrend.seriesKeys,
                          seriesColors: pestTrend.seriesColors,
                          emptyText: pestCategoryForGraph
                            ? `Pest all-date series not loaded for ${pestCategoryForGraph}`
                            : 'Select/open Pest once to load all-date series',
                        },
                      ] as const;
                      const fullscreenTrend = trendCards.find((c) => c.key === fullscreenAnalysisTrendCard);
                      return (
                        <div id="analysis-trends-cards" className="w-full px-4 md:px-6 space-y-6">
                          <div className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Growth / Water uptake / Soil moisture / Pest trends
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {trendCards.map((card) =>
                              renderAnalysisTrendCard(
                                card.key,
                                card.title,
                                card.data,
                                card.seriesKeys,
                                card.seriesColors,
                                card.emptyText
                              )
                            )}
                          </div>
                          {fullscreenTrend && (
                            <>
                              <div
                                className="fixed inset-0 z-[1240] bg-black/65"
                                onClick={() => setFullscreenAnalysisTrendCard(null)}
                                aria-hidden="true"
                              />
                              <div className="fixed inset-4 z-[1250]">
                                {renderAnalysisTrendCard(
                                  fullscreenTrend.key,
                                  fullscreenTrend.title,
                                  fullscreenTrend.data,
                                  fullscreenTrend.seriesKeys,
                                  fullscreenTrend.seriesColors,
                                  fullscreenTrend.emptyText,
                                  true
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
          )}

          {!splitScreenMode && (
            <div className="absolute top-4 left-4 z-[1100] flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMapFullScreen((p) => !p)}
                className={`p-2 rounded-lg border transition-colors flex items-center justify-center ${
                  isDarkMode
                    ? 'bg-black/60 border-gray-700 text-gray-200 hover:bg-black/75'
                    : 'bg-white/90 border-emerald-100 text-gray-900 hover:bg-white'
                }`}
                title={isMapFullscreen ? 'Exit fullscreen map' : 'Fullscreen map'}
              >
                {isMapFullscreen ? <MdFullscreenExit size={22} /> : <MdFullscreen size={22} />}
              </button>
              <button
                type="button"
                onClick={() => setShowWindFlowLayer((v) => !v)}
                disabled={!windDirectData?.points_weather?.length}
                className={`p-2 rounded-lg border transition-colors flex items-center justify-center gap-1.5 px-2.5 ${
                  isDarkMode
                    ? showWindFlowLayer && windDirectData?.points_weather?.length
                      ? 'bg-sky-700/95 border-sky-500 text-white shadow-md'
                      : 'bg-black/60 border-gray-700 text-gray-200 hover:bg-black/75 disabled:opacity-45 disabled:cursor-not-allowed'
                    : showWindFlowLayer && windDirectData?.points_weather?.length
                      ? 'bg-sky-600 text-white border-sky-700 shadow-md'
                      : 'bg-white/90 border-emerald-100 text-gray-900 hover:bg-white disabled:opacity-45 disabled:cursor-not-allowed'
                }`}
                title={
                  !windDirectData?.points_weather?.length
                    ? 'Wind flow: select a district and wait for AOI wind data'
                    : showWindFlowLayer
                      ? 'Hide wind flow (particles follow wind direction)'
                      : 'Show wind flow â€” red streaks move with wind; â–² markers show speed (km/h)'
                }
                aria-pressed={showWindFlowLayer}
              >
                <Wind size={20} strokeWidth={2.2} />
                <span className="text-xs font-semibold hidden min-[420px]:inline"></span>
              </button>
            </div>
          )}

          {/* White mode: left-side analysis tabs (icon-only) */}
          {!isDarkMode && !splitScreenMode && !isMapFullscreen && (
            <div className="absolute top-16 left-4 z-[1100] flex flex-col gap-2">
              {([
                ['growth', <Sprout size={16} />],
                ['water', <Droplets size={16} />],
                ['soil', <Droplet size={16} />],
                ['pest', <Bug size={16} />],
                ['waterSource', <Waves size={16} />],
                ['forest', <Trees size={16} />],
              ] as Array<[AnalysisType, JSX.Element]>).map(([tab, icon]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => toggleActiveTabForSide(tab, 'left')}
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${
                    getActiveTab('left') === tab
                      ? 'bg-emerald-500 text-black border-emerald-300'
                      : 'bg-white/90 text-gray-900 border-emerald-100 hover:bg-white'
                  }`}
                  title={String(tab)}
                >
                  {icon}
                </button>
              ))}
              <button
                type="button"
                onClick={async () => {
                  if (lstTileUrl) {
                    clearLstTileLayer();
                    return;
                  }
                  if (lstLoading || loading || !selectedDistrict) return;
                  lstClosedByUserRef.current = false;
                  try {
                    setLstLoading(true);
                    setError(null);
                    const response = await fetchLandSurfaceTemperature(selectedDistrict);
                    if (lstClosedByUserRef.current) return;
                    if (response.tile_url) {
                      setLstTileUrl(response.tile_url);
                      setAllPlotsTileUrls((prev) => ({ ...prev, 'land-surface-temperature': response.tile_url }));
                      setShowTileLayers(true);
                    } else {
                      throw new Error('No tile_url in response');
                    }
                  } catch (err) {
                    if (lstClosedByUserRef.current) return;
                    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
                    setError(`Failed to load Land Surface Temperature: ${errorMessage}`);
                    setLstTileUrl(null);
                  } finally {
                    setLstLoading(false);
                  }
                }}
                disabled={!lstTileUrl && (!selectedDistrict || lstLoading || loading)}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${
                  lstTileUrl
                    ? 'bg-orange-500 text-white border-orange-600 shadow-md'
                    : 'bg-white/90 text-gray-900 border-emerald-100 hover:bg-white disabled:opacity-45 disabled:cursor-not-allowed'
                }`}
                title="Land Surface Temperature (click again to hide)"
              >
                <Thermometer size={18} strokeWidth={2.2} />
              </button>
            </div>
          )}

          {/* Removed: "slider" button that auto-opened Pest tab */}
          {/* Water / Forest legend (normal mode only â€” tabs moved to header) */}
          {!splitScreenMode && !isMapFullscreen && getActiveTab('left') && (getActiveTab('left') === 'waterSource' || getActiveTab('left') === 'forest') && (
            <div className="absolute top-28 md:top-20 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-2 md:gap-4 px-2 md:px-0 w-auto max-w-[calc(100vw-2rem)]">
              <LegendCircles
                type={getActiveTab('left')!}
                data={currentPixelData}
                onForestAgeClassClick={(ageClass, tileUrl, areaHa) => {
                  setSelectedForestAgeClass(ageClass);
                  setForestTileUrl(tileUrl);
                  setForestAreaHa(areaHa);
                  setAllPlotsTileUrls({ 'forest': tileUrl });
                  setShowTileLayers(true);
                }}
              />
            </div>
          )}
          {/* Top Navigation Tabs - split screen only (normal mode uses header center) */}
          {splitScreenMode && (
          <div className={`absolute top-12 md:top-4 left-1/2 transform -translate-x-1/2 z-[1000] flex flex-col items-center gap-2 md:gap-4 px-2 md:px-0 ${splitScreenMode ? 'max-w-[calc(50vw-120px)]' : 'w-auto'}`}>
            {/* Active Tab Buttons - icons only */}
            <div className={`flex gap-1 md:gap-2 bg-black/60 backdrop-blur-sm rounded-lg border border-gray-700 p-1 overflow-x-auto ${splitScreenMode ? 'max-w-full' : 'w-auto'}`}>
              <button
                onClick={() => toggleActiveTabForSide('growth', 'left')}
                className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 min-w-[36px] ${
                  getActiveTab('left') === 'growth' ? 'bg-emerald-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                }`}
                title="Growth (click again to hide)"
              >
                <Sprout size={18} />
              </button>
              <button
                onClick={() => toggleActiveTabForSide('water', 'left')}
                className={`${splitScreenMode ? 'px-1.5 py-1 min-w-[28px]' : 'px-2 md:px-3 py-1.5 md:py-2 min-w-[36px]'} rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 ${
                  getActiveTab('left') === 'water' ? 'bg-sky-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                }`}
                title="Water Uptake (click again to hide)"
              >
                <Droplets size={splitScreenMode ? 16 : 18} />
              </button>
              <button
                onClick={() => toggleActiveTabForSide('soil', 'left')}
                className={`${splitScreenMode ? 'px-1.5 py-1 min-w-[28px]' : 'px-2 md:px-3 py-1.5 md:py-2 min-w-[36px]'} rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 ${
                  getActiveTab('left') === 'soil' ? 'bg-teal-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                }`}
                title="Soil Moisture (click again to hide)"
              >
                <Droplet size={splitScreenMode ? 16 : 18} />
              </button>
              <button
                onClick={() => toggleActiveTabForSide('pest', 'left')}
                className={`${splitScreenMode ? 'px-1.5 py-1 min-w-[28px]' : 'px-2 md:px-3 py-1.5 md:py-2 min-w-[36px]'} rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 ${
                  getActiveTab('left') === 'pest' ? 'bg-rose-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                }`}
                title="Pest (click again to hide)"
              >
                <Bug size={splitScreenMode ? 16 : 18} />
              </button>
              <button
                onClick={() => toggleActiveTabForSide('waterSource', 'left')}
                className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 min-w-[36px] ${
                  getActiveTab('left') === 'waterSource' ? 'bg-blue-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                }`}
                title="Water Source (click again to hide)"
              >
                <Waves size={18} />
              </button>
              <button
                onClick={() => toggleActiveTabForSide('forest', 'left')}
                className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 min-w-[36px] ${
                  getActiveTab('left') === 'forest' ? 'bg-lime-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                }`}
                title="Forest (click again to hide)"
              >
                <Trees size={18} />
              </button>

              {/* Land Surface Temperature â€” toggles on/off with repeat click */}
              <div 
                onClick={async () => {
                  if (lstTileUrl) {
                    clearLstTileLayer();
                    return;
                  }
                  if (lstLoading || loading || !selectedDistrict) return;
                  lstClosedByUserRef.current = false;
                  try {
                    setLstLoading(true);
                    setError(null);
                    
                    const response = await fetchLandSurfaceTemperature(selectedDistrict);
                    
                    if (lstClosedByUserRef.current) return;
                    if (response.tile_url) {
                      setLstTileUrl(response.tile_url);
                      setAllPlotsTileUrls(prev => ({ ...prev, 'land-surface-temperature': response.tile_url }));
                      setShowTileLayers(true);
                    } else {
                      throw new Error('No tile_url in response');
                    }
                  } catch (err) {
                    if (lstClosedByUserRef.current) return;
                    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
                    setError(`Failed to load Land Surface Temperature: ${errorMessage}`);
                    setLstTileUrl(null);
                  } finally {
                    setLstLoading(false);
                  }
                }}
                role="button"
                tabIndex={0}
                className={`${splitScreenMode ? 'px-1.5 py-1' : 'px-2 md:px-3 py-1.5 md:py-2'} rounded-md border-2 transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 ${
                  lstTileUrl || (selectedDistrict && !lstLoading && !loading)
                    ? 'cursor-pointer hover:border-green-500 hover:bg-gray-600' 
                    : 'cursor-not-allowed opacity-50'
                } ${
                  lstTileUrl 
                    ? 'bg-green-600/20 border-green-500' 
                    : 'bg-gray-700 border-gray-600'
                }`}
                title="Land Surface Temperature (click again to hide)"
              >
                <Thermometer size={splitScreenMode ? 17 : 19} strokeWidth={2.2} className="shrink-0" />
              </div>
            </div>
          </div>
          )}

          {/* Timeseries Tabs - Separate container in splitscreen (80% width) */}
          {splitScreenMode && getActiveTab('left') === 'pest' && (leftPestStoredSeries && leftPestStoredSeries.length > 0) && (
            <div className="absolute top-28 md:top-20 left-1/2 transform -translate-x-1/2 z-[1000] w-[80%] max-w-[calc(50vw-120px)]">
              <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-gray-700 p-1.5">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider">
                    Year / Month Series
                  </div>
                  {leftPestStoredLoading && (
                    <div className="text-[9px] text-gray-400">Loadingâ€¦</div>
                  )}
                </div>
                {leftPestStoredError ? (
                  <div className="text-[9px] text-red-300">{leftPestStoredError}</div>
                ) : (
                  <div className="flex items-center gap-1">
                    {/* Left Arrow */}
                    <button
                      type="button"
                      onClick={() => {
                        if (timeSeriesScrollRef.current) {
                          timeSeriesScrollRef.current.scrollBy({ left: -150, behavior: 'smooth' });
                        }
                      }}
                      className="flex-shrink-0 p-1 rounded bg-gray-800/80 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-white transition-colors"
                      title="Scroll left"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    
                    {/* Scrollable Container */}
                    <div 
                      ref={timeSeriesScrollRef}
                      className="flex gap-1 overflow-x-auto scrollbar-hide flex-1"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {leftPestStoredSeries.map((item: PestStoredItem, idx: number) => (
                        <button
                          key={`${item.year_month}-${idx}`}
                          type="button"
                          onClick={() => {
                            setLeftSelectedPestYearMonth(item.year_month);
                          }}
                          className={`px-1.5 py-0.5 rounded-full text-[9px] border flex-shrink-0 ${
                            leftSelectedPestYearMonth === item.year_month
                              ? 'bg-emerald-500/80 border-emerald-400 text-black'
                              : 'bg-gray-800/80 border-gray-600 text-gray-200 hover:bg-gray-700'
                          }`}
                        >
                          {item.year_month}
                        </button>
                      ))}
                    </div>
                    
                    {/* Right Arrow */}
                    <button
                      type="button"
                      onClick={() => {
                        if (timeSeriesScrollRef.current) {
                          timeSeriesScrollRef.current.scrollBy({ left: 150, behavior: 'smooth' });
                        }
                      }}
                      className="flex-shrink-0 p-1 rounded bg-gray-800/80 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-white transition-colors"
                      title="Scroll right"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pest time series chart: only on map in split-screen; in single view it is shown in the bottom PEST card */}
          {splitScreenMode && getActiveTab('left') === 'pest' && (splitScreenMode ? leftPestStoredSeries : pestStoredSeries) && (splitScreenMode ? leftPestStoredSeries : pestStoredSeries)!.length > 0 && (splitScreenMode ? leftSelectedPestCategory : selectedPestCategory) && (splitScreenMode ? leftShowPestSeries : showPestSeries) && (
            (() => {
              const currentCategory = splitScreenMode ? leftSelectedPestCategory : selectedPestCategory;
              const currentSeries = splitScreenMode ? leftPestStoredSeries : pestStoredSeries;
              const series = currentSeries!
                .filter((item: PestStoredItem) => {
                  const h = (item as any).response_data?.hierarchy || {};
                  return h[currentCategory];
                })
                .sort((a: PestStoredItem, b: PestStoredItem) => a.year_month.localeCompare(b.year_month));

              if (!series.length) return null;

              const labels = series.map(s => s.year_month);
              const areaValues = series.map(s => {
                const h = (s as any).response_data?.hierarchy?.[currentCategory] || {};
                return Number(h.total_area_ha ?? 0);
              });

              // Children series (e.g. rust, redrot, aflatoxin, downy_mildew) per month
              const firstCategory: any =
                (series[0] as any).response_data?.hierarchy?.[currentCategory] || {};
              const childKeys: string[] = firstCategory.children
                ? Object.keys(firstCategory.children)
                : [];

              const childrenSeries: number[][] = childKeys.map(childKey =>
                series.map(s => {
                  const child =
                    (s as any).response_data?.hierarchy?.[currentCategory]?.children?.[childKey] ||
                    {};
                  // Prefer area_ha, fall back to total_area_ha if present
                  return Number(
                    (child as any).area_ha ?? (child as any).total_area_ha ?? 0
                  );
                })
              );

              // Bar chart dimensions - adjust for split screen mode (use smaller default size)
              const defaultSplitScreenWidth = 400;
              const defaultSplitScreenHeight = 200;
              const W = splitScreenMode ? Math.min(Math.max(pestGraphSize.width, defaultSplitScreenWidth), 600) : pestGraphSize.width;
              const H = splitScreenMode ? Math.min(Math.max(pestGraphSize.height, defaultSplitScreenHeight), 300) : pestGraphSize.height;
              const P = splitScreenMode ? 35 : 50; // padding
              const bottomPadding = splitScreenMode ? 18 : 22;
              const topPadding = splitScreenMode ? 15 : 20;
              const chartHeight = H - bottomPadding - topPadding;
              
              // Determine what to display
              const hasChildSelection =
                selectedPestChildSeries && childKeys.includes(selectedPestChildSeries);

              const displayChildKeys = hasChildSelection
                ? childKeys.filter(key => key === selectedPestChildSeries).sort()
                : childKeys.sort();
              const displayChildrenSeries = hasChildSelection
                ? childrenSeries.filter((_, idx) => childKeys[idx] === selectedPestChildSeries)
                : childrenSeries;

              const showParent = !hasChildSelection;

              // Calculate number of series to display (parent + children)
              const numSeries = (showParent ? 1 : 0) + displayChildKeys.length;
              const barGroupWidth = labels.length > 0 ? (W - P * 2) / labels.length : 0;
              const barSpacing = 2;
              const barWidth = numSeries > 0 ? (barGroupWidth - barSpacing * (numSeries - 1)) / numSeries : 0;

              // Get all values for scaling
              // If a year_month is selected and not showing all, scale Y-axis to selected month only
              const currentYearMonth = splitScreenMode ? leftSelectedPestYearMonth : selectedPestYearMonth;
              const currentShowAllTimeSeries = splitScreenMode ? leftShowAllTimeSeries : showAllTimeSeries;
              let allValues: number[];
              if (currentYearMonth && !currentShowAllTimeSeries) {
                // Get data only for the selected month
                const selectedMonthIdx = labels.findIndex(l => l === currentYearMonth);
                if (selectedMonthIdx >= 0) {
                  const monthValues: number[] = [];
                  if (showParent) {
                    monthValues.push(areaValues[selectedMonthIdx] || 0);
                  }
                  displayChildrenSeries.forEach(series => {
                    monthValues.push(series[selectedMonthIdx] || 0);
                  });
                  allValues = monthValues.filter(v => !Number.isNaN(v) && v >= 0);
                } else {
                  // Fallback to all values if selected month not found
                  allValues = [
                    ...(showParent ? areaValues : []),
                    ...displayChildrenSeries.reduce<number[]>(
                      (acc, arr) => acc.concat(arr),
                      []
                    ),
                  ].filter(v => !Number.isNaN(v) && v >= 0);
                }
              } else {
                // Use all months' data
                allValues = [
                  ...(showParent ? areaValues : []),
                  ...displayChildrenSeries.reduce<number[]>(
                    (acc, arr) => acc.concat(arr),
                    []
                  ),
                ].filter(v => !Number.isNaN(v) && v >= 0);
              }
              
              const maxValue = allValues.length > 0 ? Math.max(...allValues) : 1;
              // Add some padding to max value for better visualization (10% padding)
              const paddedMaxValue = maxValue > 0 ? maxValue * 1.1 : 1;
              const yScale = (v: number) => {
                if (paddedMaxValue === 0) return chartHeight;
                return chartHeight - (v / paddedMaxValue) * chartHeight;
              };

              // Same date format as Growth/Water/Soil: "Jan '25", "Feb '25"
              const formatMonthLabel = (ym: string | null) => {
                if (!ym || typeof ym !== 'string') return 'Current';
                const [y, m] = ym.split('-');
                if (!m) return ym;
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                const shortYear = y && y.length >= 2 ? y.slice(-2) : y;
                return `${months[parseInt(m, 10) - 1] || m} '${shortYear}`;
              };

              const childColors = ['#3b82f6', '#22c55e', '#eab308', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4'];
              const parentColor = '#f97316';

              return (
                <div 
                  className={`absolute z-[1000] bg-gray-100 rounded-lg border border-gray-300 shadow-xl ${splitScreenMode ? 'px-3 py-2' : 'px-4 py-3'} ${pestCardPosition ? '' : (splitScreenMode ? 'bottom-4 left-4' : 'bottom-4 right-4')}`}
                  style={{
                    ...(splitScreenMode ? { width: `${W}px`, maxWidth: 'calc(50vw - 120px)' } : { width: `${pestGraphSize.width}px`, maxWidth: 'calc(100vw - 2rem)' }),
                    ...(pestCardPosition ? { left: pestCardPosition.left, bottom: pestCardPosition.bottom, right: 'auto' } : {})
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`${splitScreenMode ? 'text-xs' : 'text-sm'} font-semibold text-gray-800 uppercase tracking-wider`}>
                      {currentCategory?.replace(/_/g, ' ') || ''} Â· Time Series
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={`${splitScreenMode ? 'px-1.5 py-0.5' : 'px-2 py-1'} rounded bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-400 flex items-center justify-center cursor-grab active:cursor-grabbing select-none`}
                        title="Drag to move card"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const pos = pestCardPosition ?? { left: 16, bottom: 16 };
                          pestDragStartRef.current = { x: e.clientX, y: e.clientY, left: pos.left, bottom: pos.bottom };
                          setPestCardPosition(pos);
                          const onMove = (e2: MouseEvent) => {
                            if (!pestDragStartRef.current) return;
                            const dx = e2.clientX - pestDragStartRef.current.x;
                            const dy = e2.clientY - pestDragStartRef.current.y;
                            setPestCardPosition({
                              left: pestDragStartRef.current.left + dx,
                              bottom: pestDragStartRef.current.bottom - dy
                            });
                          };
                          const onUp = () => {
                            window.removeEventListener('mousemove', onMove);
                            window.removeEventListener('mouseup', onUp);
                            pestDragStartRef.current = null;
                          };
                          window.addEventListener('mousemove', onMove);
                          window.addEventListener('mouseup', onUp);
                        }}
                      >
                        <Move size={splitScreenMode ? 12 : 14} />
                      </button>
                      <button
                        type="button"
                        className={`${splitScreenMode ? 'px-1.5 py-0.5' : 'px-2 py-1'} rounded bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-400 flex items-center justify-center cursor-grab active:cursor-grabbing select-none`}
                        title="Drag to resize: drag up/right to increase, down/left to decrease"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pestResizeSourceRef.current = 'left';
                          pestResizeStartRef.current = { x: e.clientX, y: e.clientY };
                          pestResizeAccumRef.current = { x: 0, y: 0 };
                          const onMove = (e2: MouseEvent) => {
                            if (pestResizeSourceRef.current !== 'left') return;
                            const dx = e2.clientX - pestResizeStartRef.current.x;
                            const dy = e2.clientY - pestResizeStartRef.current.y;
                            pestResizeAccumRef.current = { x: pestResizeAccumRef.current.x + dx, y: pestResizeAccumRef.current.y + dy };
                            pestResizeStartRef.current = { x: e2.clientX, y: e2.clientY };
                            const { x: ax, y: ay } = pestResizeAccumRef.current;
                            if (ay < -PEST_RESIZE_STEP || ax > PEST_RESIZE_STEP) {
                              setPestGraphSize(prev => ({
                                width: Math.min(splitScreenMode ? 600 : 1200, prev.width + (splitScreenMode ? 50 : 100)),
                                height: Math.min(splitScreenMode ? 300 : 600, prev.height + (splitScreenMode ? 25 : 50))
                              }));
                              pestResizeAccumRef.current = { x: 0, y: 0 };
                            } else if (ay > PEST_RESIZE_STEP || ax < -PEST_RESIZE_STEP) {
                              setPestGraphSize(prev => ({
                                width: Math.max(splitScreenMode ? 300 : 400, prev.width - (splitScreenMode ? 50 : 100)),
                                height: Math.max(splitScreenMode ? 150 : 200, prev.height - (splitScreenMode ? 25 : 50))
                              }));
                              pestResizeAccumRef.current = { x: 0, y: 0 };
                            }
                          };
                          const onUp = () => {
                            window.removeEventListener('mousemove', onMove);
                            window.removeEventListener('mouseup', onUp);
                            pestResizeSourceRef.current = null;
                          };
                          window.addEventListener('mousemove', onMove);
                          window.addEventListener('mouseup', onUp);
                        }}
                      >
                        <Maximize2 size={splitScreenMode ? 12 : 14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (splitScreenMode) {
                            setLeftShowAllTimeSeries(!leftShowAllTimeSeries);
                          } else {
                            setShowAllTimeSeries(!showAllTimeSeries);
                          }
                        }}
                        className={`${splitScreenMode ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'} rounded border ${
                          currentShowAllTimeSeries
                            ? 'bg-blue-500 text-white border-blue-600 hover:bg-blue-600'
                            : 'bg-gray-200 text-gray-700 border-gray-400 hover:bg-gray-300'
                        }`}
                        title={currentShowAllTimeSeries ? 'Show only selected month' : 'Show all time series data'}
                      >
                        {currentShowAllTimeSeries ? 'Selected' : 'All'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (splitScreenMode) {
                            setLeftShowPestSeries(false);
                          } else {
                            setShowPestSeries(false);
                          }
                        }}
                        className={`${splitScreenMode ? 'px-1.5 py-0.5' : 'px-2 py-1'} rounded bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-400 flex items-center justify-center`}
                        title="Hide"
                      >
                        <Eye size={splitScreenMode ? 12 : 14} />
                      </button>
                    </div>
                  </div>
                  <div id="pest-time-series-graph">
                  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
                    {/* Y-axis line */}
                    <line x1={P} y1={topPadding} x2={P} y2={H - bottomPadding} stroke="#111827" strokeWidth={1} />
                    {/* X-axis line */}
                    <line x1={P} y1={H - bottomPadding} x2={W - P} y2={H - bottomPadding} stroke="#111827" strokeWidth={1} />
                    
                    {/* Y-axis labels â€“ same format as Growth/Water/Soil (e.g. 1.5k for 1500) */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                      const value = paddedMaxValue * ratio;
                      const y = H - bottomPadding - (chartHeight * ratio);
                      return (
                        <g key={`y-label-${ratio}`}>
                          <line x1={P - 5} y1={y} x2={P} y2={y} stroke="#111827" strokeWidth={1} />
                          <text x={P - 10} y={y + 4} textAnchor="end" fontSize={splitScreenMode ? "8" : "10"} fill="#6b7280">
                            {value.toFixed(0)}
                          </text>
                        </g>
                      );
                    })}
                    
                    {/* Y-axis title */}
                    <text
                      x={splitScreenMode ? 15 : 20}
                      y={H / 2}
                      transform={`rotate(-90 ${splitScreenMode ? 15 : 20} ${H / 2})`}
                      textAnchor="middle"
                      fontSize={splitScreenMode ? "10" : "12"}
                      fill="#374151"
                      fontWeight="500"
                    >
                      Area (ha)
                    </text>

                    {/* Bars for each month */}
                    {labels.map((label, monthIdx) => {
                      const groupX = P + monthIdx * barGroupWidth;
                      let barIdx = 0;
                      // Check if this month is selected - highlight it, blur others
                      // If showAllTimeSeries is true, show all months fully visible
                      // Otherwise, highlight selected month and blur others
                      const isSelected = currentYearMonth === label;
                      const opacity = currentShowAllTimeSeries 
                        ? 1 
                        : (currentYearMonth ? (isSelected ? 1 : 0.3) : 1);

                      return (
                        <g key={`month-${label}`} opacity={opacity}>
                          {/* Parent bar */}
                          {showParent && (() => {
                            const value = areaValues[monthIdx] || 0;
                            const barHeight = (value / paddedMaxValue) * chartHeight;
                            const x = groupX + barIdx * (barWidth + barSpacing);
                            barIdx++;
                            return (
                              <rect
                                key={`parent-${monthIdx}`}
                                x={x}
                                y={H - bottomPadding - barHeight}
                                width={barWidth}
                                height={barHeight}
                                fill={parentColor}
                                rx={2}
                              />
                            );
                          })()}
                          
                          {/* Children bars */}
                          {displayChildrenSeries.map((values, childIdx) => {
                            const value = values[monthIdx] || 0;
                            const barHeight = (value / paddedMaxValue) * chartHeight;
                            const color = childColors[childIdx % childColors.length];
                            const x = groupX + barIdx * (barWidth + barSpacing);
                            barIdx++;
                            return (
                              <rect
                                key={`child-${displayChildKeys[childIdx]}-${monthIdx}`}
                                x={x}
                                y={H - bottomPadding - barHeight}
                                width={barWidth}
                                height={barHeight}
                                fill={color}
                                rx={2}
                              />
                            );
                          })}
                        </g>
                      );
                    })}
                  </svg>
                  
                  {/* X-axis labels - align with bars, no extra gap, scroll when narrow */}
                  <div
                    className="overflow-x-auto overflow-y-hidden mt-0.5 font-semibold text-gray-700"
                    style={{ paddingLeft: P, paddingRight: P }}
                  >
                    <div
                      className="flex flex-nowrap flex-shrink-0"
                      style={{ minWidth: labels.length * barGroupWidth }}
                    >
                      {labels.map((label, i) => {
                        const isSelected = currentYearMonth === label;
                        const opacity = currentShowAllTimeSeries
                          ? 1
                          : (currentYearMonth ? (isSelected ? 1 : 0.3) : 1);
                        const labelW = Math.max(barGroupWidth, 24);
                        return (
                          <span
                            key={label + i}
                            className="whitespace-nowrap flex-shrink-0 overflow-visible"
                            style={{
                              width: `${labelW}px`,
                              minWidth: `${labelW}px`,
                              textAlign: 'center',
                              opacity,
                              fontSize: barGroupWidth < 36 ? (splitScreenMode ? 8 : 9) : (splitScreenMode ? 9 : 10),
                            }}
                            title={label}
                          >
                            {formatMonthLabel(label)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div className={`mt-3 flex flex-wrap items-center gap-4 ${splitScreenMode ? 'text-[10px]' : 'text-xs'} text-gray-700`}>
                    {showParent && (
                      <div className="flex items-center gap-2">
                        <div className={`${splitScreenMode ? 'w-2 h-2' : 'w-3 h-3'} rounded`} style={{ backgroundColor: parentColor }} />
                        <span className="font-medium"> ha</span>
                      </div>
                    )}
                    {displayChildKeys.map((key, idx) => (
                      <div key={key} className="flex items-center gap-2">
                        <div
                          className={`${splitScreenMode ? 'w-2 h-2' : 'w-3 h-3'} rounded`}
                          style={{ backgroundColor: childColors[idx % childColors.length] }}
                        />
                        <span className="font-medium capitalize">
                          {key.replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                  </div>
                </div>
              );
            })()
          )}
          {/* Pest children panel: bottom-left on map over basemap (Thrips, Mealybug, etc.) */}
          {!splitScreenMode && activeTab === 'pest' && selectedPestCategory && pestHierarchy?.hierarchy[selectedPestCategory]?.children && Object.keys(pestHierarchy.hierarchy[selectedPestCategory].children).length > 0 && (
            <div className="absolute bottom-4 left-4 z-[1000] w-[320px] max-w-[calc(100vw-4rem)] px-3 py-2 bg-black/70 backdrop-blur-sm rounded-lg border border-gray-600 shadow-xl">
              <div className="flex items-center justify-between mb-2 max-[1024px]:mb-1">
                <span className="text-xs font-semibold text-gray-300 uppercase max-[1024px]:text-[10px]">
                  {selectedPestCategory.replace(/_/g, ' ')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPestChildren(prev => !prev)}
                  className="text-xs px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-gray-200 max-[1024px]:text-[10px] max-[1024px]:px-1.5 max-[1024px]:py-0.5"
                >
                  {showPestChildren ? 'Hide' : 'Show'}
                </button>
              </div>
              {showPestChildren && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-[1024px]:gap-1">
                  {Object.entries(pestHierarchy.hierarchy[selectedPestCategory].children).map(([childKey, child]: [string, PestHierarchyChild]) => (
                    <button
                      key={childKey}
                      type="button"
                      onClick={() => {
                        // Focus this child in the time-series graph
                        setSelectedPestChildSeries(childKey);
                        setShowPestSeries(true);
                        if (child.tile_url) {
                          setPestTileUrl(child.tile_url);
                          setAllPlotsTileUrls(prev => ({ ...prev, pest: child.tile_url }));
                          setShowTileLayers(true);
                        }
                      }}
                      className="p-2 rounded-lg border border-gray-600 bg-gray-800/90 hover:bg-gray-700 text-left cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-1.5 max-[1024px]:gap-1">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 max-[1024px]:w-2 max-[1024px]:h-2"
                          style={{ backgroundColor: PEST_CARD_COLORS[selectedPestCategory] ?? '#f97316' }}
                        />
                        <span className="text-sm font-medium text-gray-200 capitalize truncate max-[1024px]:text-xs">
                          {childKey.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 max-[1024px]:text-[10px]">
                        {child.pct_of_parent.toFixed(1)}% Â· {child.area_ha.toFixed(2)} ha
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pest children panel for split screen mode - Left side */}
          {splitScreenMode && getActiveTab('left') === 'pest' && leftSelectedPestCategory && leftPestStoredSeries && leftPestStoredSeries.length > 0 && (() => {
            const firstItem = leftPestStoredSeries[0];
            const hierarchy = firstItem?.response_data?.hierarchy;
            const children = hierarchy?.[leftSelectedPestCategory]?.children;
            if (!children || Object.keys(children).length === 0) return null;
            
            // Position above the graph card if graph is shown, otherwise at bottom
            const graphHeight = leftShowPestSeries ? Math.min(Math.max(pestGraphSize.height, 200), 300) : 0;
            const bottomOffset = leftShowPestSeries ? graphHeight + 40 : 16; // Add 40px spacing above graph, or 16px from bottom if graph hidden
            
            return (
              <div 
                className="absolute left-4 z-[1000] w-[320px] max-w-[calc(50vw-120px)] px-3 py-2 bg-black/70 backdrop-blur-sm rounded-lg border border-gray-600 shadow-xl"
                style={{ bottom: '320px' }}
              >
                <div className="flex items-center justify-between mb-2 max-[1024px]:mb-1">
                  <span className="text-xs font-semibold text-gray-300 uppercase max-[1024px]:text-[10px]">
                    {leftSelectedPestCategory.replace(/_/g, ' ')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLeftShowPestChildren(prev => !prev)}
                    className="text-xs px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-gray-200 max-[1024px]:text-[10px] max-[1024px]:px-1.5 max-[1024px]:py-0.5"
                  >
                    {leftShowPestChildren ? 'Hide' : 'Show'}
                  </button>
                </div>
                {leftShowPestChildren && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-[1024px]:gap-1">
                    {Object.entries(children).map(([childKey, child]: [string, any]) => (
                      <button
                        key={childKey}
                        type="button"
                        onClick={() => {
                          // Focus this child in the time-series graph
                          setSelectedPestChildSeries(childKey);
                          setLeftShowPestSeries(true);
                          if (child.tile_url) {
                            setLeftAllPlotsTileUrls(prev => ({ ...prev, pest: child.tile_url }));
                            setLeftShowTileLayers(true);
                          }
                        }}
                        className="p-2 rounded-lg border border-gray-600 bg-gray-800/90 hover:bg-gray-700 text-left cursor-pointer transition-colors max-[1024px]:p-1.5"
                      >
                        <div className="flex items-center gap-1.5 max-[1024px]:gap-1">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 max-[1024px]:w-2 max-[1024px]:h-2"
                            style={{ backgroundColor: PEST_CARD_COLORS[leftSelectedPestCategory] ?? '#f97316' }}
                          />
                          <span className="text-sm font-medium text-gray-200 capitalize truncate max-[1024px]:text-xs">
                            {childKey.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 max-[1024px]:text-[10px]">
                          {child.pct_of_parent?.toFixed(1) ?? '0.0'}% Â· {child.area_ha?.toFixed(2) ?? '0.00'} ha
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}


          {/* Daily weather line chart removed */}
          {false && (
          <div className={`absolute ${getActiveTab('left') === 'pest' && leftShowPestSeries && leftSelectedPestCategory && leftPestStoredSeries && leftPestStoredSeries.length > 0 ? 'bottom-4 left-4' : 'bottom-4 right-4'} z-[1000] w-[280px] max-w-[calc(50vw-2rem)] bg-black/70 backdrop-blur-sm rounded-lg border border-gray-600 shadow-xl p-3`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Daily Weather</div>
                <div className="text-sm text-gray-100">
                  {leftWeatherDailyData?.name || leftSelectedVillage || leftSelectedSubdistrict || leftSelectedDistrict || 'â€”'}
                  {leftWeatherDailyData?.level ? (
                    <span className="text-xs text-gray-400"> Â· {String(leftWeatherDailyData.level)}</span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {leftWeatherDailyLoading ? (
                  <div className="text-xs text-gray-400">Loadingâ€¦</div>
                ) : leftWeatherDailyError ? (
                  <div className="text-xs text-red-300">Failed</div>
                ) : null}
                <button
                  type="button"
                  onClick={() => setLeftShowWeatherDaily(!leftShowWeatherDaily)}
                  className="text-[10px] px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-500"
                >
                  Hide
                </button>
              </div>
            </div>

            {leftWeatherDailyError ? (
              <div className="mt-2 text-xs text-red-300">{leftWeatherDailyError}</div>
            ) : leftWeatherDailyData?.daily?.length ? (
              (() => {
                const days = leftWeatherDailyData.daily.slice(0, 7);
                const tempMax = days.map(d => Number(d.temp_max ?? 0));
                const rainfall = days.map(d => Number(d.rainfall ?? 0));
                const windMax = days.map(d => Number(d.wind_max ?? 0));

                const W = 250;
                const H = 100;
                const P = 15;
                const xStep = days.length > 1 ? (W - P * 2) / (days.length - 1) : 0;

                // Fixed y-axis scale from 0 to 100
                const yAxisMin = 0;
                const yAxisMax = 100;
                const scale = (v: number) => {
                  // Clamp value to 0-100 range for display
                  const clamped = Math.max(yAxisMin, Math.min(yAxisMax, v));
                  return H - P - ((clamped - yAxisMin) / (yAxisMax - yAxisMin)) * (H - P * 2);
                };
                const yTemp = scale;
                const yRain = scale;
                const yWind = scale;

                const pts = (arr: number[], yScale: (v: number) => number) =>
                  arr.map((v, i) => `${P + i * xStep},${yScale(v)}`).join(' ');
                const fmtDay = (s: string) => {
                  const parts = (s || '').split('-');
                  return parts.length === 3 ? parts[2] : s;
                };

                return (
                  <div
                    id="weather-daily-chart-left"
                    className="mt-2 relative"
                    onMouseLeave={() => setLeftWeatherChartHoverDay(null)}
                  >
                    {leftWeatherChartHoverDay !== null && days[leftWeatherChartHoverDay] && (
                      <div
                        className="absolute z-10 px-2.5 py-2 rounded-lg bg-gray-900 border border-gray-600 shadow-lg text-xs text-left whitespace-nowrap"
                        style={{
                          left: P + leftWeatherChartHoverDay * xStep - 50,
                          bottom: H + 24,
                        }}
                      >
                        <div className="font-semibold text-gray-200 mb-1">{days[leftWeatherChartHoverDay].date}</div>
                        <div className="text-gray-400">temp_max: <span className="text-orange-400">{days[leftWeatherChartHoverDay].temp_max}</span> Â°C</div>
                        <div className="text-gray-400">rainfall: <span className="text-blue-400">{days[leftWeatherChartHoverDay].rainfall}</span></div>
                        <div className="text-gray-400">wind_max: <span className="text-emerald-400">{days[leftWeatherChartHoverDay].wind_max}</span></div>
                      </div>
                    )}
                    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
                      <line x1={P} y1={P} x2={P} y2={H - P} stroke="rgba(148,163,184,0.25)" />
                      <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="rgba(148,163,184,0.25)" />
                      
                      {/* Y-axis labels (0 to 100) */}
                      {[0, 20, 40, 60, 80, 100].map((val) => {
                        const y = H - P - ((val - yAxisMin) / (yAxisMax - yAxisMin)) * (H - P * 2);
                        return (
                          <g key={`y-label-left-${val}`}>
                            <line x1={P - 5} y1={y} x2={P} y2={y} stroke="rgba(148,163,184,0.25)" />
                            <text x={P - 8} y={y + 3} textAnchor="end" fontSize="8" fill="rgba(148,163,184,0.6)">{val}</text>
                          </g>
                        );
                      })}

                      <polyline points={pts(tempMax, yTemp)} fill="none" stroke="#f97316" strokeWidth="2" />
                      <polyline points={pts(rainfall, yRain)} fill="none" stroke="#3b82f6" strokeWidth="2" />
                      <polyline points={pts(windMax, yWind)} fill="none" stroke="#10b981" strokeWidth="2" />

                      {tempMax.map((v, i) => (
                        <circle key={`tm-left-${i}`} cx={P + i * xStep} cy={yTemp(v)} r="2" fill="#f97316" />
                      ))}
                      {rainfall.map((v, i) => (
                        <circle key={`rf-left-${i}`} cx={P + i * xStep} cy={yRain(v)} r="2" fill="#3b82f6" />
                      ))}
                      {windMax.map((v, i) => (
                        <circle key={`wm-left-${i}`} cx={P + i * xStep} cy={yWind(v)} r="2" fill="#10b981" />
                      ))}

                      {days.map((_, i) => (
                        <rect
                          key={`hover-left-${i}`}
                          x={Math.max(0, P + (i - 0.5) * xStep)}
                          y={0}
                          width={xStep}
                          height={H}
                          fill="transparent"
                          onMouseEnter={() => setLeftWeatherChartHoverDay(i)}
                        />
                      ))}
                    </svg>

                    <div className="flex justify-between text-[9px] text-gray-400 px-[15px]">
                      {days.map((d, i) => (
                        <span key={`d-left-${i}`} className="whitespace-nowrap">{fmtDay(d.date)}</span>
                      ))}
                    </div>

                    <div className="mt-2 flex items-center gap-3 text-[9px] text-gray-400">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        <span>temp_max</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span>rainfall</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>wind_max</span>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : null}
          </div>
          )}

          {false && (
          <div
            className={`absolute z-[1000] w-[320px] max-w-[calc(100vw-2rem)] bg-black/70 backdrop-blur-sm rounded-lg border border-gray-600 shadow-xl p-3 ${weatherCardPosition ? '' : 'bottom-4 left-4'}`}
            style={weatherCardPosition ? { left: weatherCardPosition.left, bottom: weatherCardPosition.bottom, right: 'auto' } : {}}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Daily Weather</div>
                <div className="text-sm text-gray-100">
                  {weatherDailyData?.name || selectedVillage || selectedSubdistrict || selectedDistrict || 'â€”'}
                  {weatherDailyData?.level ? (
                    <span className="text-xs text-gray-400"> Â· {String(weatherDailyData.level)}</span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="text-[10px] p-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-500 cursor-grab active:cursor-grabbing select-none"
                  title="Drag to move card"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const pos = weatherCardPosition ?? { left: 16, bottom: 16 };
                    weatherDragStartRef.current = { x: e.clientX, y: e.clientY, left: pos.left, bottom: pos.bottom };
                    setWeatherCardPosition(pos);
                    const onMove = (e2: MouseEvent) => {
                      if (!weatherDragStartRef.current) return;
                      const dx = e2.clientX - weatherDragStartRef.current.x;
                      const dy = e2.clientY - weatherDragStartRef.current.y;
                      setWeatherCardPosition({
                        left: weatherDragStartRef.current.left + dx,
                        bottom: weatherDragStartRef.current.bottom - dy
                      });
                    };
                    const onUp = () => {
                      window.removeEventListener('mousemove', onMove);
                      window.removeEventListener('mouseup', onUp);
                      weatherDragStartRef.current = null;
                    };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                >
                  <Move size={14} />
                </button>
                {weatherDailyLoading ? (
                  <div className="text-xs text-gray-400">Loadingâ€¦</div>
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

            {weatherDailyError ? (
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

                // Fixed y-axis scale from 0 to 100
                const yAxisMin = 0;
                const yAxisMax = 100;
                const scale = (v: number) => {
                  // Clamp value to 0-100 range for display
                  const clamped = Math.max(yAxisMin, Math.min(yAxisMax, v));
                  return H - P - ((clamped - yAxisMin) / (yAxisMax - yAxisMin)) * (H - P * 2);
                };
                const yTemp = scale;
                const yRain = scale;
                const yWind = scale;

                const pts = (arr: number[], yScale: (v: number) => number) =>
                  arr.map((v, i) => `${P + i * xStep},${yScale(v)}`).join(' ');
                const fmtDay = (s: string) => {
                  const parts = (s || '').split('-');
                  return parts.length === 3 ? parts[2] : s;
                };

                return (
                  <div
                    id="weather-daily-chart"
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
                        <div className="text-gray-400">temp_max: <span className="text-orange-400">{days[weatherChartHoverDay].temp_max}</span> Â°C</div>
                        <div className="text-gray-400">rainfall: <span className="text-blue-400">{days[weatherChartHoverDay].rainfall}</span></div>
                        <div className="text-gray-400">wind_max: <span className="text-emerald-400">{days[weatherChartHoverDay].wind_max}</span></div>
                      </div>
                    )}
                    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
                      <line x1={P} y1={P} x2={P} y2={H - P} stroke="rgba(148,163,184,0.25)" />
                      <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="rgba(148,163,184,0.25)" />
                      
                      {/* Y-axis labels (0 to 100) */}
                      {[0, 20, 40, 60, 80, 100].map((val) => {
                        const y = H - P - ((val - yAxisMin) / (yAxisMax - yAxisMin)) * (H - P * 2);
                        return (
                          <g key={`y-label-${val}`}>
                            <line x1={P - 5} y1={y} x2={P} y2={y} stroke="rgba(148,163,184,0.25)" />
                            <text x={P - 8} y={y + 3} textAnchor="end" fontSize="9" fill="rgba(148,163,184,0.6)">{val}</text>
                          </g>
                        );
                      })}

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
                        <span>Temp max (Â°C)</span>
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
            )}
          </div>
          )}

          {(splitScreenMode ? leftLoading : loading) && (splitScreenMode ? leftAllPlots : plots).length === 0 ? (
            <div className="h-full w-full flex items-center justify-center bg-gray-900 text-green-500">
              <Loader2 className="animate-spin" size={48} />
            </div>
          ) : (
            <PlotsMap
              plots={splitScreenMode ? leftAllPlots : plots}
              selectedPlotId={selectedPlotId}
              cropColor={predictAreaCropColor}
              fieldAreaByFieldId={predictAreaFieldAreas}
              hideFieldIdAreaCard={(() => {
                const p = splitScreenMode ? leftAllPlots : plots;
                const district = splitScreenMode ? leftSelectedDistrict : selectedDistrict;
                const subdistrict = splitScreenMode ? leftSelectedSubdistrict : selectedSubdistrict;
                const village = splitScreenMode ? leftSelectedVillage : selectedVillage;
                return p.length === 1 && (p[0].id === district || p[0].id === subdistrict || p[0].id === village);
              })()}
              onSelectPlot={async (id) => {
                setSelectedPlotId(id);
                
                // Find the plot to get coordinates
                const currentPlots = splitScreenMode ? leftAllPlots : plots;
                const selectedPlot = currentPlots.find(p => p.id === id);
                if (!selectedPlot || !selectedPlot.boundary || selectedPlot.boundary.length === 0) {
                  return;
                }
                
                // Use area_ha from selected plot when available
                if (geojsonPlots.length > 0 && selectedPlot.area_ha) {
                  const plotArea = parseFloat(selectedPlot.area_ha);
                  if (!isNaN(plotArea) && plotArea > 0) {
                    setSelectedPlotArea(plotArea);
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
                  
                } catch (err) {
                  const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
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
              tileUrl={pestTileUrl || forestTileUrl || lstTileUrl || cropTileUrl || tileUrl}
              plotBounds={plotBounds}
              allPlotsTileUrls={splitScreenMode ? leftAllPlotsTileUrls : allPlotsTileUrls}
              showTileLayers={splitScreenMode ? leftShowTileLayers : showTileLayers}
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
              windDirectPayload={windDirectData}
              showWindFlowLayer={showWindFlowLayer}
            />
          )}

          {/* Time series year-month tabs: show for Growth, Water, Soil, Pest (same bar style, shared selection) */}
          {/* Pest: year/month list */}
          {!splitScreenMode && getActiveTab('left') === 'pest' && pestStoredSeries && pestStoredSeries.length >= 0 && selectedDistrict && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] max-w-[92vw] md:max-w-[860px] bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-2xl px-3 py-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-[10px] font-semibold text-gray-900 uppercase tracking-wider">
                  PEST - YEAR / MONTH SERIES
                </div>
                {pestStoredLoading && (
                  <div className="text-[9px] text-gray-600">Loadingâ€¦</div>
                )}
              </div>
              {pestStoredError ? (
                <div className="text-[9px] text-red-600">{pestStoredError}</div>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { if (timeSeriesScrollRef.current) timeSeriesScrollRef.current.scrollBy({ left: -150, behavior: 'smooth' }); }}
                    className="flex-shrink-0 h-8 w-8 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-900 transition-colors flex items-center justify-center"
                    title="Scroll left"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <div ref={timeSeriesScrollRef} className="flex gap-1 overflow-x-auto scrollbar-hide flex-1 min-w-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {[...(pestStoredSeries || [])].sort((a, b) => a.year_month.localeCompare(b.year_month)).map((item: PestStoredItem, idx: number) => (
                      <button
                        key={`${item.year_month}-${idx}`}
                        type="button"
                        onClick={() => {
                          setPestChartViewMode('selected');
                          setSelectedTimeSeriesYearMonth(item.year_month);
                          setSelectedPestYearMonth(item.year_month);
                        }}
                        className={`px-3 py-1 rounded-xl text-[10px] border flex-shrink-0 whitespace-nowrap ${
                          (selectedTimeSeriesYearMonth ?? selectedPestYearMonth) === item.year_month
                            ? 'bg-white text-black border-emerald-700 shadow-sm font-semibold'
                            : 'bg-gray-100 border-gray-300 text-gray-900 hover:bg-gray-200'
                        }`}
                      >
                        {item.year_month}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => { if (timeSeriesScrollRef.current) timeSeriesScrollRef.current.scrollBy({ left: 150, behavior: 'smooth' }); }}
                    className="flex-shrink-0 h-8 w-8 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-900 transition-colors flex items-center justify-center"
                    title="Scroll right"
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPestChartViewMode('selected');
                      setSelectedPestYearMonth(null);
                      setSelectedTimeSeriesYearMonth(null);
                    }}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-xl text-[10px] font-semibold border ${
                      pestChartViewMode === 'selected' && selectedPestYearMonth == null
                        ? 'bg-emerald-900 text-white border-emerald-950 hover:bg-emerald-800'
                        : 'bg-gray-100 border-gray-300 text-gray-900 hover:bg-gray-200'
                    }`}
                    title="Show current snapshot"
                  >
                    Current
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Growth: Current + year/month list (show for district-only or district+subdistrict) */}
          {!splitScreenMode && getActiveTab('left') === 'growth' && selectedDistrict && (growthStoredSeries && growthStoredSeries.length > 0) && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] max-w-[92vw] md:max-w-[860px] bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-2xl px-3 py-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-[10px] font-semibold text-gray-900 uppercase tracking-wider">
                  GROWTH - YEAR / MONTH SERIES
                </div>
                {growthStoredLoading && (
                  <span className="text-[9px] text-amber-700">Loading year_monthâ€¦</span>
                )}
                {!growthStoredLoading && growthStoredError && (
                  <span className="text-[9px] text-red-600" title={growthStoredError}>Error</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (timeSeriesScrollRef.current) {
                      timeSeriesScrollRef.current.scrollBy({ left: -150, behavior: 'smooth' });
                    }
                  }}
                  className="flex-shrink-0 h-8 w-8 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-900 transition-colors flex items-center justify-center"
                  title="Scroll left to older dates"
                >
                  <ChevronLeft size={14} />
                </button>
                <div
                  ref={timeSeriesScrollRef}
                  className="flex gap-1 overflow-x-auto scrollbar-hide flex-1 min-w-0"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {/* Stored year_month â€“ display only year-month */}
                  {[...(growthStoredSeries || [])]
                    .sort((a, b) => b.year_month.localeCompare(a.year_month))
                    .map((item: GrowthStoredItem, idx: number) => (
                    <button
                      key={`${item.year_month}-${item.id ?? idx}`}
                      type="button"
                      onClick={() => {
                        setSelectedTimeSeriesYearMonth(item.year_month);
                        setSelectedGrowthYearMonth(item.year_month);
                        setGrowthChartViewMode('selected');
                      }}
                      title={item.year_month}
                      className={`px-3 py-1 rounded-xl text-[10px] border flex-shrink-0 whitespace-nowrap ${
                        growthChartViewMode === 'selected' && selectedTimeSeriesYearMonth === item.year_month
                          ? 'bg-white text-black border-emerald-700 shadow-sm font-semibold'
                          : 'bg-gray-100 border-gray-300 text-gray-900 hover:bg-gray-200'
                      }`}
                    >
                      {item.year_month}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (timeSeriesScrollRef.current) {
                      timeSeriesScrollRef.current.scrollBy({ left: 150, behavior: 'smooth' });
                    }
                  }}
                  className="flex-shrink-0 h-8 w-8 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-900 transition-colors flex items-center justify-center"
                  title="Scroll right to older dates"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGrowthChartViewMode('selected');
                    setSelectedGrowthYearMonth(null);
                    setSelectedTimeSeriesYearMonth(null);
                  }}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-xl text-[10px] font-semibold border ${
                    growthChartViewMode === 'selected' && selectedGrowthYearMonth == null
                      ? 'bg-emerald-900 text-white border-emerald-950 hover:bg-emerald-800'
                      : 'bg-gray-100 border-gray-300 text-gray-900 hover:bg-gray-200'
                  }`}
                  title="Show current snapshot"
                >
                  Current
                </button>
              </div>
            </div>
          )}

          {/* Water Uptake: time series bar â€“ year_month from analyze_wateruptakeclasswise */}
          {!splitScreenMode && getActiveTab('left') === 'water' && selectedDistrict && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] max-w-[92vw] md:max-w-[860px] bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-2xl px-3 py-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-[10px] font-semibold text-gray-900 uppercase tracking-wider">
                  WATER UPTAKE - YEAR / MONTH SERIES
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => { if (timeSeriesScrollRef.current) timeSeriesScrollRef.current.scrollBy({ left: -150, behavior: 'smooth' }); }}
                  className="flex-shrink-0 h-8 w-8 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-900 transition-colors flex items-center justify-center"
                  title="Scroll left"
                >
                  <ChevronLeft size={14} />
                </button>
                <div ref={timeSeriesScrollRef} className="flex gap-1 overflow-x-auto scrollbar-hide flex-1 min-w-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setWaterChartViewMode('selected');
                      setSelectedWaterYearMonth(null);
                      setSelectedTimeSeriesYearMonth(null);
                    }}
                    className={`px-3 py-1 rounded-xl text-[10px] border flex-shrink-0 whitespace-nowrap ${
                      waterChartViewMode === 'selected' && selectedWaterYearMonth == null
                        ? 'bg-white text-black border-emerald-700 shadow-sm font-semibold'
                        : 'bg-gray-100 border-gray-300 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    Current
                  </button>
                  {[...(waterStoredSeries || [])].sort((a, b) => b.year_month.localeCompare(a.year_month)).map((item: GrowthStoredItem, idx: number) => (
                    <button
                      key={`water-${item.year_month}-${idx}`}
                      type="button"
                      onClick={() => {
                        setWaterChartViewMode('selected');
                        setSelectedTimeSeriesYearMonth(item.year_month);
                        setSelectedWaterYearMonth(item.year_month);
                      }}
                      className={`px-3 py-1 rounded-xl text-[10px] border flex-shrink-0 whitespace-nowrap ${
                        selectedWaterYearMonth === item.year_month
                          ? 'bg-white text-black border-emerald-700 shadow-sm font-semibold'
                          : 'bg-gray-100 border-gray-300 text-gray-900 hover:bg-gray-200'
                      }`}
                    >
                      {item.year_month}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => { if (timeSeriesScrollRef.current) timeSeriesScrollRef.current.scrollBy({ left: 150, behavior: 'smooth' }); }}
                  className="flex-shrink-0 h-8 w-8 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-900 transition-colors flex items-center justify-center"
                  title="Scroll right"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWaterChartViewMode('selected');
                    setSelectedWaterYearMonth(null);
                    setSelectedTimeSeriesYearMonth(null);
                  }}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-xl text-[10px] font-semibold border ${
                    waterChartViewMode === 'selected' && selectedWaterYearMonth == null
                      ? 'bg-emerald-900 text-white border-emerald-950 hover:bg-emerald-800'
                      : 'bg-gray-100 border-gray-300 text-gray-900 hover:bg-gray-200'
                  }`}
                  title="Show current snapshot"
                >
                  Current
                </button>
              </div>
            </div>
          )}

          {/* Soil Moisture: time series bar â€“ year_month from analyze_soilmoistureclasswise */}
          {!splitScreenMode && getActiveTab('left') === 'soil' && selectedDistrict && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] max-w-[92vw] md:max-w-[860px] bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-2xl px-3 py-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-[10px] font-semibold text-gray-900 uppercase tracking-wider">
                  SOIL MOISTURE - YEAR / MONTH SERIES
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => { if (timeSeriesScrollRef.current) timeSeriesScrollRef.current.scrollBy({ left: -150, behavior: 'smooth' }); }}
                  className="flex-shrink-0 h-8 w-8 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-900 transition-colors flex items-center justify-center"
                  title="Scroll left"
                >
                  <ChevronLeft size={14} />
                </button>
                <div ref={timeSeriesScrollRef} className="flex gap-1 overflow-x-auto scrollbar-hide flex-1 min-w-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {[...(soilStoredSeries || [])].sort((a, b) => b.year_month.localeCompare(a.year_month)).map((item: GrowthStoredItem, idx: number) => (
                    <button
                      key={`soil-${item.year_month}-${idx}`}
                      type="button"
                      onClick={() => {
                        setSoilChartViewMode('selected');
                        setSelectedTimeSeriesYearMonth(item.year_month);
                        setSelectedSoilYearMonth(item.year_month);
                      }}
                      className={`px-3 py-1 rounded-xl text-[10px] border flex-shrink-0 whitespace-nowrap ${
                        selectedSoilYearMonth === item.year_month
                          ? 'bg-white text-black border-emerald-700 shadow-sm font-semibold'
                          : 'bg-gray-100 border-gray-300 text-gray-900 hover:bg-gray-200'
                      }`}
                    >
                      {item.year_month}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => { if (timeSeriesScrollRef.current) timeSeriesScrollRef.current.scrollBy({ left: 150, behavior: 'smooth' }); }}
                  className="flex-shrink-0 h-8 w-8 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-900 transition-colors flex items-center justify-center"
                  title="Scroll right"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSoilChartViewMode('selected');
                    setSelectedSoilYearMonth(null);
                    setSelectedTimeSeriesYearMonth(null);
                  }}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-xl text-[10px] font-semibold border ${
                    soilChartViewMode === 'selected' && selectedSoilYearMonth == null
                      ? 'bg-emerald-900 text-white border-emerald-950 hover:bg-emerald-800'
                      : 'bg-gray-100 border-gray-300 text-gray-900 hover:bg-gray-200'
                  }`}
                  title="Show current snapshot"
                >
                  Current
                </button>
              </div>
            </div>
          )}

          {renderSplitScreenMapBottomGraph('left')}

        </div>

        {/* Two cards below map (nonâ€“split): Health Trends + Daily Weather */}
      {!splitScreenMode &&
        !isMapFullscreen &&
        !showGraphPage &&
        !showAnalysisTrendsPage &&
        ['growth', 'water', 'soil', 'pest'].includes(getActiveTab('left') || '') && (
          <div
            ref={bottomCardsRef}
            className="grid w-full grid-cols-1 gap-3 bg-gray-950 border-t border-gray-800 md:border-t-0 md:border-l md:border-gray-800 md:w-[38%] md:min-w-[360px] md:max-w-[560px] p-3 flex-shrink-0 min-h-0 md:overflow-y-auto md:self-start"
            style={{ scrollMarginTop: 96 }}
          >
            {/* Health Trends card â€“ header shows selected tab name (e.g. Growth, Water, Pest) */}
            <div className="bg-gray-800/80 rounded-lg border border-gray-700 overflow-hidden flex flex-col min-h-[320px] md:order-2">
              <div className="px-4 py-2 border-b border-gray-700 bg-gray-800/90">
                <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  {getActiveTabDisplayName('left')}
                </h3>
              </div>
              <div id="health-trends-chart" className="flex-1 p-4 min-h-0 flex flex-col">
                {getActiveTab('left') === 'growth' && showGrowthSeries && (getCurrentPixelData('left')?.classwise?.length > 0 || growthStoredSeries?.length > 0) ? (
                  (() => {
                    const classNames = ['Weak', 'Stress', 'Moderate', 'Healthy'];
                    const classColors: Record<string, string> = {
                      Weak: '#bc1e29',
                      Stress: '#58cf54',
                      Moderate: '#28ae31',
                      Healthy: '#00351d'
                    };
                    const getAreaForClass = (cw: any[], className: string) => {
                      if (!Array.isArray(cw)) return 0;
                      const c = cw.find((x: any) => (x.class_name || '').toString().toLowerCase() === className.toLowerCase());
                      return Number(c?.area_hectares ?? (c as any)?.area_ha ?? 0);
                    };
                    const formatMonthLabel = (ym: string | null) => {
                      if (!ym) return 'Current';
                      const [y, m] = ym.split('-');
                      if (!m) return ym;
                      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                      const shortYear = y && y.length >= 2 ? y.slice(-2) : y;
                      return `${months[parseInt(m, 10) - 1] || m} '${shortYear}`;
                    };
                    // Increase height for \"View all\" growth time-series chart so all dates are more readable
                    const H = 340;
                    const paddingLeft = 48;
                    const paddingRight = 12;
                    const paddingTop = 12;
                    const paddingBottom = 32;
                    // Base width: scale with number of periods to reduce crowding
                    // (also helps fill the card width so the chart doesn't look "stuck" to the left)
                    const baseW = 900;
                    const perPeriodPx = 56;
                    const W = Math.max(baseW, ((growthStoredSeries?.length ?? 0) + 1) * perPeriodPx + paddingLeft + paddingRight);
                    const chartW = W - paddingLeft - paddingRight;
                    const chartH = H - paddingTop - paddingBottom;
                    const showAllDates = growthChartViewMode === 'all';
                    const growthAxisMain = isDarkMode ? '#e5e7eb' : '#111827';
                    const growthAxisTick = isDarkMode ? '#d1d5db' : '#111827';

                    if (showAllDates) {
                      const storedSorted = [...(growthStoredSeries || [])].sort((a, b) => a.year_month.localeCompare(b.year_month));
                      const periods: { label: string; yearMonth: string | null; classwise: any[] }[] = [
                        { label: 'Current', yearMonth: null, classwise: growthCurrentData?.classwise || [] },
                        ...storedSorted.map((item: GrowthStoredItem) => ({
                          label: item.year_month,
                          yearMonth: item.year_month,
                          classwise: (item.response_data as any)?.classwise || []
                        }))
                      ].filter(p => p.classwise && p.classwise.length > 0);
                      const allAreaValues = periods.map(p => classNames.map(cn => getAreaForClass(p.classwise, cn)));
                      const maxVal = Math.max(1, ...allAreaValues.flat().filter(v => !Number.isNaN(v) && v >= 0));
                      const paddedMax = maxVal * 1.1;
                      const yTicks = [0, 0.25, 0.5, 0.75, 1].map(r => ({ ratio: r, value: paddedMax * r }));
                      const numPeriods = periods.length;
                      const groupGap = 4;
                      const groupWidth = numPeriods > 0 ? (chartW - groupGap * (numPeriods - 1)) / numPeriods : 0;
                      const barGap = 4;
                      const barWidth = groupWidth > 0 ? (groupWidth - barGap * (classNames.length - 1)) / classNames.length : 0;
                      const xLabelStep = numPeriods > 12 ? Math.max(1, Math.floor(numPeriods / 8)) : 1;

                      return (
                        <div className="w-full min-h-0 flex flex-col flex-1">
                          <div className="text-[10px] text-gray-400 mb-1 flex-shrink-0">Area (ha) by growth class Â· all dates</div>
                          <div className="flex-1 min-h-0 w-full overflow-x-auto">
                            <svg width="100%" height={H} className="w-full" viewBox={`0 0 ${Math.max(W, paddingLeft + chartW + paddingRight)} ${H}`} preserveAspectRatio="none">
                              <defs><clipPath id="growth-chart-clip-all"><rect x={paddingLeft} y={paddingTop} width={chartW} height={chartH} /></clipPath></defs>
                              <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={H - paddingBottom} stroke={growthAxisMain} strokeWidth={1} />
                              <line x1={paddingLeft} y1={H - paddingBottom} x2={paddingLeft + chartW} y2={H - paddingBottom} stroke={growthAxisMain} strokeWidth={1} />
                              {yTicks.map(({ ratio, value }) => {
                              const y = paddingTop + chartH - ratio * chartH;
                              return (
                              <g key={ratio}>
                                <line x1={paddingLeft} y1={y} x2={paddingLeft - 4} y2={y} stroke={growthAxisTick} strokeWidth={1} />
                                <text
                                  x={paddingLeft - 6}
                                  y={y + 4}
                                  textAnchor="end"
                                  className={isDarkMode ? 'fill-gray-200' : 'fill-gray-900'}
                                  fontSize={11}
                                  fontWeight="600"
                                >
                                  {value.toFixed(0)}
                                </text>
                              </g>
                              );
                              })}
                              <g clipPath="url(#growth-chart-clip-all)">
                                {periods.map((p, pi) => {
                                  const areaValues = classNames.map(cn => getAreaForClass(p.classwise, cn));
                                  const gx = paddingLeft + pi * (groupWidth + groupGap);
                                  return classNames.map((cn, ci) => {
                                    const val = areaValues[ci] ?? 0;
                                    const h = paddedMax > 0 ? (val / paddedMax) * chartH : 0;
                                    const y = paddingTop + chartH - h;
                                    const x = gx + ci * (barWidth + barGap);
                                    return <rect key={`${pi}-${cn}`} x={x} y={y} width={barWidth} height={h} fill={classColors[cn] || '#666'} rx={1} />;
                                  });
                                })}
                              </g>
                              {periods.map((p, pi) => {
                              if (pi % xLabelStep !== 0) return null;
                              const gx = paddingLeft + pi * (groupWidth + groupGap) + groupWidth / 2;
                              return (
                                <text
                                  key={`label-${pi}`}
                                  x={gx}
                                  y={H - 10}
                                  textAnchor="middle"
                                  className={isDarkMode ? 'fill-gray-200' : 'fill-gray-900'}
                                  fontSize={11}
                                  fontWeight="600"
                                >
                                  {formatMonthLabel(p.yearMonth)}
                                </text>
                              );
                              })}
                            </svg>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2 flex-shrink-0">
                            {classNames.map(cn => (
                              <span key={cn} className="flex items-center gap-1 text-[9px]">
                                <span className="w-2 h-2 rounded" style={{ backgroundColor: classColors[cn] }} />
                                {cn}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    // Use same data as area cards so graph Y-axis matches card area (ha) when date changes
                    const areaCardsForGrowth = calculateAreaCards('left').filter((ac) =>
                      classNames.some((cn) => ac.label === cn)
                    );
                    const areaValues = classNames.map(
                      (cn) => areaCardsForGrowth.find((ac) => ac.label === cn)?.value ?? 0
                    );
                    const maxVal = areaValues.length > 0 ? Math.max(...areaValues.filter(v => !Number.isNaN(v) && v >= 0)) : 1;
                    const paddedMax = maxVal > 0 ? maxVal * 1.1 : 1;
                    const numBars = classNames.length;
                    const barGap = 8;
                    const barWidth = (chartW - barGap * (numBars - 1)) / numBars;
                    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(r => ({ ratio: r, value: paddedMax * r }));
                    const selectedLabel = formatMonthLabel(selectedGrowthYearMonth);
                    return (
                      <div className="w-full min-h-0 flex flex-col flex-1">
                        <div className="text-[10px] text-gray-400 mb-1 flex-shrink-0">Area (ha) by growth class Â· {selectedLabel}</div>
                        <div className="flex-1 min-h-0 w-full">
                          <svg width="100%" height={H} className="w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                            <defs><clipPath id="growth-chart-clip"><rect x={paddingLeft} y={paddingTop} width={chartW} height={chartH} /></clipPath></defs>
                            <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={H - paddingBottom} stroke={growthAxisMain} strokeWidth={1} />
                            <line x1={paddingLeft} y1={H - paddingBottom} x2={paddingLeft + chartW} y2={H - paddingBottom} stroke={growthAxisMain} strokeWidth={1} />
                            {yTicks.map(({ ratio, value }) => {
                              const y = paddingTop + chartH - ratio * chartH;
                              return (
                                <g key={ratio}>
                                  <line x1={paddingLeft} y1={y} x2={paddingLeft - 4} y2={y} stroke={growthAxisTick} strokeWidth={1} />
                                  <text
                                    x={paddingLeft - 6}
                                    y={y + 4}
                                    textAnchor="end"
                                    className={isDarkMode ? 'fill-gray-200' : 'fill-gray-900'}
                                    fontSize={11}
                                    fontWeight="600"
                                  >
                                    {value.toFixed(0)}
                                  </text>
                                </g>
                              );
                            })}
                            <g clipPath="url(#growth-chart-clip)">
                              {classNames.map((cn, ci) => {
                                const val = areaValues[ci] ?? 0;
                                const h = paddedMax > 0 ? (val / paddedMax) * chartH : 0;
                                const y = paddingTop + chartH - h;
                                const x = paddingLeft + ci * (barWidth + barGap);
                                return (
                                  <g key={cn}>
                                    <rect x={x} y={y} width={barWidth} height={h} fill={classColors[cn] || '#666'} rx={1} />
                                  </g>
                                );
                              })}
                            </g>
                            <text
                              x={paddingLeft + chartW / 2}
                              y={H - 10}
                              textAnchor="middle"
                              className={isDarkMode ? 'fill-gray-200' : 'fill-gray-900'}
                              fontSize={11}
                              fontWeight="600"
                            >
                              {selectedLabel}
                            </text>
                          </svg>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2 flex-shrink-0">
                          {classNames.map(cn => (
                            <span key={cn} className="flex items-center gap-1 text-[9px]">
                              <span className="w-2 h-2 rounded" style={{ backgroundColor: classColors[cn] }} />
                              {cn}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()
                ) : getActiveTab('left') === 'pest' && pestStoredSeries && pestStoredSeries.length > 0 && selectedPestCategory ? (
                  (() => {
                    const currentCategory = selectedPestCategory;
                    const currentSeries = pestStoredSeries;
                    const series = currentSeries
                      .filter((item: PestStoredItem) => {
                        const h = (item as any).response_data?.hierarchy || {};
                        return h[currentCategory];
                      })
                      .sort((a: PestStoredItem, b: PestStoredItem) => a.year_month.localeCompare(b.year_month));
                    if (!series.length) return <div className="text-gray-500 text-sm">No time series data for {currentCategory}.</div>;
                    const labels = series.map(s => s.year_month);
                    const areaValues = series.map(s => {
                      const h = (s as any).response_data?.hierarchy?.[currentCategory] || {};
                      return Number(h.total_area_ha ?? 0);
                    });
                    const firstCategory: any = (series[0] as any).response_data?.hierarchy?.[currentCategory] || {};
                    const childKeys: string[] = firstCategory.children ? Object.keys(firstCategory.children) : [];
                    const childrenSeries: number[][] = childKeys.map(childKey =>
                      series.map(s => {
                        const child = (s as any).response_data?.hierarchy?.[currentCategory]?.children?.[childKey] || {};
                        return Number((child as any).area_ha ?? (child as any).total_area_ha ?? 0);
                      })
                    );
                    const W = 920;
                    const H = 220;
                    const P = 40;
                    const bottomPadding = 20;
                    const topPadding = 16;
                    const chartHeight = H - bottomPadding - topPadding;
                    const showParent = true;
                    const displayChildKeys = childKeys.sort();
                    const displayChildrenSeries = childrenSeries;
                    const numSeries = (showParent ? 1 : 0) + displayChildKeys.length;
                    const barGroupWidth = labels.length > 0 ? (W - P * 2) / labels.length : 0;
                    const barSpacing = 2;
                    const barWidth = numSeries > 0 ? (barGroupWidth - barSpacing * (numSeries - 1)) / numSeries : 0;
                    const allValues = [
                      ...(showParent ? areaValues : []),
                      ...displayChildrenSeries.reduce<number[]>((acc, arr) => acc.concat(arr), []),
                    ].filter(v => !Number.isNaN(v) && v >= 0);
                    const maxValue = allValues.length > 0 ? Math.max(...allValues) : 1;
                    const paddedMaxValue = maxValue > 0 ? maxValue * 1.1 : 1;
                    const yScale = (v: number) => (paddedMaxValue === 0 ? chartHeight : chartHeight - (v / paddedMaxValue) * chartHeight);
                    // Same date format as Growth/Water/Soil: "Jan '25", "Feb '25"
                    const formatMonthLabel = (ym: string | null) => {
                      if (!ym || typeof ym !== 'string') return 'Current';
                      const [y, m] = ym.split('-');
                      if (!m) return ym;
                      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                      const shortYear = y && y.length >= 2 ? y.slice(-2) : y;
                      return `${months[parseInt(m, 10) - 1] || m} '${shortYear}`;
                    };
                    const childColors = ['#3b82f6', '#22c55e', '#eab308', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4'];
                    const parentColor = '#f97316';
                    const pestAxisMain = isDarkMode ? '#e5e7eb' : '#111827';
                    const pestAxisTick = isDarkMode ? '#d1d5db' : '#111827';
                    return (
                      <div className="w-full min-h-0 flex flex-col flex-1">
                        <div className="text-[10px] text-gray-400 mb-1 flex-shrink-0">Area (ha) Â· {currentCategory.replace(/_/g, ' ')} time series</div>
                        <div className="w-full overflow-x-auto">
                          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
                          <line x1={P} y1={topPadding} x2={P} y2={H - bottomPadding} stroke={pestAxisMain} strokeWidth={1} />
                          <line x1={P} y1={H - bottomPadding} x2={W - P} y2={H - bottomPadding} stroke={pestAxisMain} strokeWidth={1} />
                          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                            const value = paddedMaxValue * ratio;
                            const y = H - bottomPadding - (chartHeight * ratio);
                            return (
                              <g key={`y-${ratio}`}>
                                <line x1={P - 5} y1={y} x2={P} y2={y} stroke={pestAxisTick} strokeWidth={1} />
                                <text x={P - 8} y={y + 3} textAnchor="end" className={isDarkMode ? 'fill-gray-400 text-[9px]' : 'fill-gray-800 text-[9px]'} fontSize={9}>
                                  {value.toFixed(0)}
                                </text>
                              </g>
                            );
                          })}
                          {labels.map((label, monthIdx) => {
                            const groupX = P + monthIdx * barGroupWidth;
                            let barIdx = 0;
                            return (
                              <g key={`month-${label}`}>
                                {showParent && (() => {
                                  const value = areaValues[monthIdx] || 0;
                                  const barHeight = (value / paddedMaxValue) * chartHeight;
                                  const x = groupX + barIdx * (barWidth + barSpacing);
                                  barIdx++;
                                  return <rect key={`p-${monthIdx}`} x={x} y={H - bottomPadding - barHeight} width={barWidth} height={barHeight} fill={parentColor} rx={2} />;
                                })()}
                                {displayChildrenSeries.map((values, childIdx) => {
                                  const value = values[monthIdx] || 0;
                                  const barHeight = (value / paddedMaxValue) * chartHeight;
                                  const color = childColors[childIdx % childColors.length];
                                  const x = groupX + barIdx * (barWidth + barSpacing);
                                  barIdx++;
                                  return <rect key={`c-${childIdx}-${monthIdx}`} x={x} y={H - bottomPadding - barHeight} width={barWidth} height={barHeight} fill={color} rx={2} />;
                                })}
                              </g>
                            );
                          })}
                          </svg>
                        </div>
                        <div className="overflow-x-auto mt-0.5 flex-shrink-0" style={{ paddingLeft: P, paddingRight: P }}>
                          <div className="flex flex-nowrap gap-0" style={{ minWidth: labels.length * Math.max(barGroupWidth, 24) }}>
                            {labels.map((label, i) => (
                              <span key={label + i} className="whitespace-nowrap flex-shrink-0 text-center text-[9px] text-gray-500" style={{ width: `${Math.max(barGroupWidth, 24)}px` }} title={label}>{formatMonthLabel(label)}</span>
                            ))}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[9px] text-gray-400 flex-shrink-0">
                          {showParent && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded" style={{ backgroundColor: parentColor }} /> Total</span>}
                          {displayChildKeys.map((key, idx) => (
                            <span key={key} className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded" style={{ backgroundColor: childColors[idx % childColors.length] }} />
                              {key.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()
                ) : getActiveTab('left') === 'water' && (getCurrentPixelData('left')?.classwise?.length > 0 || (waterStoredSeries && waterStoredSeries.length > 0)) ? (
                  (() => {
                    const waterClassNames = ['Deficient', 'Less', 'Adequat', 'Excellent', 'Excess'];
                    const waterClassColors: Record<string, string> = {
                      Deficient: '#EBFF34',
                      Less: '#CC8213',
                      Adequat: '#1348E8',
                      Excellent: '#2E199A',
                      Excess: '#060217'
                    };
                    const getAreaForClass = (cw: any[], className: string) => {
                      if (!Array.isArray(cw)) return 0;
                      const c = cw.find((x: any) => (x.class_name || '').toString().toLowerCase() === className.toLowerCase());
                      return Number(c?.area_hectares ?? (c as any)?.area_ha ?? 0);
                    };
                    const formatMonthLabel = (ym: string | null) => {
                      if (!ym) return 'Current';
                      const [y, m] = ym.split('-');
                      if (!m) return ym;
                      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                      const shortYear = y && y.length >= 2 ? y.slice(-2) : y;
                      return `${months[parseInt(m, 10) - 1] || m} '${shortYear}`;
                    };
                    const currentData = getCurrentPixelData('left');
                    const classwise = selectedWaterYearMonth && waterStoredSeries?.length
                      ? (waterStoredSeries.find((x: GrowthStoredItem) => x.year_month === selectedWaterYearMonth)?.response_data as any)?.classwise
                      : currentData?.classwise;
                    const areaCardsForWater = (classwise && Array.isArray(classwise) && classwise.length > 0)
                      ? waterClassNames.map(cn => ({ label: cn, value: getAreaForClass(classwise, cn) }))
                      : calculateAreaCards('left').filter((ac) => waterClassNames.some(cn => ac.label.toLowerCase() === cn.toLowerCase())).map(ac => ({ label: ac.label, value: ac.value }));
                    const areaValues = waterClassNames.map(cn => areaCardsForWater.find(ac => ac.label.toLowerCase() === cn.toLowerCase())?.value ?? 0);
                    const maxVal = areaValues.length > 0 ? Math.max(...areaValues.filter(v => !Number.isNaN(v) && v >= 0), 1) : 1;
                    const paddedMax = maxVal * 1.1;
                    const H = 240;
                    const W = 400;
                    const paddingLeft = 48;
                    const paddingRight = 12;
                    const paddingTop = 12;
                    const paddingBottom = 28;
                    const chartW = W - paddingLeft - paddingRight;
                    const chartH = H - paddingTop - paddingBottom;
                    const barGap = 6;
                    const barWidth = (chartW - barGap * (waterClassNames.length - 1)) / waterClassNames.length;
                    const selectedLabel = formatMonthLabel(selectedWaterYearMonth || null);
                    const waterAxisMain = isDarkMode ? '#e5e7eb' : '#111827';
                    const waterAxisTick = isDarkMode ? '#d1d5db' : '#111827';
                    return (
                      <div className="w-full min-h-0 flex flex-col flex-1">
                        <div className="text-[10px] text-gray-400 mb-1 flex-shrink-0">Area (ha) by water uptake class Â· {selectedLabel}</div>
                        <div className="flex-1 min-h-0 w-full">
                          <svg width="100%" height={H} className="w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                            <defs><clipPath id="water-chart-clip"><rect x={paddingLeft} y={paddingTop} width={chartW} height={chartH} /></clipPath></defs>
                            <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={H - paddingBottom} stroke={waterAxisMain} strokeWidth={1} />
                            <line x1={paddingLeft} y1={H - paddingBottom} x2={paddingLeft + chartW} y2={H - paddingBottom} stroke={waterAxisMain} strokeWidth={1} />
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                              const value = paddedMax * ratio;
                              const y = paddingTop + chartH - ratio * chartH;
                              return (
                                <g key={ratio}>
                                  <line x1={paddingLeft} y1={y} x2={paddingLeft - 4} y2={y} stroke={waterAxisTick} strokeWidth={1} />
                                  <text x={paddingLeft - 6} y={y + 4} textAnchor="end" className={isDarkMode ? 'fill-gray-200' : 'fill-gray-900'} fontSize={10}>{value.toFixed(0)}</text>
                                </g>
                              );
                            })}
                            <g clipPath="url(#water-chart-clip)">
                              {waterClassNames.map((cn, ci) => {
                                const val = areaValues[ci] ?? 0;
                                const h = paddedMax > 0 ? (val / paddedMax) * chartH : 0;
                                const y = paddingTop + chartH - h;
                                const x = paddingLeft + ci * (barWidth + barGap);
                                return <rect key={cn} x={x} y={y} width={barWidth} height={h} fill={waterClassColors[cn] || '#666'} rx={2} />;
                              })}
                            </g>
                            {waterClassNames.map((cn, ci) => (
                              <text key={`l-${cn}`} x={paddingLeft + ci * (barWidth + barGap) + barWidth / 2} y={H - 8} textAnchor="middle" className={isDarkMode ? 'fill-gray-400' : 'fill-gray-800'} fontSize={9}>{cn}</text>
                            ))}
                          </svg>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2 flex-shrink-0">
                          {waterClassNames.map(cn => (
                            <span key={cn} className="flex items-center gap-1 text-[9px]">
                              <span className="w-2 h-2 rounded" style={{ backgroundColor: waterClassColors[cn] }} />
                              {cn}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()
                ) : getActiveTab('left') ? (
                  <div className="flex items-center justify-center text-gray-500 text-sm text-center">
                    {getActiveTabDisplayName('left')} graph and trends appear here when data is loaded.
                  </div>
                ) : (
                  <div className="flex items-center justify-center text-gray-500 text-sm text-center">
                    Select a tab above (Growth, Water, Soil, Pest, Water Source, Forest) to see graph.
                  </div>
                )}
              </div>
            </div>

            {getSelectedDistrict('left') && (
              <div className="p-4 bg-gray-800/80 rounded-lg border border-gray-700">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {selectedPlotArea !== null ? 'Plot Area' : 'Total Area'}
                </div>
                {selectedPlotArea !== null ? (
                  <div className="text-xl font-bold text-green-400">{selectedPlotArea.toFixed(2)} ha</div>
                ) : getTotalAreaLoading('left') ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="animate-spin text-green-400" size={20} />
                  </div>
                ) : getTotalAreaHectares('left') !== null && getTotalAreaHectares('left') !== undefined ? (
                  <div className="text-xl font-bold text-green-400">{getTotalAreaHectares('left')!.toFixed(2)} ha</div>
                ) : (
                  <div className="text-sm text-gray-500">No area data available</div>
                )}
              </div>
            )}

            {calculateAreaCards('left').length > 0 && (
              <div className="p-4 bg-gray-800/80 rounded-lg border border-gray-700">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Percentage / Area (ha)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {calculateAreaCards('left').map((item, idx) => {
                    const cardBg = item.color || '#f97316';
                    const cardFg = textColorOnBackground(cardBg);
                    return (
                      <div
                        key={`right-pct-${item.label}-${idx}`}
                        className="rounded-xl p-3 flex flex-col items-center justify-center text-center min-h-[86px]"
                        style={{ backgroundColor: cardBg, color: cardFg }}
                      >
                        <span className="text-sm font-semibold">{item.label}</span>
                        <span className="font-bold text-base mt-1">{item.percentage.toFixed(2)}%</span>
                        <span className="font-semibold text-base mt-0.5">{item.value.toFixed(2)} ha</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Daily Weather card removed */}
            {false && <div className="bg-gray-800/80 rounded-lg border border-gray-700 overflow-hidden flex flex-col min-h-[320px]">
              <div className="px-4 py-2 border-b border-gray-700 bg-gray-800/90">
                <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Daily Weather {getWeatherCardLocationName('left') !== 'â€”' ? `Â· ${getWeatherCardLocationName('left')}` : ''}
                </h3>
              </div>
              <div className="flex-1 p-4 min-h-0">
                {getWeatherCardLocationName('left') === 'â€”' ? (
                  <div className="h-full flex items-center justify-center text-gray-500 text-sm text-center">
                    Select district, subdistrict or village to load daily weather graph here.
                  </div>
                ) : weatherDailyLoading ? (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                    Loading daily weatherâ€¦
                  </div>
                ) : weatherDailyError ? (
                  <div className="h-full flex items-center justify-center text-red-300 text-sm text-center">
                    {weatherDailyError}
                  </div>
                ) : weatherDailyData?.daily?.length ? (
                  (() => {
                    const days = weatherDailyData.daily.slice(0, 7);
                    const tempMax = days.map(d => Number(d.temp_max ?? 0));
                    const rainfall = days.map(d => Number(d.rainfall ?? 0));
                    const windMax = days.map(d => Number(d.wind_max ?? 0));

                    const W = 560;
                    const H = 180;
                    const P = 24;
                    const xStep = days.length > 1 ? (W - P * 2) / (days.length - 1) : 0;

                    // Fixed y-axis scale from 0 to 100 (shared axis for mixed metrics)
                    const yAxisMin = 0;
                    const yAxisMax = 100;
                    const scale = (v: number) => {
                      const clamped = Math.max(yAxisMin, Math.min(yAxisMax, v));
                      return H - P - ((clamped - yAxisMin) / (yAxisMax - yAxisMin)) * (H - P * 2);
                    };
                    const yTemp = scale;
                    const yRain = scale;
                    const yWind = scale;

                    const pts = (arr: number[], yScale: (v: number) => number) =>
                      arr.map((v, i) => `${P + i * xStep},${yScale(v)}`).join(' ');
                    const fmtDay = (s: string) => {
                      const parts = (s || '').split('-');
                      return parts.length === 3 ? parts[2] : s;
                    };

                    return (
                      <div
                        id="weather-daily-chart"
                        className="relative"
                        onMouseLeave={() => setWeatherChartHoverDay(null)}
                      >
                        {weatherChartHoverDay !== null && days[weatherChartHoverDay] && (
                          <div
                            className="absolute z-10 px-2.5 py-2 rounded-lg bg-gray-900 border border-gray-600 shadow-lg text-xs text-left whitespace-nowrap"
                            style={{
                              left: P + weatherChartHoverDay * xStep - 50,
                              bottom: H + 28,
                            }}
                          >
                            <div className="font-semibold text-gray-200 mb-1">{days[weatherChartHoverDay].date}</div>
                            <div className="text-gray-400">temp_max: <span className="text-orange-400">{days[weatherChartHoverDay].temp_max}</span> Â°C</div>
                            <div className="text-gray-400">rainfall: <span className="text-blue-400">{days[weatherChartHoverDay].rainfall}</span></div>
                            <div className="text-gray-400">wind_max: <span className="text-emerald-400">{days[weatherChartHoverDay].wind_max}</span></div>
                          </div>
                        )}

                        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto">
                          <line x1={P} y1={P} x2={P} y2={H - P} stroke="rgba(148,163,184,0.25)" />
                          <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="rgba(148,163,184,0.25)" />

                          {[0, 20, 40, 60, 80, 100].map((val) => {
                            const y = H - P - ((val - yAxisMin) / (yAxisMax - yAxisMin)) * (H - P * 2);
                            return (
                              <g key={`y-label-card-${val}`}>
                                <line x1={P - 6} y1={y} x2={P} y2={y} stroke="rgba(148,163,184,0.25)" />
                                <text x={P - 10} y={y + 3} textAnchor="end" fontSize="10" fill="rgba(148,163,184,0.6)">{val}</text>
                              </g>
                            );
                          })}

                          <polyline points={pts(tempMax, yTemp)} fill="none" stroke="#f97316" strokeWidth="2.5" />
                          <polyline points={pts(rainfall, yRain)} fill="none" stroke="#3b82f6" strokeWidth="2.5" />
                          <polyline points={pts(windMax, yWind)} fill="none" stroke="#10b981" strokeWidth="2.5" />

                          {tempMax.map((v, i) => (
                            <circle key={`tm-card-${i}`} cx={P + i * xStep} cy={yTemp(v)} r="3" fill="#f97316" />
                          ))}
                          {rainfall.map((v, i) => (
                            <circle key={`rf-card-${i}`} cx={P + i * xStep} cy={yRain(v)} r="3" fill="#3b82f6" />
                          ))}
                          {windMax.map((v, i) => (
                            <circle key={`wm-card-${i}`} cx={P + i * xStep} cy={yWind(v)} r="3" fill="#10b981" />
                          ))}

                          {days.map((_, i) => (
                            <rect
                              key={`hover-card-${i}`}
                              x={Math.max(0, P + (i - 0.5) * xStep)}
                              y={0}
                              width={xStep}
                              height={H}
                              fill="transparent"
                              onMouseEnter={() => setWeatherChartHoverDay(i)}
                            />
                          ))}
                        </svg>

                        <div className="mt-2 flex justify-between text-[11px] text-gray-400 px-[24px]">
                          {days.map((d, i) => (
                            <span key={`d-card-${i}`} className="whitespace-nowrap">{fmtDay(d.date)}</span>
                          ))}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-300">
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#f97316]" />
                            <span>Temp max (Â°C)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
                            <span>Rainfall</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                            <span>Wind max</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                    No daily data
                  </div>
                )}
              </div>
            </div>}
          </div>
        )}

        {/* Second Map for Split Screen - Right Side */}
        {splitScreenMode && (
          <div className="w-1/2 relative flex-1">
            {/* Top Navigation Tabs - Right Side; content-sized like left panel to avoid extra empty space */}
            <div className="absolute top-12 md:top-4 left-1/2 transform -translate-x-1/2 z-[1000] flex flex-col items-center gap-2 md:gap-4 px-2 md:px-0 max-w-[calc(50vw-120px)]">
              {/* Active Tab Buttons - icons only; content-sized, no full-width stretch */}
              <div className="flex gap-1 md:gap-2 bg-black/60 backdrop-blur-sm rounded-lg border border-gray-700 p-1 overflow-x-auto overflow-y-hidden max-w-full tab-bar-scroll flex-nowrap">
                <button
                  onClick={() => toggleActiveTabForSide('growth', 'right')}
                  className={`px-1.5 py-1 min-w-[28px] rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 ${
                    getActiveTab('right') === 'growth' ? 'bg-emerald-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                  }`}
                  title="Growth (click again to hide)"
                >
                  <Sprout size={16} />
                </button>
                <button
                  onClick={() => toggleActiveTabForSide('water', 'right')}
                  className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 min-w-[36px] ${
                    getActiveTab('right') === 'water' ? 'bg-sky-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                  }`}
                  title="Water Uptake (click again to hide)"
                >
                  <Droplets size={18} />
                </button>
                <button
                  onClick={() => toggleActiveTabForSide('soil', 'right')}
                  className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 min-w-[36px] ${
                    getActiveTab('right') === 'soil' ? 'bg-teal-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                  }`}
                  title="Soil Moisture (click again to hide)"
                >
                  <Droplet size={18} />
                </button>
                <button
                  onClick={() => toggleActiveTabForSide('pest', 'right')}
                  className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 min-w-[36px] ${
                    getActiveTab('right') === 'pest' ? 'bg-rose-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                  }`}
                  title="Pest (click again to hide)"
                >
                  <Bug size={18} />
                </button>
                <button
                  onClick={() => toggleActiveTabForSide('waterSource', 'right')}
                  className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 min-w-[36px] ${
                    getActiveTab('right') === 'waterSource' ? 'bg-blue-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                  }`}
                  title="Water Source (click again to hide)"
                >
                  <Waves size={18} />
                </button>
                <button
                  onClick={() => toggleActiveTabForSide('forest', 'right')}
                  className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 min-w-[36px] ${
                    getActiveTab('right') === 'forest' ? 'bg-lime-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                  }`}
                  title="Forest (click again to hide)"
                >
                  <Trees size={18} />
                </button>

                {/* Land Surface Temperature â€” toggles on/off with repeat click */}
                <div 
                  onClick={async () => {
                    if (lstTileUrl) {
                      clearLstTileLayer();
                      return;
                    }
                    const currentDistrict = splitScreenMode ? rightSelectedDistrict : selectedDistrict;
                    if (lstLoading || loading || !currentDistrict) return;
                    lstClosedByUserRef.current = false;
                    try {
                      setLstLoading(true);
                      setError(null);
                      
                      const response = await fetchLandSurfaceTemperature(currentDistrict);
                      
                      if (lstClosedByUserRef.current) return;
                      if (response.tile_url) {
                        setLstTileUrl(response.tile_url);
                        if (splitScreenMode) {
                          setRightAllPlotsTileUrls(prev => ({ ...prev, 'land-surface-temperature': response.tile_url }));
                          setRightShowTileLayers(true);
                        } else {
                          setAllPlotsTileUrls(prev => ({ ...prev, 'land-surface-temperature': response.tile_url }));
                          setShowTileLayers(true);
                        }
                      } else {
                        throw new Error('No tile_url in response');
                      }
                    } catch (err) {
                      if (lstClosedByUserRef.current) return;
                      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
                      setError(`Failed to load Land Surface Temperature: ${errorMessage}`);
                      setLstTileUrl(null);
                    } finally {
                      setLstLoading(false);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`px-1.5 py-1 rounded-md border-2 transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 ${
                    lstTileUrl || ((splitScreenMode ? rightSelectedDistrict : selectedDistrict) && !lstLoading && !loading)
                      ? 'cursor-pointer hover:border-green-500 hover:bg-gray-600' 
                      : 'cursor-not-allowed opacity-50'
                  } ${
                    lstTileUrl 
                      ? 'bg-green-600/20 border-green-500' 
                      : 'bg-gray-700 border-gray-600'
                  }`}
                  title="Land Surface Temperature (click again to hide)"
                >
                  <Thermometer size={17} strokeWidth={2.2} className="shrink-0" />
                </div>
              </div>
            </div>

            {/* Timeseries Tabs - Separate container in splitscreen (80% width) */}
            {getActiveTab('right') === 'pest' && (rightPestStoredSeries && rightPestStoredSeries.length > 0) && (
              <div className="absolute top-28 md:top-20 left-1/2 transform -translate-x-1/2 z-[1000] w-[80%] max-w-[calc(50vw-120px)]">
                <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-gray-700 p-1.5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider">
                      Year / Month Series
                    </div>
                    {rightPestStoredLoading && (
                      <div className="text-[9px] text-gray-400">Loadingâ€¦</div>
                    )}
                  </div>
                  {rightPestStoredError ? (
                    <div className="text-[9px] text-red-300">{rightPestStoredError}</div>
                  ) : (
                    <div className="flex items-center gap-1">
                      {/* Left Arrow */}
                      <button
                        type="button"
                        onClick={() => {
                          if (rightTimeSeriesScrollRef.current) {
                            rightTimeSeriesScrollRef.current.scrollBy({ left: -150, behavior: 'smooth' });
                          }
                        }}
                        className="flex-shrink-0 p-1 rounded bg-gray-800/80 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-white transition-colors"
                        title="Scroll left"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      
                      {/* Scrollable Container */}
                      <div 
                        ref={rightTimeSeriesScrollRef}
                        className="flex gap-1 overflow-x-auto scrollbar-hide flex-1"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                      >
                        {rightPestStoredSeries.map((item: PestStoredItem, idx: number) => (
                          <button
                            key={`right-${item.year_month}-${idx}`}
                            type="button"
                            onClick={() => setRightSelectedPestYearMonth(item.year_month)}
                            className={`px-1.5 py-0.5 rounded-full text-[9px] border flex-shrink-0 ${
                              rightSelectedPestYearMonth === item.year_month
                                ? 'bg-emerald-500/80 border-emerald-400 text-black'
                                : 'bg-gray-800/80 border-gray-600 text-gray-200 hover:bg-gray-700'
                            }`}
                          >
                            {item.year_month}
                          </button>
                        ))}
                      </div>
                      
                      {/* Right Arrow */}
                      <button
                        type="button"
                        onClick={() => {
                          if (rightTimeSeriesScrollRef.current) {
                            rightTimeSeriesScrollRef.current.scrollBy({ left: 150, behavior: 'smooth' });
                          }
                        }}
                        className="flex-shrink-0 p-1 rounded bg-gray-800/80 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-white transition-colors"
                        title="Scroll right"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pest Time Series Graph - Right Side */}
            {getActiveTab('right') === 'pest' && rightPestStoredSeries && rightPestStoredSeries.length > 0 && rightSelectedPestCategory && rightShowPestSeries && (
              (() => {
                const series = rightPestStoredSeries
                  .filter((item: PestStoredItem) => {
                    const h = (item as any).response_data?.hierarchy || {};
                    return h[rightSelectedPestCategory];
                  })
                  .sort((a: PestStoredItem, b: PestStoredItem) => a.year_month.localeCompare(b.year_month));

                if (!series.length) return null;

                const labels = series.map(s => s.year_month);
                const areaValues = series.map(s => {
                  const h = (s as any).response_data?.hierarchy?.[rightSelectedPestCategory] || {};
                  return Number(h.total_area_ha ?? 0);
                });

                // Children series (e.g. rust, redrot, aflatoxin, downy_mildew) per month
                const firstCategory: any =
                  (series[0] as any).response_data?.hierarchy?.[rightSelectedPestCategory] || {};
                const childKeys: string[] = firstCategory.children
                  ? Object.keys(firstCategory.children)
                  : [];

                const childrenSeries: number[][] = childKeys.map(childKey =>
                  series.map(s => {
                    const child =
                      (s as any).response_data?.hierarchy?.[rightSelectedPestCategory]?.children?.[childKey] ||
                      {};
                    // Prefer area_ha, fall back to total_area_ha if present
                    return Number(
                      (child as any).area_ha ?? (child as any).total_area_ha ?? 0
                    );
                  })
                );

                // Bar chart dimensions - adjust for split screen mode (use smaller default size)
                const defaultSplitScreenWidth = 400;
                const defaultSplitScreenHeight = 200;
                const W = Math.min(Math.max(pestGraphSize.width, defaultSplitScreenWidth), 600);
                const H = Math.min(Math.max(pestGraphSize.height, defaultSplitScreenHeight), 300);
                const P = 35; // padding
                const bottomPadding = 18;
                const topPadding = 15;
                const chartHeight = H - bottomPadding - topPadding;
                
                // Determine what to display
                const hasChildSelection = false; // Right side doesn't have child selection yet
                const displayChildKeys = childKeys.sort();
                const displayChildrenSeries = childrenSeries;
                const showParent = !hasChildSelection;

                // Calculate number of series to display (parent + children)
                const numSeries = (showParent ? 1 : 0) + displayChildKeys.length;
                const barGroupWidth = labels.length > 0 ? (W - P * 2) / labels.length : 0;
                const barSpacing = 2;
                const barWidth = numSeries > 0 ? (barGroupWidth - barSpacing * (numSeries - 1)) / numSeries : 0;

                // Get all values for scaling
                let allValues: number[];
                if (rightSelectedPestYearMonth && !rightShowAllTimeSeries) {
                  // Get data only for the selected month
                  const selectedMonthIdx = labels.findIndex(l => l === rightSelectedPestYearMonth);
                  if (selectedMonthIdx >= 0) {
                    const monthValues: number[] = [];
                    if (showParent) {
                      monthValues.push(areaValues[selectedMonthIdx] || 0);
                    }
                    displayChildrenSeries.forEach(series => {
                      monthValues.push(series[selectedMonthIdx] || 0);
                    });
                    allValues = monthValues.filter(v => !Number.isNaN(v) && v >= 0);
                  } else {
                    // Fallback to all values if selected month not found
                    allValues = [
                      ...(showParent ? areaValues : []),
                      ...displayChildrenSeries.reduce<number[]>(
                        (acc, arr) => acc.concat(arr),
                        []
                      ),
                    ].filter(v => !Number.isNaN(v) && v >= 0);
                  }
                } else {
                  // Use all months' data
                  allValues = [
                    ...(showParent ? areaValues : []),
                    ...displayChildrenSeries.reduce<number[]>(
                      (acc, arr) => acc.concat(arr),
                      []
                    ),
                  ].filter(v => !Number.isNaN(v) && v >= 0);
                }
                
                const maxValue = allValues.length > 0 ? Math.max(...allValues) : 1;
                // Add some padding to max value for better visualization (10% padding)
                const paddedMaxValue = maxValue > 0 ? maxValue * 1.1 : 1;
                const yScale = (v: number) => {
                  if (paddedMaxValue === 0) return chartHeight;
                  return chartHeight - (v / paddedMaxValue) * chartHeight;
                };

                // Same date format as Growth/Water/Soil: "Jan '25", "Feb '25"
                const formatMonthLabel = (ym: string | null) => {
                  if (!ym || typeof ym !== 'string') return 'Current';
                  const [y, m] = ym.split('-');
                  if (!m) return ym;
                  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                  const shortYear = y && y.length >= 2 ? y.slice(-2) : y;
                  return `${months[parseInt(m, 10) - 1] || m} '${shortYear}`;
                };

                const childColors = ['#3b82f6', '#22c55e', '#eab308', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4'];
                const parentColor = '#f97316';

                return (
                  <div 
                    className="absolute bottom-4 right-4 z-[1000] bg-gray-100 rounded-lg border border-gray-300 shadow-xl px-3 py-2"
                    style={{ width: `${W}px`, maxWidth: 'calc(50vw - 120px)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-800 uppercase tracking-wider">
                        {rightSelectedPestCategory?.replace(/_/g, ' ') || ''} Â· Time Series
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="px-1.5 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-400 flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
                          title="Drag to resize: drag up/right to increase, down/left to decrease"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            pestResizeSourceRef.current = 'right';
                            pestResizeStartRef.current = { x: e.clientX, y: e.clientY };
                            pestResizeAccumRef.current = { x: 0, y: 0 };
                            const onMove = (e2: MouseEvent) => {
                              if (pestResizeSourceRef.current !== 'right') return;
                              const dx = e2.clientX - pestResizeStartRef.current.x;
                              const dy = e2.clientY - pestResizeStartRef.current.y;
                              pestResizeAccumRef.current = { x: pestResizeAccumRef.current.x + dx, y: pestResizeAccumRef.current.y + dy };
                              pestResizeStartRef.current = { x: e2.clientX, y: e2.clientY };
                              const { x: ax, y: ay } = pestResizeAccumRef.current;
                              if (ay < -PEST_RESIZE_STEP || ax > PEST_RESIZE_STEP) {
                                setPestGraphSize(prev => ({ width: Math.min(600, prev.width + 50), height: Math.min(300, prev.height + 25) }));
                                pestResizeAccumRef.current = { x: 0, y: 0 };
                              } else if (ay > PEST_RESIZE_STEP || ax < -PEST_RESIZE_STEP) {
                                setPestGraphSize(prev => ({ width: Math.max(300, prev.width - 50), height: Math.max(150, prev.height - 25) }));
                                pestResizeAccumRef.current = { x: 0, y: 0 };
                              }
                            };
                            const onUp = () => {
                              window.removeEventListener('mousemove', onMove);
                              window.removeEventListener('mouseup', onUp);
                              pestResizeSourceRef.current = null;
                            };
                            window.addEventListener('mousemove', onMove);
                            window.addEventListener('mouseup', onUp);
                          }}
                        >
                          <Maximize2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRightShowAllTimeSeries(!rightShowAllTimeSeries)}
                          className={`px-1.5 py-0.5 text-[10px] rounded border ${
                            rightShowAllTimeSeries
                              ? 'bg-blue-500 text-white border-blue-600 hover:bg-blue-600'
                              : 'bg-gray-200 text-gray-700 border-gray-400 hover:bg-gray-300'
                          }`}
                          title={rightShowAllTimeSeries ? 'Show only selected month' : 'Show all time series data'}
                        >
                          {rightShowAllTimeSeries ? 'Selected' : 'All'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRightShowPestSeries(false)}
                          className="px-1.5 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-400 flex items-center justify-center"
                          title="Hide"
                        >
                          <Eye size={12} />
                        </button>
                      </div>
                    </div>
                    <div id="pest-time-series-graph-right">
                    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
                      {/* Y-axis line */}
                      <line x1={P} y1={topPadding} x2={P} y2={H - bottomPadding} stroke="#111827" strokeWidth={1} />
                      {/* X-axis line */}
                      <line x1={P} y1={H - bottomPadding} x2={W - P} y2={H - bottomPadding} stroke="#111827" strokeWidth={1} />
                      
                      {/* Y-axis labels â€“ same format as Growth/Water/Soil (e.g. 1.5k for 1500) */}
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                        const value = paddedMaxValue * ratio;
                        const y = H - bottomPadding - (chartHeight * ratio);
                        return (
                          <g key={`y-label-right-${ratio}`}>
                            <line x1={P - 5} y1={y} x2={P} y2={y} stroke="#111827" strokeWidth={1} />
                            <text x={P - 10} y={y + 4} textAnchor="end" fontSize="8" fill="#6b7280">
                              {value.toFixed(0)}
                            </text>
                          </g>
                        );
                      })}
                      
                      {/* Y-axis title */}
                      <text
                        x={15}
                        y={H / 2}
                        transform={`rotate(-90 15 ${H / 2})`}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#374151"
                        fontWeight="500"
                      >
                        Area (ha)
                      </text>

                      {/* Bars for each month */}
                      {labels.map((label, monthIdx) => {
                        const groupX = P + monthIdx * barGroupWidth;
                        let barIdx = 0;
                        // Check if this month is selected - highlight it, blur others
                        const isSelected = rightSelectedPestYearMonth === label;
                        const opacity = rightShowAllTimeSeries 
                          ? 1 
                          : (rightSelectedPestYearMonth ? (isSelected ? 1 : 0.3) : 1);

                        return (
                          <g key={`month-right-${label}`} opacity={opacity}>
                            {/* Parent bar */}
                            {showParent && (() => {
                              const value = areaValues[monthIdx] || 0;
                              const barHeight = (value / paddedMaxValue) * chartHeight;
                              const x = groupX + barIdx * (barWidth + barSpacing);
                              barIdx++;
                              return (
                                <rect
                                  key={`parent-right-${monthIdx}`}
                                  x={x}
                                  y={H - bottomPadding - barHeight}
                                  width={barWidth}
                                  height={barHeight}
                                  fill={parentColor}
                                  rx={2}
                                />
                              );
                            })()}
                            
                            {/* Children bars */}
                            {displayChildrenSeries.map((values, childIdx) => {
                              const value = values[monthIdx] || 0;
                              const barHeight = (value / paddedMaxValue) * chartHeight;
                              const color = childColors[childIdx % childColors.length];
                              const x = groupX + barIdx * (barWidth + barSpacing);
                              barIdx++;
                              return (
                                <rect
                                  key={`child-right-${displayChildKeys[childIdx]}-${monthIdx}`}
                                  x={x}
                                  y={H - bottomPadding - barHeight}
                                  width={barWidth}
                                  height={barHeight}
                                  fill={color}
                                  rx={2}
                                />
                              );
                            })}
                          </g>
                        );
                      })}
                    </svg>
                    
                    {/* X-axis labels - align with bars, no extra gap, scroll when narrow */}
                    <div
                      className="overflow-x-auto overflow-y-hidden mt-0.5 font-semibold text-gray-700"
                      style={{ paddingLeft: P, paddingRight: P }}
                    >
                      <div
                        className="flex flex-nowrap flex-shrink-0"
                        style={{ minWidth: labels.length * barGroupWidth }}
                      >
                        {labels.map((label, i) => {
                          const isSelected = rightSelectedPestYearMonth === label;
                          const opacity = rightShowAllTimeSeries
                            ? 1
                            : (rightSelectedPestYearMonth ? (isSelected ? 1 : 0.3) : 1);
                          const labelW = Math.max(barGroupWidth, 24);
                          return (
                            <span
                              key={`label-right-${label + i}`}
                              className="whitespace-nowrap flex-shrink-0 overflow-visible"
                              style={{
                                width: `${labelW}px`,
                                minWidth: `${labelW}px`,
                                textAlign: 'center',
                                opacity,
                                fontSize: barGroupWidth < 36 ? 8 : 9,
                              }}
                              title={label}
                            >
                              {formatMonthLabel(label)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Legend */}
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-gray-700">
                      {showParent && (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded" style={{ backgroundColor: parentColor }} />
                          <span className="font-medium"> ha</span>
                        </div>
                      )}
                      {displayChildKeys.map((key, idx) => (
                        <div key={`legend-right-${key}`} className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded"
                            style={{ backgroundColor: childColors[idx % childColors.length] }}
                          />
                          <span className="font-medium capitalize">
                            {key.replace(/_/g, ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                    </div>
                  </div>
                );
              })()
            )}

            {/* Pest children panel for split screen mode - Right side */}
            {splitScreenMode && getActiveTab('right') === 'pest' && rightSelectedPestCategory && rightPestStoredSeries && rightPestStoredSeries.length > 0 && (() => {
              const firstItem = rightPestStoredSeries[0];
              const hierarchy = firstItem?.response_data?.hierarchy;
              const children = hierarchy?.[rightSelectedPestCategory]?.children;
              if (!children || Object.keys(children).length === 0) return null;
              
              // Position above the graph card if graph is shown, otherwise at bottom
              const graphHeight = rightShowPestSeries ? Math.min(Math.max(pestGraphSize.height, 200), 300) : 0;
              const bottomOffset = rightShowPestSeries ? graphHeight + 40 : 16; // Add 40px spacing above graph, or 16px from bottom if graph hidden
              
              return (
                <div 
                  className="absolute right-4 z-[1000] w-[320px] max-w-[calc(50vw-120px)] px-3 py-2 bg-black/70 backdrop-blur-sm rounded-lg border border-gray-600 shadow-xl"
                  style={{ bottom: '320px' }}
                >
                  <div className="flex items-center justify-between mb-2 max-[1024px]:mb-1">
                    <span className="text-xs font-semibold text-gray-300 uppercase max-[1024px]:text-[10px]">
                      {rightSelectedPestCategory.replace(/_/g, ' ')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRightShowPestChildren(prev => !prev)}
                      className="text-xs px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-gray-200 max-[1024px]:text-[10px] max-[1024px]:px-1.5 max-[1024px]:py-0.5"
                    >
                      {rightShowPestChildren ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {rightShowPestChildren && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-[1024px]:gap-1">
                      {Object.entries(children).map(([childKey, child]: [string, any]) => (
                        <button
                          key={childKey}
                          type="button"
                          onClick={() => {
                            // Focus this child in the time-series graph
                            setSelectedPestChildSeries(childKey);
                            setRightShowPestSeries(true);
                            if (child.tile_url) {
                              setRightAllPlotsTileUrls(prev => ({ ...prev, pest: child.tile_url }));
                              setRightShowTileLayers(true);
                            }
                          }}
                          className="p-2 rounded-lg border border-gray-600 bg-gray-800/90 hover:bg-gray-700 text-left cursor-pointer transition-colors max-[1024px]:p-1.5"
                        >
                          <div className="flex items-center gap-1.5 max-[1024px]:gap-1">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 max-[1024px]:w-2 max-[1024px]:h-2"
                              style={{ backgroundColor: PEST_CARD_COLORS[rightSelectedPestCategory] ?? '#f97316' }}
                            />
                            <span className="text-sm font-medium text-gray-200 capitalize truncate max-[1024px]:text-xs">
                              {childKey.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5 max-[1024px]:text-[10px]">
                            {child.pct_of_parent?.toFixed(1) ?? '0.0'}% Â· {child.area_ha?.toFixed(2) ?? '0.00'} ha
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Weather Chart - Right Side removed */}
            {false && (
              <div className="absolute bottom-4 left-4 z-[1000] w-[280px] max-w-[calc(50vw-2rem)] bg-black/70 backdrop-blur-sm rounded-lg border border-gray-600 shadow-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Daily Weather</div>
                    <div className="text-sm text-gray-100">
                      {rightWeatherDailyData?.name || rightSelectedVillage || rightSelectedSubdistrict || rightSelectedDistrict || 'â€”'}
                      {rightWeatherDailyData?.level ? (
                        <span className="text-xs text-gray-400"> Â· {String(rightWeatherDailyData.level)}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {rightWeatherDailyLoading ? (
                      <div className="text-xs text-gray-400">Loadingâ€¦</div>
                    ) : rightWeatherDailyError ? (
                      <div className="text-xs text-red-300">Failed</div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setRightShowWeatherDaily(false)}
                      className="text-[10px] px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-500"
                    >
                      Hide
                    </button>
                  </div>
                </div>

                {rightWeatherDailyError ? (
                  <div className="mt-2 text-xs text-red-300">{rightWeatherDailyError}</div>
                ) : rightWeatherDailyData?.daily?.length ? (
                  (() => {
                    const days = rightWeatherDailyData.daily.slice(0, 7);
                    const tempMax = days.map(d => Number(d.temp_max ?? 0));
                    const rainfall = days.map(d => Number(d.rainfall ?? 0));
                    const windMax = days.map(d => Number(d.wind_max ?? 0));

                    const W = 250;
                    const H = 100;
                    const P = 15;
                    const xStep = days.length > 1 ? (W - P * 2) / (days.length - 1) : 0;

                    // Fixed y-axis scale from 0 to 100
                    const yAxisMin = 0;
                    const yAxisMax = 100;
                    const scale = (v: number) => {
                      // Clamp value to 0-100 range for display
                      const clamped = Math.max(yAxisMin, Math.min(yAxisMax, v));
                      return H - P - ((clamped - yAxisMin) / (yAxisMax - yAxisMin)) * (H - P * 2);
                    };
                    const yTemp = scale;
                    const yRain = scale;
                    const yWind = scale;

                    const pts = (arr: number[], yScale: (v: number) => number) =>
                      arr.map((v, i) => `${P + i * xStep},${yScale(v)}`).join(' ');
                    const fmtDay = (s: string) => {
                      const parts = (s || '').split('-');
                      return parts.length === 3 ? parts[2] : s;
                    };

                    return (
                      <div
                        id="weather-daily-chart-right"
                        className="mt-2 relative"
                        onMouseLeave={() => setRightWeatherChartHoverDay(null)}
                      >
                        {rightWeatherChartHoverDay !== null && days[rightWeatherChartHoverDay] && (
                          <div
                            className="absolute z-10 px-2.5 py-2 rounded-lg bg-gray-900 border border-gray-600 shadow-lg text-xs text-left whitespace-nowrap"
                            style={{
                              left: P + rightWeatherChartHoverDay * xStep - 50,
                              bottom: H + 24,
                            }}
                          >
                            <div className="font-semibold text-gray-200 mb-1">{days[rightWeatherChartHoverDay].date}</div>
                            <div className="text-gray-400">temp_max: <span className="text-orange-400">{days[rightWeatherChartHoverDay].temp_max}</span> Â°C</div>
                            <div className="text-gray-400">rainfall: <span className="text-blue-400">{days[rightWeatherChartHoverDay].rainfall}</span></div>
                            <div className="text-gray-400">wind_max: <span className="text-emerald-400">{days[rightWeatherChartHoverDay].wind_max}</span></div>
                          </div>
                        )}
                        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
                          <line x1={P} y1={P} x2={P} y2={H - P} stroke="rgba(148,163,184,0.25)" />
                          <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="rgba(148,163,184,0.25)" />
                          
                          {/* Y-axis labels (0 to 100) */}
                          {[0, 20, 40, 60, 80, 100].map((val) => {
                            const y = H - P - ((val - yAxisMin) / (yAxisMax - yAxisMin)) * (H - P * 2);
                            return (
                              <g key={`y-label-right-${val}`}>
                                <line x1={P - 5} y1={y} x2={P} y2={y} stroke="rgba(148,163,184,0.25)" />
                                <text x={P - 8} y={y + 3} textAnchor="end" fontSize="8" fill="rgba(148,163,184,0.6)">{val}</text>
                              </g>
                            );
                          })}

                          <polyline points={pts(tempMax, yTemp)} fill="none" stroke="#f97316" strokeWidth="2" />
                          <polyline points={pts(rainfall, yRain)} fill="none" stroke="#3b82f6" strokeWidth="2" />
                          <polyline points={pts(windMax, yWind)} fill="none" stroke="#10b981" strokeWidth="2" />

                          {tempMax.map((v, i) => (
                            <circle key={`tm-right-${i}`} cx={P + i * xStep} cy={yTemp(v)} r="2" fill="#f97316" />
                          ))}
                          {rainfall.map((v, i) => (
                            <circle key={`rf-right-${i}`} cx={P + i * xStep} cy={yRain(v)} r="2" fill="#3b82f6" />
                          ))}
                          {windMax.map((v, i) => (
                            <circle key={`wm-right-${i}`} cx={P + i * xStep} cy={yWind(v)} r="2" fill="#10b981" />
                          ))}

                          {days.map((_, i) => (
                            <rect
                              key={`hover-right-${i}`}
                              x={Math.max(0, P + (i - 0.5) * xStep)}
                              y={0}
                              width={xStep}
                              height={H}
                              fill="transparent"
                              onMouseEnter={() => setRightWeatherChartHoverDay(i)}
                            />
                          ))}
                        </svg>

                        <div className="flex justify-between text-[9px] text-gray-400 px-[15px]">
                          {days.map((d, i) => (
                            <span key={`d-right-${i}`} className="whitespace-nowrap">{fmtDay(d.date)}</span>
                          ))}
                        </div>

                        <div className="mt-2 flex items-center gap-3 text-[9px] text-gray-400">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-orange-500" />
                            <span>temp_max</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span>rainfall</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>wind_max</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : null}
              </div>
            )}


            {/* Map - Right Side */}
            {rightLoading && rightAllPlots.length === 0 ? (
              <div className="h-full w-full flex items-center justify-center bg-gray-900 text-green-500">
                <Loader2 className="animate-spin" size={48} />
              </div>
            ) : (
              <PlotsMap
                plots={rightAllPlots}
                selectedPlotId={selectedPlotId}
                cropColor={predictAreaCropColor}
                fieldAreaByFieldId={predictAreaFieldAreas}
                hideFieldIdAreaCard={rightAllPlots.length === 1 && (rightAllPlots[0].id === rightSelectedDistrict || rightAllPlots[0].id === rightSelectedSubdistrict || rightAllPlots[0].id === rightSelectedVillage)}
                onSelectPlot={async (id) => {
                  setSelectedPlotId(id);
                  const selectedPlot = rightAllPlots.find(p => p.id === id);
                  if (!selectedPlot || !selectedPlot.boundary || selectedPlot.boundary.length === 0) {
                    return;
                  }
                  const bounds = L.latLngBounds(selectedPlot.boundary.map((coord: Coordinate) => [coord[1], coord[0]]));
                  setPlotBounds(bounds);
                }}
                tileUrl={tileUrl}
                plotBounds={plotBounds}
                allPlotsTileUrls={rightAllPlotsTileUrls}
                showTileLayers={rightShowTileLayers}
                waterSources={waterSources}
                onSelectWaterSource={setSelectedWaterSource}
                windDirectPayload={null}
                showWindFlowLayer={false}
              />
            )}

            {renderSplitScreenMapBottomGraph('right')}
          </div>
        )}
      </main>

      {/* Right Sidebar - Enabled for split screen mode */}
      {sidebarVisible && splitScreenMode && (
        <aside 
          className="w-full md:w-64 md:max-w-64 flex-shrink-0 min-w-0 border-l border-gray-700 flex flex-col z-10 shadow-xl relative overflow-hidden"
          style={{
            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
            backgroundImage: 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          {/* Overlay for better text readability */}
          <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm"></div>
          
          {/* Content with relative positioning */}
          <div className="relative z-10 flex flex-col h-full">
            {/* Header section removed - no title or logout icon for right sidebar */}

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Crops Dropdown - before District, independent */}
              {!showGraphPage && !showAnalysisTrendsPage && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Crops
                </label>
                <select
                  value={selectedCrop}
                  onChange={(e) => {
                    setSelectedCrop(e.target.value);
                    setSelectedVillage('');
                    setRightSelectedVillage('');
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">-- Select Crop --</option>
                  <option value="sugarcane">Sugarcane</option>
                </select>
              </div>
              )}

              {/* District Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Select District
                </label>
                <select
                  value={getSelectedDistrict('right')}
                  onChange={(e) => {
                    setRightSelectedDistrict(e.target.value);
                    setRightSelectedSubdistrict('');
                    setRightSelectedVillage('');
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
              {getSelectedDistrict('right') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Select Subdistrict
                  </label>
                  <select
                    value={getSelectedSubdistrict('right')}
                    onChange={(e) => {
                      setRightSelectedSubdistrict(e.target.value);
                      setRightSelectedVillage('');
                    }}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={getSubdistricts('right').length === 0}
                  >
                    <option value="">-- Select Subdistrict --</option>
                    {getSubdistricts('right').map((subdistrict, index) => (
                      <option key={`right-subdistrict-${index}-${subdistrict.subdistrict || 'empty'}`} value={subdistrict.subdistrict}>
                        {subdistrict.subdistrict}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Village Dropdown */}
              {getSelectedSubdistrict('right') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Select Village
                  </label>
                  <select
                    value={getSelectedVillage('right')}
                    onChange={(e) => setRightSelectedVillage(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={getVillages('right').length === 0}
                  >
                    <option value="">-- Select Village --</option>
                    {getVillages('right').map((village, index) => (
                      <option key={`right-village-${index}-${village.village || 'empty'}`} value={village.village}>
                        {village.village}
                      </option>
                    ))}
                  </select>
                  {getSelectedVillage('right') && (
                    <button
                      type="button"
                      onClick={() => setShowRightVillageBoundary(true)}
                      className="mt-2 w-full px-3 py-2 rounded-lg text-sm font-medium bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500"
                    >
                      Display boundary
                    </button>
                  )}
                </div>
              )}

              {splitScreenMode && selectedCrop === 'sugarcane' &&
                leftSelectedDistrict &&
                leftSelectedSubdistrict &&
                leftSelectedVillage && (
                <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Sugarcane area (predicted)
                  </div>
                  {predictSugarcaneAreaLoading ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="animate-spin text-green-400" size={20} />
                    </div>
                  ) : predictSugarcaneAreaHa !== null && predictSugarcaneAreaHa !== undefined ? (
                    <div className="text-lg font-bold text-green-400">{predictSugarcaneAreaHa.toFixed(2)} ha</div>
                  ) : (
                    <div className="text-sm text-gray-500">No sugarcane area data</div>
                  )}
                </div>
              )}

              {/* Total Area Card */}
              {getSelectedDistrict('right') && (
                <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Total Area
                  </div>
                  {getTotalAreaLoading('right') ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="animate-spin text-green-400" size={20} />
                    </div>
                  ) : getTotalAreaHectares('right') !== null && getTotalAreaHectares('right') !== undefined ? (
                    <div className="text-lg font-bold text-green-400">
                      {getTotalAreaHectares('right')!.toFixed(2)} ha
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No area data available</div>
                  )}
                </div>
              )}

              {/* Total Water Area Card - Show when waterSource tab is active */}
              {getActiveTab('right') === 'waterSource' && getSelectedDistrict('right') && (
                <div className="p-4 bg-gray-700 rounded-lg border border-gray-600">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Total Water Area
                  </div>
                  {getLoading('right') && getActiveTab('right') === 'waterSource' ? (
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

              {/* Percentage / Area (ha) â€” grid 2 per row; click loads tile on map */}
              {['growth', 'water', 'soil', 'pest'].includes(getActiveTab('right') || '') && calculateAreaCards('right').length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Percentage / Area (ha)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {calculateAreaCards('right').map((item, idx) => {
                      const currentTab = getActiveTab('right');
                      const cardBg = item.color || '#f97316';
                      const cardFg = textColorOnBackground(cardBg);
                      return (
                        <div
                          key={`right-pct-${item.label}-${idx}`}
                          role={(currentTab === 'pest' && (item.tileUrl != null || item.pestKey != null)) || (['growth', 'water', 'soil'].includes(currentTab || '') && item.tileUrl != null) ? 'button' : undefined}
                          tabIndex={(currentTab === 'pest' && (item.tileUrl != null || item.pestKey != null)) || (['growth', 'water', 'soil'].includes(currentTab || '') && item.tileUrl != null) ? 0 : undefined}
                          onClick={() => {
                            if (currentTab === 'pest') {
                              if (item.tileUrl != null) {
                                setPestTileUrl(item.tileUrl!);
                                setRightAllPlotsTileUrls({ pest: item.tileUrl! });
                                setRightShowTileLayers(true);
                              }
                              if (item.pestKey != null) {
                                setRightSelectedPestCategory(item.pestKey);
                                const children = pestHierarchy?.hierarchy[item.pestKey]?.children;
                                setShowPestChildren(!!children && Object.keys(children).length > 0);
                              }
                            } else if (['growth', 'water', 'soil'].includes(currentTab || '') && item.tileUrl != null) {
                              if (currentTab === 'water') {
                                setRightAllPlotsTileUrls((prev) => ({
                                  ...prev,
                                  [WATER_UPTAKE_CLASS_TILE_KEY]: item.tileUrl!,
                                }));
                              } else {
                                setRightAllPlotsTileUrls({ [currentTab!]: item.tileUrl! });
                              }
                              setRightShowTileLayers(true);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              if ((currentTab === 'pest' && (item.tileUrl != null || item.pestKey != null)) || (['growth', 'water', 'soil'].includes(currentTab || '') && item.tileUrl != null))
                                e.currentTarget.click();
                            }
                          }}
                          style={{ backgroundColor: cardBg, color: cardFg }}
                          className={`p-3 rounded-xl border border-black/15 flex flex-col items-center text-center gap-1.5 min-w-0 ${
                            (currentTab === 'pest' && (item.tileUrl != null || item.pestKey != null)) ||
                            (['growth', 'water', 'soil'].includes(currentTab || '') && item.tileUrl != null)
                              ? 'cursor-pointer hover:brightness-95 transition-all'
                              : ''
                          }`}
                        >
                          <div className="flex items-center justify-center w-full min-w-0">
                            <span className="text-xs font-medium truncate w-full" style={{ color: cardFg }}>
                              {item.label}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5 mt-1 w-full">
                            <span className="font-semibold text-xs md:text-sm break-words" style={{ color: cardFg }}>
                              {item.percentage != null ? `${formatPct(item.percentage)}%` : '0%'}
                            </span>
                            <span className="font-semibold text-xs md:text-sm break-words" style={{ color: cardFg }}>
                              {item.value.toFixed(2)} ha
                            </span>
                          </div>
                        </div>
                      );
                    })}
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
              {getError('right') && (
                <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm flex flex-col items-center text-center gap-2">
                  <AlertCircle size={20} />
                  {getError('right')}
                </div>
              )}

              {/* Loading Indicator */}
              {getLoading('right') && (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                  <Loader2 className="animate-spin mb-2" size={32} />
                  <span>Loading...</span>
                </div>
              )}
            </div>
          </div>
        </aside>
      )}
      </div>
        </>
      )}
    </div>
  );
};

export { App };
export default App;
