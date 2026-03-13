import React, { useState, useEffect, useRef } from 'react';
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
  fetchDashboardIndicesStore,
  fetchWeatherDaily,
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
  PestHierarchyResponse,
  PestHierarchyChild,
  PestStoredResponse,
  PestStoredItem
} from './services/analysisService';
import { Coordinate } from './types';
import { Loader2, AlertCircle, Layers, Home, LogOut, Eye, EyeOff, Sprout, Droplets, Droplet, Bug, Waves, Trees, LineChart as LineChartIcon, Download, FileText, FileSpreadsheet, ChevronLeft, ChevronRight, Columns, Maximize2, ChevronUp, ChevronDown } from 'lucide-react';
import { HiOutlineLogout } from "react-icons/hi";
import { IoResize } from "react-icons/io5";
import { BsArrowsMove, BsGraphUp } from "react-icons/bs";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { generateDashboardIndicesPdf } from './utils/dashboardIndicesPdf';

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
  
  // State for Methane
  const [methaneTileUrl, setMethaneTileUrl] = useState<string | null>(null);
  const [methaneLoading, setMethaneLoading] = useState<boolean>(false);
  const [methaneEnabled, setMethaneEnabled] = useState<boolean>(false);
  
  // State for GeoJSON plots (e.g. from boundary load; currently unused)
  const [geojsonPlots, setGeojsonPlots] = useState<Array<{id: string; field_id?: string; area_ha: string; boundary: Coordinate[]}>>([]);
  const [geojsonLoading, setGeojsonLoading] = useState<boolean>(false);

  // Predict-area (crop): color and field_area_ha per field_id when crop + village selected
  const [predictAreaCropColor, setPredictAreaCropColor] = useState<string | null>(null);
  const [predictAreaFieldAreas, setPredictAreaFieldAreas] = useState<Record<string, number>>({});
  
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
  const [growthChartViewMode, setGrowthChartViewMode] = useState<'all' | 'selected'>('all');

  // State for Water/Soil stored time series (year_month from analyze_wateruptakeclasswise / analyze_soilmoistureclasswise)
  const [waterStoredSeries, setWaterStoredSeries] = useState<GrowthStoredResponse | null>(null);
  const [soilStoredSeries, setSoilStoredSeries] = useState<GrowthStoredResponse | null>(null);
  const [selectedWaterYearMonth, setSelectedWaterYearMonth] = useState<string | null>(null);
  const [selectedSoilYearMonth, setSelectedSoilYearMonth] = useState<string | null>(null);

  // Dashboard indices store (frequency dropdown: weekly | monthly | yearly; indices dropdown from API)
  const [dashboardIndicesData, setDashboardIndicesData] = useState<DashboardIndicesStoreResponse | null>(null);
  const [dashboardIndicesLoading, setDashboardIndicesLoading] = useState<boolean>(false);
  const [dashboardIndicesError, setDashboardIndicesError] = useState<string | null>(null);
  const [dashboardIndicesFrequency, setDashboardIndicesFrequency] = useState<DashboardIndicesFrequency>('weekly');
  const [selectedDashboardIndex, setSelectedDashboardIndex] = useState<string | null>(null);
  
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

  // Refs to ignore stray second click when user double-taps Land Surface or Methane (so the second tap doesn't open the other)
  const lastLstDoubleClickRef = useRef(0);
  const lastMethaneDoubleClickRef = useRef(0);
  const LST_METHANE_DBLCLICK_MS = 400;
  // If user double-clicks to close while fetch is in flight, don't re-apply the result (so Methane/LST stay closed)
  const methaneClosedByUserRef = useRef(false);
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

  const downloadPestGraphPDF = async () => {
    try {
      const graphElement = document.getElementById('pest-time-series-graph');
      const weatherElement = document.getElementById('weather-daily-chart');
      
      if (!graphElement) {
        alert('Pest graph not found');
        return;
      }

      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = 297; // A4 landscape width in mm
      const pageHeight = 210; // A4 landscape height in mm
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);
      
      let yPos = margin;
      
      // Add title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Nearlive Crop Monitoring', margin, yPos);
      yPos += 8;
      
      // Add location info with text wrapping - ensure full text display
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      yPos = addWrappedText(pdf, getLocationString(), margin, yPos, contentWidth, 6, margin);
      yPos += 2;
      
      // Add pest info with text wrapping - ensure full text display
      if (selectedPestCategory) {
        yPos = addWrappedText(pdf, `Pest: ${selectedPestCategory.replace(/_/g, ' ')}`, margin, yPos, contentWidth, 6, margin);
        yPos += 2;
      }
      
      // Capture pest graph
      const pestCanvas = await html2canvas(graphElement, { 
        scale: 2,
        backgroundColor: '#f3f4f6',
        logging: false
      });
      const pestImgData = pestCanvas.toDataURL('image/png');
      const pestImgHeight = (pestCanvas.height * contentWidth) / pestCanvas.width;
      
      // Add pest graph - ensure it doesn't push content off page
      const maxPestHeight = pageHeight - yPos - 30; // Leave 30mm for bottom margin and any text
      const actualPestHeight = Math.min(pestImgHeight, maxPestHeight);
      pdf.addImage(pestImgData, 'PNG', margin, yPos, contentWidth, actualPestHeight);
      yPos += actualPestHeight + 10;
      
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
        const weatherCanvas = await html2canvas(weatherElement, { 
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false
        });
        const weatherImgData = weatherCanvas.toDataURL('image/png');
        const weatherImgHeight = (weatherCanvas.height * contentWidth) / weatherCanvas.width;
        
        // Add weather graph - ensure it doesn't push content off page, leave space for text
        const maxWeatherHeight = pageHeight - yPos - 30; // Leave 30mm for bottom margin and any text
        pdf.addImage(weatherImgData, 'PNG', margin, yPos, contentWidth, Math.min(weatherImgHeight, maxWeatherHeight));
      }
      
      pdf.save(`nearlive-crop-monitoring-${selectedPestCategory || 'data'}-${Date.now()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    }
  };

  const downloadPestGraphExcel = () => {
    try {
      if (!pestStoredSeries || !selectedPestCategory) {
        alert('No data available');
        return;
      }

      const series = pestStoredSeries
        .filter((item: PestStoredItem) => {
          const h = (item as any).response_data?.hierarchy || {};
          return h[selectedPestCategory];
        })
        .sort((a: PestStoredItem, b: PestStoredItem) => a.year_month.localeCompare(b.year_month));

      if (!series.length) {
        alert('No data available');
        return;
      }

      const labels = series.map(s => s.year_month);
      const areaValues = series.map(s => {
        const h = (s as any).response_data?.hierarchy?.[selectedPestCategory] || {};
        return Number(h.total_area_ha ?? 0);
      });

      const firstCategory: any = (series[0] as any).response_data?.hierarchy?.[selectedPestCategory] || {};
      const childKeys: string[] = firstCategory.children ? Object.keys(firstCategory.children).sort() : [];

      const childrenData: { [key: string]: number[] } = {};
      childKeys.forEach(childKey => {
        childrenData[childKey] = series.map(s => {
          const child = (s as any).response_data?.hierarchy?.[selectedPestCategory]?.children?.[childKey] || {};
          return Number((child as any).area_ha ?? (child as any).total_area_ha ?? 0);
        });
      });

      const worksheetData: any[] = [];
      worksheetData.push(['Nearlive Crop Monitoring']);
      worksheetData.push([getLocationString()]);
      worksheetData.push([`Pest: ${selectedPestCategory.replace(/_/g, ' ')}`]);
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
      XLSX.writeFile(wb, `pest-data-${selectedPestCategory}-${Date.now()}.xlsx`);
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
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);
      
      let yPos = margin;
      
      // Add title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Nearlive Crop Monitoring', margin, yPos);
      yPos += 8;
      
      // Add location info with text wrapping - ensure full text display
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      yPos = addWrappedText(pdf, getLocationString(), margin, yPos, contentWidth, 6, margin);
      yPos += 2;
      
      // Add pest info if available with text wrapping - ensure full text display
      if (selectedPestCategory && graphElement) {
        yPos = addWrappedText(pdf, `Pest: ${selectedPestCategory.replace(/_/g, ' ')}`, margin, yPos, contentWidth, 6, margin);
        yPos += 4;
        
        // Capture and add pest graph - ensure it doesn't push content off page
        const pestCanvas = await html2canvas(graphElement, { 
          scale: 2,
          backgroundColor: '#f3f4f6',
          logging: false
        });
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
      const weatherCanvas = await html2canvas(chartElement, { 
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });
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
      
      const headers = ['Date', 'Temp Max (°C)', 'Temp Min (°C)', 'Rainfall (mm)', 'Wind Max (km/h)'];
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

  const downloadDashboardIndicesPDF = () => {
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
      generateDashboardIndicesPdf(
        {
          district: selectedDistrict || '',
          subdistrict: selectedSubdistrict || '',
          village: selectedVillage || '',
          stored,
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
      const headers = ['Card Name', 'District', 'Subdistrict', 'Village', 'Period Date', 'Value'];
      const rows: (string | number)[][] = [headers];
      stored.forEach((item: { index_name: string; period_date: string; value: number }) => {
        rows.push([
          String(item.index_name || '').toUpperCase(),
          selectedDistrict || '',
          selectedSubdistrict || '',
          selectedVillage || '',
          item.period_date || '',
          item.value
        ]);
      });
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Indices');
      XLSX.writeFile(wb, `Nearlive-crop-Monitoring-${selectedDistrict || 'export'}-${Date.now()}.xlsx`);
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
          
          // Use API for all subdistricts (including Palus)
          const data = await fetchVillages(selectedSubdistrict);
          if (Array.isArray(data)) {
            setVillages(data);
          } else {
            console.warn('Unexpected villages response format:', data);
            setVillages([]);
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
        console.error('Error processing district geometry:', err);
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
          console.error('Error processing subdistrict geometry:', err);
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
          console.error('Error processing district geometry:', err);
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
        console.warn('Field boundaries API failed, falling back to village geometry:', err);
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
        console.error('Error processing village geometry:', err);
        setAllPlots([]);
      }
    };

    loadVillageBoundary();
    return () => { cancelled = true; };
  }, [selectedVillage, selectedDistrict, selectedSubdistrict, villages]);

  // When crop type + village selected, fetch predict-area for color and field_area_ha per field_id
  useEffect(() => {
    if (!selectedCrop || !selectedDistrict || !selectedSubdistrict || !selectedVillage) {
      setPredictAreaCropColor(null);
      setPredictAreaFieldAreas({});
      return;
    }
    let cancelled = false;
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    fetchPredictArea(selectedDistrict, selectedSubdistrict, selectedVillage, month)
      .then((res) => {
        if (cancelled) return;
        const cropKey = selectedCrop.toLowerCase();
        const cropData = res[cropKey] as { crop_name?: string; crop_area_ha?: number; color?: string; identified_field_boundaries?: Record<string, { field_id: number; field_area_ha: number }> } | undefined;
        if (!cropData || typeof cropData !== 'object') {
          setPredictAreaCropColor(null);
          setPredictAreaFieldAreas({});
          return;
        }
        setPredictAreaCropColor(cropData.color ?? null);
        const areas: Record<string, number> = {};
        const boundaries = cropData.identified_field_boundaries ?? {};
        Object.values(boundaries).forEach((item) => {
          areas[String(item.field_id)] = item.field_area_ha;
        });
        setPredictAreaFieldAreas(areas);
      })
      .catch(() => {
        if (!cancelled) {
          setPredictAreaCropColor(null);
          setPredictAreaFieldAreas({});
        }
      });
    return () => { cancelled = true; };
  }, [selectedCrop, selectedDistrict, selectedSubdistrict, selectedVillage]);

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
          console.error('Error processing subdistrict geometry:', err);
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
            console.warn('Unexpected subdistricts response format:', data);
            setLeftSubdistricts([]);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          console.error('Error loading left subdistricts:', err);
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
            console.warn('Unexpected villages response format:', data);
            setLeftVillages([]);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          console.error('Error loading left villages:', err);
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
          
          // Log the full response to debug
          console.log('📊 Left Total Area API Response:', response);
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
            setLeftTotalAreaHectares(areaValue);
            console.log('✅ Setting left total area to:', areaValue);
          } else {
            console.warn('⚠️ No valid area found in response');
            setLeftTotalAreaHectares(null);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          console.error('❌ Error loading left total area:', err);
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
            console.warn('Unexpected subdistricts response format:', data);
            setRightSubdistricts([]);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          console.error('Error loading right subdistricts:', err);
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
            console.warn('Unexpected villages response format:', data);
            setRightVillages([]);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          console.error('Error loading right villages:', err);
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
          
          // Log the full response to debug
          console.log('📊 Right Total Area API Response:', response);
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
            setRightTotalAreaHectares(areaValue);
            console.log('✅ Setting right total area to:', areaValue);
          } else {
            console.warn('⚠️ No valid area found in response');
            setRightTotalAreaHectares(null);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          console.error('❌ Error loading right total area:', err);
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
              // Keep existing boundary (district/subdistrict) visible when we have tile URLs but no boundaries from API
              if (Object.keys(tileUrlsMap).length === 0) {
                setAllPlots([]);
              }
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
              if (wStored.length > 0) {
                const inList = selectedTimeSeriesYearMonth && wStored.some((x: GrowthStoredItem) => x.year_month === selectedTimeSeriesYearMonth);
                setSelectedWaterYearMonth(inList ? selectedTimeSeriesYearMonth : wStored[0].year_month);
                if (!inList) setSelectedTimeSeriesYearMonth(wStored[0].year_month);
              } else setSelectedWaterYearMonth(null);
            } else if (activeTab === 'soil') {
              const sStored = Array.isArray(storedResponse.stored) ? storedResponse.stored : [];
              setSoilStoredSeries(sStored);
              if (sStored.length > 0) {
                const inList = selectedTimeSeriesYearMonth && sStored.some((x: GrowthStoredItem) => x.year_month === selectedTimeSeriesYearMonth);
                setSelectedSoilYearMonth(inList ? selectedTimeSeriesYearMonth : sStored[0].year_month);
                if (!inList) setSelectedTimeSeriesYearMonth(sStored[0].year_month);
              } else setSelectedSoilYearMonth(null);
            } else if (activeTab === 'pest' && Array.isArray(storedResponse.stored)) {
              const stored = storedResponse.stored as PestStoredResponse;
              setPestStoredSeries(stored);
              if (stored.length > 0) {
                const inList = selectedTimeSeriesYearMonth && stored.some((x: PestStoredItem) => x.year_month === selectedTimeSeriesYearMonth);
                const effective = inList ? selectedTimeSeriesYearMonth! : stored[0].year_month;
                setSelectedPestYearMonth(effective);
                if (!inList) setSelectedTimeSeriesYearMonth(stored[0].year_month);
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
            console.warn(`Left district ${leftSelectedDistrict} has insufficient coordinates:`, coordinates.length);
            setLeftAllPlots([]);
          }
        } catch (err) {
          console.error('Error processing left district geometry:', err);
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
            console.log('✅ Right district boundary displayed:', rightSelectedDistrict);
            
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
            console.warn(`Right district ${rightSelectedDistrict} has insufficient coordinates:`, coordinates.length);
            setRightAllPlots([]);
          }
        } catch (err) {
          console.error('Error processing right district geometry:', err);
          setRightAllPlots([]);
        }
      } else {
        // No geometry available
        console.warn('Right district has no geometry:', rightSelectedDistrict);
        setRightAllPlots([]);
      }
    } else if (splitScreenMode && (!rightSelectedDistrict || rightSelectedSubdistrict || rightSelectedVillage)) {
      if (!rightSelectedDistrict) setRightAllPlots([]);
    }
  }, [splitScreenMode, rightSelectedDistrict, rightSelectedSubdistrict, rightSelectedVillage, districts]);

  // Handle left subdistrict boundary display in split screen mode (even without tab)
  useEffect(() => {
    if (splitScreenMode && leftSelectedSubdistrict && leftSubdistricts.length > 0 && !leftActiveTab) {
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
            console.warn(`Left subdistrict ${leftSelectedSubdistrict} has insufficient coordinates:`, coordinates.length);
            setLeftAllPlots([]);
          }
        } catch (err) {
          console.error('Error processing left subdistrict geometry:', err);
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
          console.error('Error processing left district geometry:', err);
        }
      }
    }
  }, [splitScreenMode, leftSelectedSubdistrict, leftSubdistricts, leftSelectedDistrict, leftSelectedVillage, leftActiveTab, districts]);

  // Handle left village boundary display in split screen mode (even without tab)
  useEffect(() => {
    if (splitScreenMode && leftSelectedVillage && leftVillages.length > 0 && !leftActiveTab) {
      // Find the selected village data
      const villageData = leftVillages.find(v => v.village === leftSelectedVillage);
      
      if (villageData?.coordinates || villageData?.geometry) {
        try {
          let coordinates: Coordinate[] = [];
          
          // Handle new format: coordinates directly on village object with geom_type
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
          }
          // Handle old format: geometry object
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
            }
          }
          
          // Create a plot from village boundary for map display
          if (coordinates.length >= 3) {
            const villagePlot = {
              id: leftSelectedVillage,
              area_ha: '0',
              boundary: coordinates
            };
            setLeftAllPlots([villagePlot]);
            
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
          } else {
            console.warn(`Left village ${leftSelectedVillage} has insufficient coordinates:`, coordinates.length);
            setLeftAllPlots([]);
          }
        } catch (err) {
          console.error('Error processing left village geometry:', err);
          setLeftAllPlots([]);
        }
      } else {
        setLeftAllPlots([]);
      }
    } else if (splitScreenMode && !leftSelectedVillage && leftSelectedSubdistrict) {
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
          console.error('Error processing left subdistrict geometry:', err);
        }
      }
    }
  }, [splitScreenMode, leftSelectedVillage, leftVillages, leftSelectedSubdistrict, leftSubdistricts, leftActiveTab]);

  // Handle right subdistrict boundary display in split screen mode (even without tab)
  useEffect(() => {
    if (splitScreenMode && rightSelectedSubdistrict && rightSubdistricts.length > 0 && !rightActiveTab && !rightSelectedVillage) {
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
            console.log('✅ Right subdistrict boundary displayed:', rightSelectedSubdistrict);
            
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
            console.warn(`Right subdistrict ${rightSelectedSubdistrict} has insufficient coordinates:`, coordinates.length);
            setRightAllPlots([]);
          }
        } catch (err) {
          console.error('Error processing right subdistrict geometry:', err);
          setRightAllPlots([]);
        }
      } else {
        console.warn('Right subdistrict has no geometry:', rightSelectedSubdistrict);
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
            console.log('✅ Right district boundary restored after subdistrict cleared');
          }
        } catch (err) {
          console.error('Error processing right district geometry:', err);
        }
      }
    }
  }, [splitScreenMode, rightSelectedSubdistrict, rightSubdistricts, rightSelectedDistrict, rightSelectedVillage, rightActiveTab, districts]);

  // Handle right village boundary display in split screen mode (even without tab)
  useEffect(() => {
    if (splitScreenMode && rightSelectedVillage && rightVillages.length > 0 && !rightActiveTab) {
      // Find the selected village data
      const villageData = rightVillages.find(v => v.village === rightSelectedVillage);
      
      if (villageData?.coordinates || villageData?.geometry) {
        try {
          let coordinates: Coordinate[] = [];
          
          // Handle new format: coordinates directly on village object with geom_type
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
          }
          // Handle old format: geometry object
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
            }
          }
          
          // Create a plot from village boundary for map display
          if (coordinates.length >= 3) {
            const villagePlot = {
              id: rightSelectedVillage,
              area_ha: '0',
              boundary: coordinates
            };
            setRightAllPlots([villagePlot]);
            console.log('✅ Right village boundary displayed:', rightSelectedVillage);
            
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
          } else {
            console.warn(`Right village ${rightSelectedVillage} has insufficient coordinates:`, coordinates.length);
            setRightAllPlots([]);
          }
        } catch (err) {
          console.error('Error processing right village geometry:', err);
          setRightAllPlots([]);
        }
      } else {
        console.warn('Right village has no geometry/coordinates:', rightSelectedVillage);
        setRightAllPlots([]);
      }
    } else if (splitScreenMode && !rightSelectedVillage && rightSelectedSubdistrict && !rightActiveTab) {
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
            console.log('✅ Right subdistrict boundary restored after village cleared');
          }
        } catch (err) {
          console.error('Error processing right subdistrict geometry:', err);
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
                console.error('Error processing left village geometry for boundary preservation:', err);
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
                console.error('Error processing left subdistrict geometry for boundary preservation:', err);
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
                console.error('Error processing left district geometry for boundary preservation:', err);
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
              console.log(`✅ Displaying ${finalPlots.length} plots on left map (${plotsForMap.length} analysis + ${locationBoundary ? '1 location boundary' : '0 location boundary'})`);
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
          console.error(`Error loading left ${leftActiveTab} analysis:`, err);
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
                console.error('Error processing right village geometry for boundary preservation:', err);
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
                console.error('Error processing right subdistrict geometry for boundary preservation:', err);
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
                console.error('Error processing right district geometry for boundary preservation:', err);
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
              console.log(`✅ Displaying ${finalPlots.length} plots on right map (${plotsForMap.length} analysis + ${locationBoundary ? '1 location boundary' : '0 location boundary'})`);
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
          console.error(`Error loading right ${rightActiveTab} analysis:`, err);
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
      console.log('✅ Cleared normal screen - showing clean base satellite map');
    }
  }, [splitScreenMode]);

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

  // Fetch sugarcane tile only when crop + district + subdistrict + village selected (do not show large overlay for district/subdistrict only)
  useEffect(() => {
    if (selectedCrop === 'sugarcane' && selectedDistrict && selectedSubdistrict && selectedVillage) {
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
    } else {
      setCropTileUrl(null);
      setCropAreaHa(null);
      if (!selectedCrop || !selectedVillage) {
        setAllPlotsTileUrls(prev => {
          const next = { ...prev };
          delete next['sugarcane'];
          return next;
        });
      }
    }
  }, [selectedCrop, selectedDistrict, selectedSubdistrict, selectedVillage]);

  // Reset methane when district/subdistrict changes
  useEffect(() => {
    setMethaneEnabled(false);
    setMethaneTileUrl(null);
  }, [selectedDistrict, selectedSubdistrict]);

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

  // Fetch dashboard indices store when district, subdistrict and frequency are set
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!selectedDistrict || !selectedSubdistrict) {
        if (!cancelled) {
          setDashboardIndicesData(null);
          setDashboardIndicesError(null);
          setSelectedDashboardIndex(null);
        }
        return;
      }
      try {
        setDashboardIndicesLoading(true);
        setDashboardIndicesError(null);
        const data = await fetchDashboardIndicesStore(selectedDistrict, selectedSubdistrict, dashboardIndicesFrequency);
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
  }, [selectedDistrict, selectedSubdistrict, dashboardIndicesFrequency]);

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

  // Format percentage for display (small values show 2 decimals)
  const formatPct = (p: number) =>
    p > 0 && p < 1 ? p.toFixed(2) : String(Math.round(p));

  // Format class_name for display: "shallow_water" -> "Shallow Water"
  const formatClassLabel = (name: string) =>
    (name || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // Tab name for Health Trends card header (e.g. growth -> "Growth", waterSource -> "Water Source")
  const getActiveTabDisplayName = (side: 'left' | 'right' = 'left'): string => {
    const tab = getActiveTab(side);
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
      return selectedVillage || selectedSubdistrict || selectedDistrict || '—';
    }
    if (side === 'left') return leftSelectedVillage || leftSelectedSubdistrict || leftSelectedDistrict || '—';
    return rightSelectedVillage || rightSelectedSubdistrict || rightSelectedDistrict || '—';
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
        areaCards.push({
          label: formatClassLabel(c.class_name || ''),
          value: Number(c.area_hectares ?? 0),
          percentage: Number(c.percentage ?? 0),
          color: c.color || '#f97316',
          tileUrl: c.tile_url ?? undefined,
        });
      });
    } else if (sideActiveTab === 'growth') {
      areaCards.push(
        { label: 'Weak', value: Number(ps.weak_area_hectares || 0), percentage: Number(ps.weak_pixel_percentage ?? 0), color: '#f97316' },
        { label: 'Stress', value: Number(ps.stress_area_hectares || 0), percentage: Number(ps.stress_pixel_percentage ?? 0), color: '#f97316' },
        { label: 'Moderate', value: Number(ps.moderate_area_hectares || 0), percentage: Number(ps.moderate_pixel_percentage ?? 0), color: '#f97316' },
        { label: 'Healthy', value: Number(ps.healthy_area_hectares || 0), percentage: Number(ps.healthy_pixel_percentage ?? 0), color: '#f97316' },
      );
    } else if (sideActiveTab === 'water') {
      areaCards.push(
        { label: 'Deficient', value: Number(ps.deficient_area_hectare || 0), percentage: Number(ps.deficient_pixel_percentage ?? 0), color: '#f97316' },
        { label: 'Less', value: Number(ps.less_area_hectare || 0), percentage: Number(ps.less_pixel_percentage ?? 0), color: '#f97316' },
        { label: 'Adequate', value: Number(ps.adequat_area_hectare || 0), percentage: Number(ps.adequate_pixel_percentage ?? ps.adequat_pixel_percentage ?? 0), color: '#f97316' },
        { label: 'Excellent', value: Number(ps.excellent_area_hectare || 0), percentage: Number(ps.excellent_pixel_percentage ?? 0), color: '#f97316' },
        { label: 'Excess', value: Number(ps.excess_area_hectare || 0), percentage: Number(ps.excess_pixel_percentage ?? 0), color: '#f97316' },
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
        const order = ['healthy', 'chewing', 'fungi', 'sucking', 'wilt', 'soilborne'];
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
    <div className="flex flex-col h-screen w-full bg-gray-900 text-gray-100 font-sans overflow-hidden relative">
      {/* Bar Graph page - full screen when opened from header icon */}
      {showGraphPage ? (
        <div className="flex-1 flex flex-col bg-gray-900 overflow-auto">
          <div className="flex-shrink-0 border-b border-gray-700 bg-gray-800">
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
                <BsGraphUp size={22} />
              </div>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3 px-4 md:px-6 pb-3">
              <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Crops</label>
                <select
                  value={selectedCrop}
                  onChange={(e) => { setSelectedCrop(e.target.value); setSelectedVillage(''); }}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 min-w-[140px]"
                >
                  <option value="">-- Select Crop --</option>
                  <option value="sugarcane">Sugarcane</option>
                </select>
              </div>
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
              </div>
              {/* Frequency dropdown - same row as other filters */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Frequency</label>
                <select
                  value={dashboardIndicesFrequency}
                  onChange={(e) => setDashboardIndicesFrequency(e.target.value as DashboardIndicesFrequency)}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 min-w-[140px]"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              {dashboardIndicesError && selectedDistrict && selectedSubdistrict && (
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
            {!selectedDistrict || !selectedSubdistrict ? (
              <div className="w-full max-w-4xl mx-auto rounded-lg border border-gray-700 bg-gray-800/80 p-8 text-center">
                <p className="text-gray-400">Select District and Subdistrict, then choose Frequency to load indices data.</p>
              </div>
            ) : dashboardIndicesLoading ? (
              <div className="w-full max-w-4xl mx-auto rounded-lg border border-gray-700 bg-gray-800/80 p-8 flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-green-400" size={32} />
                <p className="text-gray-400">Loading indices data…</p>
              </div>
            ) : dashboardIndicesData?.stored && Array.isArray(dashboardIndicesData.stored) ? (
              (() => {
                const stored = (dashboardIndicesData as { stored: Array<{ index_name: string; period_date: string; value: number }> }).stored;
                const INDEX_NAMES = ['evi', 'bsi', 'gndvi', 'lst', 'ndbi', 'ndmi', 'ndre', 'ndvi', 'evi2'] as const;
                const byIndex: Record<string, Array<{ period_date: string; value: number }>> = {};
                INDEX_NAMES.forEach(name => { byIndex[name] = []; });
                stored.forEach((item: { index_name: string; period_date: string; value: number }) => {
                  const key = item.index_name.toLowerCase();
                  if (byIndex[key]) {
                    byIndex[key].push({ period_date: item.period_date, value: item.value });
                  }
                });
                INDEX_NAMES.forEach(name => {
                  byIndex[name].sort((a, b) => a.period_date.localeCompare(b.period_date));
                });
                const cardColors: Record<string, string> = {
                  evi: '#22c55e', bsi: '#f59e0b', gndvi: '#06b6d4', lst: '#ef4444',
                  ndbi: '#8b5cf6', ndmi: '#ec4899', ndre: '#14b8a6', ndvi: '#3b82f6', evi2: '#84cc16'
                };
                const yearPalette = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#e11d48', '#10b981', '#facc15', '#6366f1', '#14b8a6', '#ef4444'];
                return (
                  <div id="dashboard-indices-cards" className="w-full px-4 md:px-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                      {INDEX_NAMES.map((indexName) => {
                        const points = byIndex[indexName] || [];
                        const latest = points.length > 0 ? points[points.length - 1] : null;
                        const titleColor = cardColors[indexName] ?? '#6b7280';

                        // Fixed 12 months (Jan–Dec) on x-axis so each year draws one continuous line
                        const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const monthMap: Record<string, { month: string; monthIndex: number; [k: string]: string | number }> = {};
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
                          monthMap[key][String(year)] = p.value;
                        });

                        const years = Array.from(yearsSet).sort((a, b) => a - b).map((y) => String(y));
                        // One row per month (12 rows); missing values are null so lines connect across gaps
                        const chartData = MONTH_LABELS.map((month, monthIndex) => {
                          const key = `${monthIndex}-${month}`;
                          const entry = monthMap[key];
                          const row: Record<string, string | number | null> = { month };
                          years.forEach((y) => {
                            const val = entry != null ? entry[y] : undefined;
                            row[y] = typeof val === 'number' && !isNaN(val) ? val : null;
                          });
                          return row;
                        });

                        return (
                          <div
                            key={indexName}
                            className="rounded-lg border border-gray-600 bg-gray-800/90 p-4 flex flex-col min-h-[280px]"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-gray-200 uppercase" style={{ color: titleColor }}>
                                {indexName}
                              </span>
                              {latest && (
                                <span className="text-xs text-gray-400">
                                  {typeof latest.value === 'number' && (latest.value > 1000 || latest.value < -1000)
                                    ? latest.value.toExponential(2)
                                    : typeof latest.value === 'number'
                                      ? latest.value.toFixed(4)
                                      : String(latest.value)}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-500 mb-1">
                              {points.length} points · {dashboardIndicesFrequency}
                            </div>
                            {chartData.length > 0 ? (
                              <div className="w-full flex-1 min-h-[220px]" style={{ maxWidth: '100%', maxHeight: '70vh' }}>
                                <ResponsiveContainer width="100%" height={220}>
                                  <LineChart
                                    data={chartData}
                                    margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                                  >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis
                                      dataKey="month"
                                      tick={{ fill: '#9ca3af', fontSize: 10 }}
                                      interval="preserveStartEnd"
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
                                      labelFormatter={(label) => label}
                                    />
                                    <Legend
                                      verticalAlign="bottom"
                                      height={20}
                                      wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                                    />
                                    {years.map((yearKey, idx) => (
                                      <Line
                                        key={yearKey}
                                        type="monotone"
                                        dataKey={yearKey}
                                        stroke={yearPalette[idx % yearPalette.length]}
                                        dot={{ r: 2 }}
                                        strokeWidth={1.5}
                                        connectNulls
                                        isAnimationActive
                                        animationDuration={600}
                                      />
                                    ))}
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
                <p className="text-gray-400">Select District, Subdistrict and Frequency to load indices. Data will appear here after selection.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
      {/* Header bar - Home + Split (left), title, Download + Logout (right) */}
      <header className="flex-shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-3 px-4 md:px-6 py-3 border-b border-gray-700 bg-gray-800 z-20">
        <div className="flex items-center gap-1.5 md:gap-2 justify-self-start">
          <button
            onClick={() => setSidebarVisible(!sidebarVisible)}
            className="p-2 rounded-lg bg-gray-800 border border-white/40 text-white hover:bg-gray-700 transition-all flex items-center justify-center w-9 h-9 shrink-0"
            title={sidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
          >
            <Home size={16} className="md:w-[18px] md:h-[18px]" />
          </button>
          <button
            onClick={() => setSplitScreenMode(!splitScreenMode)}
            onDoubleClick={() => setSplitScreenMode(false)}
            className={`p-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center w-9 h-9 shrink-0 ${
              splitScreenMode
                ? 'bg-purple-600 text-white hover:bg-purple-700 border border-transparent'
                : 'bg-gray-800 border border-white/40 text-white hover:bg-gray-700'
            }`}
            title={splitScreenMode ? 'Double-click to exit split screen' : 'Split Screen'}
          >
            {splitScreenMode ? <Maximize2 size={16} className="md:w-[18px] md:h-[18px]" /> : <Columns size={16} className="md:w-[18px] md:h-[18px]" />}
          </button>
          {/* Bar Graph - opens new page */}
          <button
            type="button"
            onClick={() => setShowGraphPage(true)}
            className="p-2 rounded-lg bg-gray-800 border border-white/40 text-white hover:bg-gray-700 transition-all flex items-center justify-center w-9 h-9 shrink-0"
            title="Bar Graph"
          >
            <BsGraphUp size={18} />
          </button>
        </div>
        <h1 className="text-lg md:text-xl font-bold text-green-400 shrink-0 justify-self-center">
          <BlurText 
            text="Nearlive Crop Monitoring" 
            animateBy="words"
            direction="top"
            delay={100}
            className="text-green-400"
          />
        </h1>
        <div className="flex items-center gap-1.5 md:gap-2 justify-self-end">
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
                    onClick={() => { setShowDownloadMenu(false); downloadPestGraphPDF(); }}
                    className="w-full px-3 py-2 text-white hover:bg-red-500/30 hover:text-red-300 flex items-center justify-center gap-2 transition-colors"
                  >
                    <FileText size={16} />
                    <span className="text-xs">PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDownloadMenu(false); downloadPestGraphExcel(); }}
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
            className="w-full md:w-64 flex-shrink-0 border-r border-gray-700 flex flex-col z-10 shadow-xl relative overflow-hidden"
            style={{
              backgroundImage: `url(${backgroundImages[currentBgImageIndex]})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          >
            {/* Overlay for better text readability */}
            <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm"></div>
            
            <div className="relative z-10 flex flex-col h-full flex-1 overflow-y-auto p-4 space-y-4 pt-4">
              <div className="text-xs font-semibold text-white uppercase tracking-wider mb-3">CONFIGURATION</div>
              {/* Crops Dropdown - before District, independent */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Crops
            </label>
            <select
              value={selectedCrop}
              onChange={(e) => {
                setSelectedCrop(e.target.value);
                setSelectedVillage('');
                if (splitScreenMode) setLeftSelectedVillage('');
              }}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">-- Select Crop --</option>
              <option value="sugarcane">Sugarcane</option>
            </select>
          </div>

          {/* District Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
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
          {getSelectedDistrict('left') && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
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
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
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
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={getVillages('left').length === 0}
              >
                <option value="">-- Select Village --</option>
                {getVillages('left').map((village, index) => (
                  <option key={`left-village-${index}-${village.village || 'empty'}`} value={village.village}>
                    {village.village}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Total Area Card */}
          {getSelectedDistrict('left') && (
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

          {/* Percentage / Area (ha) — grid 2 per row; click loads tile on map */}
          {['growth', 'water', 'soil', 'pest'].includes(getActiveTab('left') || '') && calculateAreaCards('left').length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Percentage / Area (ha)
              </div>
              <div className="grid grid-cols-2 gap-2">
              {calculateAreaCards('left').map((item, idx) => {
                const currentTab = getActiveTab('left');
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
                      if (splitScreenMode) {
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
                  className={`p-3 bg-gray-700 rounded-lg border border-gray-600 flex flex-col items-center text-center gap-1.5 min-w-0 ${(currentTab === 'pest' && (item.tileUrl != null || item.pestKey != null)) || (['growth', 'water', 'soil'].includes(currentTab || '') && item.tileUrl != null) ? 'cursor-pointer hover:bg-gray-600 transition-colors' : ''}`}
                >
                  <div className="flex items-center gap-1.5 justify-center w-full min-w-0">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color || '#f97316' }}
                    />
                    <span className="text-xs text-gray-200 truncate w-full">{item.label}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 mt-1 w-full">
                    <span className="font-semibold text-green-400 text-xs md:text-sm break-words">
                      {item.percentage != null ? `${formatPct(item.percentage)}%` : '0%'}
                    </span>
                    <span className="font-semibold text-green-400 text-xs md:text-sm break-words">
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
                <HiOutlineLogout size={25} />
                {/* <span className="text-[10px]">Logout</span> */}
              </button>
            </div>
      </aside>
      )}

      {/* Home Icon Toggle Button - Only show when sidebar is hidden */}
      {!sidebarVisible && (
        <button
          onClick={() => setSidebarVisible(!sidebarVisible)}
          className="fixed z-[1001] top-4 left-4 p-2 md:p-3 bg-black/60 backdrop-blur-sm rounded-lg border border-gray-700 text-white hover:bg-gray-800 transition-all duration-300 shadow-lg"
          title="Show Sidebar"
        >
          <Home size={18} className="md:w-5 md:h-5" />
        </button>
      )}

      {/* Main Map Area - Shows two maps in split screen mode; scroll at 1440/1024 so map is viewable */}
      <main className={`flex-1 min-h-0 relative bg-gray-950 overflow-y-auto ${splitScreenMode ? 'flex' : 'flex flex-col'}`}>
        {/* Download Button - Single icon with dropdown menu - Outside tabs with transparent background */}
        {!splitScreenMode && ((getActiveTab('left') === 'pest' && (splitScreenMode ? leftShowPestSeries : showPestSeries)) || ((splitScreenMode ? leftShowWeatherDaily : showWeatherDaily) && (splitScreenMode ? leftWeatherDailyData : weatherDailyData))) && (
          <div className="absolute top-12 md:top-4 right-4 md:right-4 z-[1000]">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                className="px-2 md:px-3 py-1.5 md:py-2 rounded-md bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white border border-gray-600/50 hover:border-gray-500 flex items-center justify-center transition-colors"
                title="Download Data"
              >
                <Download size={18} />
              </button>
              
              {/* Dropdown Menu */}
              {showDownloadMenu && (
                <>
                  {/* Backdrop to close menu on outside click */}
                  <div 
                    className="fixed inset-0 z-[999]" 
                    onClick={() => setShowDownloadMenu(false)}
                  />
                  {/* Menu */}
                  <div className="absolute top-full right-0 mt-2 bg-black/80 backdrop-blur-sm rounded-md border border-gray-600/50 shadow-xl overflow-hidden z-[1000]">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDownloadMenu(false);
                        downloadPestGraphPDF();
                      }}
                      className="w-full px-2 md:px-3 py-1.5 md:py-2 text-white hover:bg-red-500/30 hover:text-red-300 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FileText size={18} />
                      <span className="text-xs md:text-sm">PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDownloadMenu(false);
                        downloadPestGraphExcel();
                      }}
                      className="w-full px-2 md:px-3 py-1.5 md:py-2 text-white hover:bg-green-500/30 hover:text-green-300 flex items-center justify-center gap-1.5 transition-colors border-t border-gray-600/50"
                    >
                      <FileSpreadsheet size={18} />
                      <span className="text-xs md:text-sm">Excel</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Top Navigation Tabs and Legend - Centered (only show when NOT in split screen mode) */}
        {!splitScreenMode && (
        <div className="absolute top-12 md:top-4 left-1/2 transform -translate-x-1/2 z-[1000] flex flex-col items-center gap-2 md:gap-4 w-auto px-2 md:px-0">
          {/* Active Tab Buttons - icons only */}
          <div className="flex gap-1 md:gap-2 bg-black/60 backdrop-blur-sm rounded-lg border border-gray-700 p-1 overflow-x-auto w-auto">
            <button
              onClick={() => setActiveTabForSide('growth', 'left')}
              onDoubleClick={() => { if (getActiveTab('left') === 'growth') setActiveTabForSide(null, 'left'); }}
              className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center ${
                getActiveTab('left') === 'growth' ? 'bg-emerald-500 text-black' : 'text-gray-300 hover:bg-gray-700'
              }`}
              title="Growth (double-click when active to close)"
            >
              <Sprout size={18} />
            </button>
            <button
              onClick={() => setActiveTabForSide('water', 'left')}
              onDoubleClick={() => { if (getActiveTab('left') === 'water') setActiveTabForSide(null, 'left'); }}
              className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center ${
                getActiveTab('left') === 'water' ? 'bg-sky-500 text-black' : 'text-gray-300 hover:bg-gray-700'
              }`}
              title="Water Uptake (double-click when active to close)"
            >
              <Droplets size={18} />
            </button>
            <button
              onClick={() => setActiveTabForSide('soil', 'left')}
              onDoubleClick={() => { if (getActiveTab('left') === 'soil') setActiveTabForSide(null, 'left'); }}
              className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center ${
                getActiveTab('left') === 'soil' ? 'bg-teal-500 text-black' : 'text-gray-300 hover:bg-gray-700'
              }`}
              title="Soil Moisture (double-click when active to close)"
            >
              <Droplet size={18} />
            </button>
            <button
              onClick={() => setActiveTabForSide('pest', 'left')}
              onDoubleClick={() => { if (getActiveTab('left') === 'pest') setActiveTabForSide(null, 'left'); }}
              className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center ${
                getActiveTab('left') === 'pest' ? 'bg-rose-500 text-black' : 'text-gray-300 hover:bg-gray-700'
              }`}
              title="Pest (double-click when active to close)"
            >
              <Bug size={18} />
            </button>
            <button
              onClick={() => setActiveTabForSide('waterSource', 'left')}
              onDoubleClick={() => { if (getActiveTab('left') === 'waterSource') setActiveTabForSide(null, 'left'); }}
              className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center ${
                getActiveTab('left') === 'waterSource' ? 'bg-blue-500 text-black' : 'text-gray-300 hover:bg-gray-700'
              }`}
              title="Water Source (double-click when active to close)"
            >
              <Waves size={18} />
            </button>
            <button
              onClick={() => setActiveTabForSide('forest', 'left')}
              onDoubleClick={() => { if (getActiveTab('left') === 'forest') setActiveTabForSide(null, 'left'); }}
              className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center ${
                getActiveTab('left') === 'forest' ? 'bg-lime-500 text-black' : 'text-gray-300 hover:bg-gray-700'
              }`}
              title="Forest (double-click when active to close)"
            >
              <Trees size={18} />
            </button>

            {/* Land Surface Temperature Card - Inline; double-click when active to close (same as Pest/Water etc) */}
            <div 
              onClick={async () => {
                if (Date.now() - lastMethaneDoubleClickRef.current < LST_METHANE_DBLCLICK_MS) return;
                if (lstLoading || loading || !selectedDistrict) return;
                // Only one of Land Surface or Methane at a time: turn off Methane when opening Land Surface
                setMethaneTileUrl(null);
                setMethaneEnabled(false);
                setAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['methane']; return n; });
                if (splitScreenMode) setRightAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['methane']; return n; });
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
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!lstTileUrl) return;
                lstClosedByUserRef.current = true;
                lastLstDoubleClickRef.current = Date.now();
                setLstTileUrl(null);
                setAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['land-surface-temperature']; return n; });
                if (splitScreenMode) setRightAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['land-surface-temperature']; return n; });
              }}
              role="button"
              tabIndex={0}
              className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md border-2 transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 ${
                selectedDistrict && !lstLoading && !loading
                  ? 'cursor-pointer hover:border-green-500 hover:bg-gray-600' 
                  : 'cursor-not-allowed opacity-50'
              } ${
                lstTileUrl 
                  ? 'bg-green-600/20 border-green-500' 
                  : 'bg-gray-700 border-gray-600'
              }`}
              title="Land Surface Temperature (double-click when active to close)"
            >
              <span className="text-lg">🌡️</span>
            </div>

            {/* Methane Concentration Card - Inline; double-click when active to close (same as Pest/Water etc) */}
            <div 
              onClick={async () => {
                if (Date.now() - lastLstDoubleClickRef.current < LST_METHANE_DBLCLICK_MS) return;
                if (methaneLoading || loading || !selectedDistrict) return;
                // Only one of Land Surface or Methane at a time: turn off Land Surface when opening Methane
                setLstTileUrl(null);
                setAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['land-surface-temperature']; return n; });
                if (splitScreenMode) setRightAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['land-surface-temperature']; return n; });
                methaneClosedByUserRef.current = false;
                try {
                  setMethaneLoading(true);
                  setError(null);
                  
                  const response = await fetchMethane(
                    selectedDistrict,
                    selectedSubdistrict || undefined
                  );
                  
                  if (methaneClosedByUserRef.current) { setMethaneLoading(false); return; }
                  if (response.tile_url) {
                    setMethaneTileUrl(response.tile_url);
                    setAllPlotsTileUrls(prev => ({ ...prev, 'methane': response.tile_url }));
                    setShowTileLayers(true);
                    setMethaneEnabled(true);
                  } else {
                    throw new Error('No tile_url in response');
                  }
                } catch (err) {
                  if (methaneClosedByUserRef.current) { setMethaneLoading(false); return; }
                  const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
                  setError(`Failed to load Methane Concentration: ${errorMessage}`);
                  setMethaneTileUrl(null);
                  setMethaneEnabled(true);
                } finally {
                  setMethaneLoading(false);
                }
              }}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!methaneTileUrl) return;
                methaneClosedByUserRef.current = true;
                lastMethaneDoubleClickRef.current = Date.now();
                setMethaneTileUrl(null);
                setMethaneEnabled(false);
                setAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['methane']; return n; });
                if (splitScreenMode) setRightAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['methane']; return n; });
              }}
              role="button"
              tabIndex={0}
              className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md border-2 transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 ${
                methaneEnabled && !methaneLoading && !loading
                  ? 'cursor-pointer hover:border-blue-500 hover:bg-gray-600' 
                  : 'cursor-pointer opacity-50'
              } ${
                methaneTileUrl 
                  ? 'bg-blue-600/20 border-blue-500' 
                  : 'bg-gray-700 border-gray-600'
              }`}
              title="Methane Concentration (double-click when active to close)"
            >
              <span className="text-lg">💨</span>
            </div>

          </div>

          {/* Legend circles only for waterSource and forest; pest uses sidebar cards with click-to-show on map */}
          {getActiveTab('left') && (getActiveTab('left') === 'waterSource' || getActiveTab('left') === 'forest') && (
            <LegendCircles
              type={getActiveTab('left')!}
              data={currentPixelData}
              onForestAgeClassClick={(ageClass, tileUrl, areaHa) => {
                setSelectedForestAgeClass(ageClass);
                setForestTileUrl(tileUrl);
                setForestAreaHa(areaHa);
                if (splitScreenMode) {
                  setLeftAllPlotsTileUrls({ 'forest': tileUrl });
                  setLeftShowTileLayers(true);
                } else {
                  setAllPlotsTileUrls({ 'forest': tileUrl });
                  setShowTileLayers(true);
                }
              }}
            />
          )}
        </div>
        )}

          {/* Map Container - Reduced height when not split so two cards show below; min-height so map is viewable */}
        <div className={`relative min-h-[min(320px,40vh)] ${splitScreenMode ? 'flex-1 w-1/2 border-r border-gray-700' : 'flex-1 max-h-[55vh] min-h-[280px]'}`}>
          {/* Top Navigation Tabs and Legend - Centered within this map container */}
          <div className={`absolute top-12 md:top-4 left-1/2 transform -translate-x-1/2 z-[1000] flex flex-col items-center gap-2 md:gap-4 px-2 md:px-0 ${splitScreenMode ? 'max-w-[calc(50vw-120px)]' : 'w-auto'}`}>
            {/* Active Tab Buttons - icons only */}
            <div className={`flex gap-1 md:gap-2 bg-black/60 backdrop-blur-sm rounded-lg border border-gray-700 p-1 overflow-x-auto ${splitScreenMode ? 'max-w-full' : 'w-auto'}`}>
              <button
                onClick={() => setActiveTabForSide('growth', 'left')}
                onDoubleClick={() => { if (getActiveTab('left') === 'growth') setActiveTabForSide(null, 'left'); }}
                className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 min-w-[36px] ${
                  getActiveTab('left') === 'growth' ? 'bg-emerald-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                }`}
                title="Growth (double-click when active to close)"
              >
                <Sprout size={18} />
              </button>
              <button
                onClick={() => setActiveTabForSide('water', 'left')}
                onDoubleClick={() => { if (getActiveTab('left') === 'water') setActiveTabForSide(null, 'left'); }}
                className={`${splitScreenMode ? 'px-1.5 py-1 min-w-[28px]' : 'px-2 md:px-3 py-1.5 md:py-2 min-w-[36px]'} rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 ${
                  getActiveTab('left') === 'water' ? 'bg-sky-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                }`}
                title="Water Uptake (double-click when active to close)"
              >
                <Droplets size={splitScreenMode ? 16 : 18} />
              </button>
              <button
                onClick={() => setActiveTabForSide('soil', 'left')}
                onDoubleClick={() => { if (getActiveTab('left') === 'soil') setActiveTabForSide(null, 'left'); }}
                className={`${splitScreenMode ? 'px-1.5 py-1 min-w-[28px]' : 'px-2 md:px-3 py-1.5 md:py-2 min-w-[36px]'} rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 ${
                  getActiveTab('left') === 'soil' ? 'bg-teal-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                }`}
                title="Soil Moisture (double-click when active to close)"
              >
                <Droplet size={splitScreenMode ? 16 : 18} />
              </button>
              <button
                onClick={() => setActiveTabForSide('pest', 'left')}
                onDoubleClick={() => { if (getActiveTab('left') === 'pest') setActiveTabForSide(null, 'left'); }}
                className={`${splitScreenMode ? 'px-1.5 py-1 min-w-[28px]' : 'px-2 md:px-3 py-1.5 md:py-2 min-w-[36px]'} rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 ${
                  getActiveTab('left') === 'pest' ? 'bg-rose-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                }`}
                title="Pest (double-click when active to close)"
              >
                <Bug size={splitScreenMode ? 16 : 18} />
              </button>
              <button
                onClick={() => setActiveTabForSide('waterSource', 'left')}
                onDoubleClick={() => { if (getActiveTab('left') === 'waterSource') setActiveTabForSide(null, 'left'); }}
                className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 min-w-[36px] ${
                  getActiveTab('left') === 'waterSource' ? 'bg-blue-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                }`}
                title="Water Source (double-click when active to close)"
              >
                <Waves size={18} />
              </button>
              <button
                onClick={() => setActiveTabForSide('forest', 'left')}
                onDoubleClick={() => { if (getActiveTab('left') === 'forest') setActiveTabForSide(null, 'left'); }}
                className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 min-w-[36px] ${
                  getActiveTab('left') === 'forest' ? 'bg-lime-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                }`}
                title="Forest (double-click when active to close)"
              >
                <Trees size={18} />
              </button>

              {/* Land Surface Temperature Card - Inline; double-click when active to close */}
              <div 
                onClick={async () => {
                  if (Date.now() - lastMethaneDoubleClickRef.current < LST_METHANE_DBLCLICK_MS) return;
                  if (lstLoading || loading || !selectedDistrict) return;
                  setMethaneTileUrl(null);
                  setMethaneEnabled(false);
                  setAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['methane']; return n; });
                  if (splitScreenMode) setRightAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['methane']; return n; });
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
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!lstTileUrl) return;
                  lstClosedByUserRef.current = true;
                  lastLstDoubleClickRef.current = Date.now();
                  setLstTileUrl(null);
                  setAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['land-surface-temperature']; return n; });
                  if (splitScreenMode) setRightAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['land-surface-temperature']; return n; });
                }}
                role="button"
                tabIndex={0}
                className={`${splitScreenMode ? 'px-1.5 py-1' : 'px-2 md:px-3 py-1.5 md:py-2'} rounded-md border-2 transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 ${
                  selectedDistrict && !lstLoading && !loading
                    ? 'cursor-pointer hover:border-green-500 hover:bg-gray-600' 
                    : 'cursor-not-allowed opacity-50'
                } ${
                  lstTileUrl 
                    ? 'bg-green-600/20 border-green-500' 
                    : 'bg-gray-700 border-gray-600'
                }`}
                title="Land Surface Temperature (double-click when active to close)"
              >
                <span className={splitScreenMode ? 'text-base' : 'text-lg'}>🌡️</span>
              </div>

              {/* Methane Concentration Card - Inline; double-click when active to close */}
              <div 
                onClick={async () => {
                  if (Date.now() - lastLstDoubleClickRef.current < LST_METHANE_DBLCLICK_MS) return;
                  if (methaneLoading || loading || !selectedDistrict) return;
                  setLstTileUrl(null);
                  setAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['land-surface-temperature']; return n; });
                  if (splitScreenMode) setRightAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['land-surface-temperature']; return n; });
                  methaneClosedByUserRef.current = false;
                  try {
                    setMethaneLoading(true);
                    setError(null);
                    
                    const response = await fetchMethane(
                      selectedDistrict,
                      selectedSubdistrict || undefined
                    );
                    
                    if (methaneClosedByUserRef.current) return;
                    if (response.tile_url) {
                      setMethaneTileUrl(response.tile_url);
                      setAllPlotsTileUrls(prev => ({ ...prev, 'methane': response.tile_url }));
                      setShowTileLayers(true);
                      setMethaneEnabled(true);
                    } else {
                      throw new Error('No tile_url in response');
                    }
                  } catch (err) {
                    if (methaneClosedByUserRef.current) return;
                    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
                    setError(`Failed to load Methane Concentration: ${errorMessage}`);
                    setMethaneTileUrl(null);
                    setMethaneEnabled(true);
                  } finally {
                    setMethaneLoading(false);
                  }
                }}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!methaneTileUrl) return;
                  methaneClosedByUserRef.current = true;
                  lastMethaneDoubleClickRef.current = Date.now();
                  setMethaneTileUrl(null);
                  setMethaneEnabled(false);
                  setAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['methane']; return n; });
                  if (splitScreenMode) setRightAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['methane']; return n; });
                }}
                role="button"
                tabIndex={0}
                className={`${splitScreenMode ? 'px-1.5 py-1' : 'px-2 md:px-3 py-1.5 md:py-2'} rounded-md border-2 transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 ${
                  methaneEnabled && !methaneLoading && !loading
                    ? 'cursor-pointer hover:border-blue-500 hover:bg-gray-600' 
                    : 'cursor-pointer opacity-50'
                } ${
                  methaneTileUrl 
                    ? 'bg-blue-600/20 border-blue-500' 
                    : 'bg-gray-700 border-gray-600'
                }`}
                title="Methane Concentration (double-click when active to close)"
              >
                <span className="text-base">💨</span>
              </div>
            </div>
          </div>

          {/* Timeseries Tabs - Separate container in splitscreen (80% width) */}
          {splitScreenMode && getActiveTab('left') === 'pest' && (leftPestStoredSeries && leftPestStoredSeries.length > 0) && (
            <div className="absolute top-28 md:top-20 left-1/2 transform -translate-x-1/2 z-[1000] w-[80%] max-w-[calc(50vw-120px)]">
              <div className="bg-black/60 backdrop-blur-sm rounded-lg border border-gray-700 p-1.5">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider">
                    Year / Month Series
                  </div>
                  {leftPestStoredLoading && (
                    <div className="text-[9px] text-gray-400">Loading…</div>
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
                  className={`absolute z-[1000] bg-gray-100 rounded-lg border border-gray-300 shadow-xl ${splitScreenMode ? 'px-3 py-2' : 'px-4 py-3'} ${pestCardPosition ? '' : (splitScreenMode ? 'bottom-4 left-4' : (showWeatherDaily ? 'bottom-4 left-[340px]' : 'bottom-4 right-4'))}`}
                  style={{
                    ...(splitScreenMode ? { width: `${W}px`, maxWidth: 'calc(50vw - 120px)' } : { width: `${pestGraphSize.width}px`, maxWidth: 'calc(100vw - 2rem)' }),
                    ...(pestCardPosition ? { left: pestCardPosition.left, bottom: pestCardPosition.bottom, right: 'auto' } : {})
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`${splitScreenMode ? 'text-xs' : 'text-sm'} font-semibold text-gray-800 uppercase tracking-wider`}>
                      {currentCategory?.replace(/_/g, ' ') || ''} · Time Series
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
                        <BsArrowsMove size={splitScreenMode ? 12 : 14} />
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
                        <IoResize size={splitScreenMode ? 12 : 14} />
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
                    <line x1={P} y1={topPadding} x2={P} y2={H - bottomPadding} stroke="#e5e7eb" strokeWidth={1} />
                    {/* X-axis line */}
                    <line x1={P} y1={H - bottomPadding} x2={W - P} y2={H - bottomPadding} stroke="#e5e7eb" strokeWidth={1} />
                    
                    {/* Y-axis labels – same format as Growth/Water/Soil (e.g. 1.5k for 1500) */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                      const value = paddedMaxValue * ratio;
                      const y = H - bottomPadding - (chartHeight * ratio);
                      return (
                        <g key={`y-label-${ratio}`}>
                          <line x1={P - 5} y1={y} x2={P} y2={y} stroke="#e5e7eb" strokeWidth={1} />
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
          {/* Pest children panel: on map in top-left area (user-marked red zone), shows child breakdown e.g. Leaf Eating Caterpillar */}
          {!splitScreenMode && activeTab === 'pest' && selectedPestCategory && pestHierarchy?.hierarchy[selectedPestCategory]?.children && Object.keys(pestHierarchy.hierarchy[selectedPestCategory].children).length > 0 && (
            <div className="absolute top-4 left-4 z-[1000] w-[320px] max-w-[calc(100vw-4rem)] px-3 py-2 bg-black/70 backdrop-blur-sm rounded-lg border border-gray-600 shadow-xl">
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
                        {child.pct_of_parent.toFixed(1)}% · {child.area_ha.toFixed(2)} ha
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
                          {child.pct_of_parent?.toFixed(1) ?? '0.0'}% · {child.area_ha?.toFixed(2) ?? '0.00'} ha
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}


          {/* Controls - Right Side (floating over map) - Moved down to avoid overlap with download dropdown */}
          <div className="absolute top-36 md:top-32 right-4 z-[1000] flex flex-col gap-2">
            {/* Tile Layer Toggle Button */}
            <button
              onClick={() => {
                const currentState = splitScreenMode ? leftShowTileLayers : showTileLayers;
                console.log('👁️ Toggling tile layers, current state:', currentState);
                if (splitScreenMode) {
                  setLeftShowTileLayers(!leftShowTileLayers);
                } else {
                  setShowTileLayers(!showTileLayers);
                }
              }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center ${
                (splitScreenMode ? leftShowTileLayers : showTileLayers)
                  ? 'bg-blue-600 text-white'
                  : 'bg-black/60 backdrop-blur-sm border border-gray-700 text-gray-300 hover:bg-gray-700'
              }`}
              title={(splitScreenMode ? leftShowTileLayers : showTileLayers) ? 'Hide tile layers' : 'Show tile layers'}
            >
              {(splitScreenMode ? leftShowTileLayers : showTileLayers) ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>

            {/* Daily Weather Icon - only in split screen (left map) */}
            {splitScreenMode && (
            <button
              type="button"
              onClick={() => {
                setLeftShowWeatherDaily(prev => !prev);
              }}
              className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition-colors ${
                leftShowWeatherDaily
                  ? 'bg-sky-500 text-black hover:bg-sky-400'
                  : 'bg-black/60 backdrop-blur-sm border border-gray-700 text-gray-100 hover:bg-gray-700'
              }`}
              title={leftShowWeatherDaily ? 'Hide daily weather' : 'Show daily weather'}
            >
              <span className="text-xl">🌧️</span>
            </button>
            )}

            {/* Download Button - Left Side (Split Screen) */}
            {splitScreenMode && (getActiveTab('left') === 'pest' || (leftShowWeatherDaily && leftWeatherDailyData)) && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-black/60 backdrop-blur-sm border border-gray-700 text-gray-100 hover:bg-gray-700 flex items-center justify-center transition-colors"
                  title="Download Data"
                >
                  <Download size={18} />
                </button>
                
                {/* Dropdown Menu */}
                {showDownloadMenu && (
                  <>
                    {/* Backdrop to close menu on outside click */}
                    <div 
                      className="fixed inset-0 z-[999]" 
                      onClick={() => setShowDownloadMenu(false)}
                    />
                    {/* Menu */}
                    <div className="absolute top-full right-0 mt-2 bg-black/80 backdrop-blur-sm rounded-md border border-gray-600/50 shadow-xl overflow-hidden z-[1000]">
                      <button
                        type="button"
                        onClick={() => {
                          setShowDownloadMenu(false);
                          downloadPestGraphPDF();
                        }}
                        className="w-full px-2 md:px-3 py-1.5 md:py-2 text-white hover:bg-red-500/30 hover:text-red-300 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <FileText size={18} />
                        <span className="text-xs md:text-sm">PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDownloadMenu(false);
                          downloadPestGraphExcel();
                        }}
                        className="w-full px-2 md:px-3 py-1.5 md:py-2 text-white hover:bg-green-500/30 hover:text-green-300 flex items-center justify-center gap-1.5 transition-colors border-t border-gray-600/50"
                      >
                        <FileSpreadsheet size={18} />
                        <span className="text-xs md:text-sm">Excel</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Daily weather line chart (bottom-right) - opened via WiDayRain icon */}
          {splitScreenMode && leftShowWeatherDaily && leftWeatherDailyData?.daily?.length && (
          <div className={`absolute ${getActiveTab('left') === 'pest' && leftShowPestSeries && leftSelectedPestCategory && leftPestStoredSeries && leftPestStoredSeries.length > 0 ? 'bottom-4 left-4' : 'bottom-4 right-4'} z-[1000] w-[280px] max-w-[calc(50vw-2rem)] bg-black/70 backdrop-blur-sm rounded-lg border border-gray-600 shadow-xl p-3`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Daily Weather</div>
                <div className="text-sm text-gray-100">
                  {leftWeatherDailyData?.name || leftSelectedVillage || leftSelectedSubdistrict || leftSelectedDistrict || '—'}
                  {leftWeatherDailyData?.level ? (
                    <span className="text-xs text-gray-400"> · {String(leftWeatherDailyData.level)}</span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {leftWeatherDailyLoading ? (
                  <div className="text-xs text-gray-400">Loading…</div>
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
                        <div className="text-gray-400">temp_max: <span className="text-orange-400">{days[leftWeatherChartHoverDay].temp_max}</span> °C</div>
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

          {!splitScreenMode && showWeatherDaily && (
          <div
            className={`absolute z-[1000] w-[320px] max-w-[calc(100vw-2rem)] bg-black/70 backdrop-blur-sm rounded-lg border border-gray-600 shadow-xl p-3 ${weatherCardPosition ? '' : 'bottom-4 left-4'}`}
            style={weatherCardPosition ? { left: weatherCardPosition.left, bottom: weatherCardPosition.bottom, right: 'auto' } : {}}
          >
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
                  <BsArrowsMove size={14} />
                </button>
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
                        <div className="text-gray-400">temp_max: <span className="text-orange-400">{days[weatherChartHoverDay].temp_max}</span> °C</div>
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
                  console.warn('Plot not found or has no boundary:', id);
                  return;
                }
                
                // Use area_ha from selected plot when available
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
            />
          )}

          {/* Time series year-month tabs: show for Growth, Water, Soil, Pest (same bar style, shared selection) */}
          {/* Pest: year/month list */}
          {!splitScreenMode && getActiveTab('left') === 'pest' && pestStoredSeries && pestStoredSeries.length >= 0 && selectedDistrict && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] max-w-[85vw] md:max-w-[600px] bg-black/70 backdrop-blur-sm rounded-lg border border-gray-600 shadow-xl px-2 py-1.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider">
                  PEST · Year / Month Series
                </div>
                {pestStoredLoading && (
                  <div className="text-[9px] text-gray-400">Loading…</div>
                )}
              </div>
              {pestStoredError ? (
                <div className="text-[9px] text-red-300">{pestStoredError}</div>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { if (timeSeriesScrollRef.current) timeSeriesScrollRef.current.scrollBy({ left: -150, behavior: 'smooth' }); }}
                    className="flex-shrink-0 p-1 rounded bg-gray-800/80 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-white transition-colors"
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
                          setSelectedTimeSeriesYearMonth(item.year_month);
                          setSelectedPestYearMonth(item.year_month);
                        }}
                        className={`px-1.5 py-0.5 rounded-full text-[9px] border flex-shrink-0 whitespace-nowrap ${
                          (selectedTimeSeriesYearMonth ?? selectedPestYearMonth) === item.year_month
                            ? 'bg-emerald-500/80 border-emerald-400 text-black'
                            : 'bg-gray-800/80 border-gray-600 text-gray-200 hover:bg-gray-700'
                        }`}
                      >
                        {item.year_month}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => { if (timeSeriesScrollRef.current) timeSeriesScrollRef.current.scrollBy({ left: 150, behavior: 'smooth' }); }}
                    className="flex-shrink-0 p-1 rounded bg-gray-800/80 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-white transition-colors"
                    title="Scroll right"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Growth: Current + year/month list (show for district-only or district+subdistrict) */}
          {!splitScreenMode && getActiveTab('left') === 'growth' && selectedDistrict && (growthStoredSeries && growthStoredSeries.length > 0) && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] max-w-[85vw] md:max-w-[600px] bg-black/70 backdrop-blur-sm rounded-lg border border-gray-600 shadow-xl px-2 py-1.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider">
                  GROWTH - YEAR / MONTH SERIES
                </div>
                {growthStoredLoading && (
                  <span className="text-[9px] text-amber-400">Loading year_month…</span>
                )}
                {!growthStoredLoading && growthStoredError && (
                  <span className="text-[9px] text-red-400" title={growthStoredError}>Error</span>
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
                  className="flex-shrink-0 p-1 rounded bg-gray-800/80 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-white transition-colors"
                  title="Scroll left to older dates"
                >
                  <ChevronLeft size={14} />
                </button>
                <div
                  ref={timeSeriesScrollRef}
                  className="flex gap-1 overflow-x-auto scrollbar-hide flex-1 min-w-0"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {/* Stored year_month – display only year-month */}
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
                      className={`px-1.5 py-0.5 rounded-full text-[9px] border flex-shrink-0 whitespace-nowrap ${
                        selectedTimeSeriesYearMonth === item.year_month
                          ? 'bg-emerald-500/80 border-emerald-400 text-black'
                          : 'bg-gray-800/80 border-gray-600 text-gray-200 hover:bg-gray-700'
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
                  className="flex-shrink-0 p-1 rounded bg-gray-800/80 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-white transition-colors"
                  title="Scroll right to older dates"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setGrowthChartViewMode('all')}
                  className={`flex-shrink-0 px-2 py-1 rounded text-[9px] font-medium border ${growthChartViewMode === 'all' ? 'bg-emerald-500/80 border-emerald-400 text-black' : 'bg-gray-800/80 border-gray-600 text-gray-200 hover:bg-gray-700'}`}
                  title="Show all dates on graph"
                >
                  View all
                </button>
              </div>
            </div>
          )}

          {/* Water Uptake: time series bar – year_month from analyze_wateruptakeclasswise */}
          {!splitScreenMode && getActiveTab('left') === 'water' && selectedDistrict && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] max-w-[85vw] md:max-w-[600px] bg-black/70 backdrop-blur-sm rounded-lg border border-gray-600 shadow-xl px-2 py-1.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider">
                  WATER UPTAKE · YEAR / MONTH SERIES
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => { if (timeSeriesScrollRef.current) timeSeriesScrollRef.current.scrollBy({ left: -150, behavior: 'smooth' }); }} className="flex-shrink-0 p-1 rounded bg-gray-800/80 hover:bg-gray-700 border border-gray-600 text-gray-300"><ChevronLeft size={14} /></button>
                <div ref={timeSeriesScrollRef} className="flex gap-1 overflow-x-auto scrollbar-hide flex-1 min-w-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {[...(waterStoredSeries || [])].sort((a, b) => b.year_month.localeCompare(a.year_month)).map((item: GrowthStoredItem, idx: number) => (
                    <button key={`water-${item.year_month}-${idx}`} type="button" onClick={() => { setSelectedTimeSeriesYearMonth(item.year_month); setSelectedWaterYearMonth(item.year_month); }} className={`px-1.5 py-0.5 rounded-full text-[9px] border flex-shrink-0 whitespace-nowrap ${selectedTimeSeriesYearMonth === item.year_month ? 'bg-emerald-500/80 border-emerald-400 text-black' : 'bg-gray-800/80 border-gray-600 text-gray-200 hover:bg-gray-700'}`}>{item.year_month}</button>
                  ))}
                </div>
                <button type="button" onClick={() => { if (timeSeriesScrollRef.current) timeSeriesScrollRef.current.scrollBy({ left: 150, behavior: 'smooth' }); }} className="flex-shrink-0 p-1 rounded bg-gray-800/80 hover:bg-gray-700 border border-gray-600 text-gray-300"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}

          {/* Soil Moisture: time series bar – year_month from analyze_soilmoistureclasswise */}
          {!splitScreenMode && getActiveTab('left') === 'soil' && selectedDistrict && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] max-w-[85vw] md:max-w-[600px] bg-black/70 backdrop-blur-sm rounded-lg border border-gray-600 shadow-xl px-2 py-1.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider">
                  SOIL MOISTURE · YEAR / MONTH SERIES
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => { if (timeSeriesScrollRef.current) timeSeriesScrollRef.current.scrollBy({ left: -150, behavior: 'smooth' }); }} className="flex-shrink-0 p-1 rounded bg-gray-800/80 hover:bg-gray-700 border border-gray-600 text-gray-300"><ChevronLeft size={14} /></button>
                <div ref={timeSeriesScrollRef} className="flex gap-1 overflow-x-auto scrollbar-hide flex-1 min-w-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {[...(soilStoredSeries || [])].sort((a, b) => b.year_month.localeCompare(a.year_month)).map((item: GrowthStoredItem, idx: number) => (
                    <button key={`soil-${item.year_month}-${idx}`} type="button" onClick={() => { setSelectedTimeSeriesYearMonth(item.year_month); setSelectedSoilYearMonth(item.year_month); }} className={`px-1.5 py-0.5 rounded-full text-[9px] border flex-shrink-0 whitespace-nowrap ${selectedTimeSeriesYearMonth === item.year_month ? 'bg-emerald-500/80 border-emerald-400 text-black' : 'bg-gray-800/80 border-gray-600 text-gray-200 hover:bg-gray-700'}`}>{item.year_month}</button>
                  ))}
                </div>
                <button type="button" onClick={() => { if (timeSeriesScrollRef.current) timeSeriesScrollRef.current.scrollBy({ left: 150, behavior: 'smooth' }); }} className="flex-shrink-0 p-1 rounded bg-gray-800/80 hover:bg-gray-700 border border-gray-600 text-gray-300"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}

        </div>

        {/* Two cards below map (non–split): Health Trends + Daily Weather */}
        {!splitScreenMode && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 md:p-4 bg-gray-950 border-t border-gray-800 flex-shrink-0 min-h-0">
            {/* Health Trends card – header shows selected tab name (e.g. Growth, Water, Pest) */}
            <div className="bg-gray-800/80 rounded-lg border border-gray-700 overflow-hidden flex flex-col min-h-[320px]">
              <div className="px-4 py-2 border-b border-gray-700 bg-gray-800/90">
                <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  {getActiveTabDisplayName('left')}
                </h3>
              </div>
              <div className="flex-1 p-4 min-h-0 flex flex-col">
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
                    // Increase base width so each bar group is wider
                    const W = 800;
                    const chartW = W - paddingLeft - paddingRight;
                    const chartH = H - paddingTop - paddingBottom;
                    const showAllDates = growthChartViewMode === 'all';

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
                          <div className="text-[10px] text-gray-400 mb-1 flex-shrink-0">Area (ha) by growth class · all dates</div>
                          <div className="flex-1 min-h-0 w-full overflow-x-auto">
                            <svg width={Math.max(chartW + paddingLeft + paddingRight, 400)} height={H} className="w-full min-w-full" viewBox={`0 0 ${Math.max(W, paddingLeft + chartW + paddingRight)} ${H}`} preserveAspectRatio="xMidYMid meet">
                              <defs><clipPath id="growth-chart-clip-all"><rect x={paddingLeft} y={paddingTop} width={chartW} height={chartH} /></clipPath></defs>
                              <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={H - paddingBottom} stroke="#4b5563" strokeWidth={1} />
                              {yTicks.map(({ ratio, value }) => {
                              const y = paddingTop + chartH - ratio * chartH;
                              return (
                              <g key={ratio}>
                                <line x1={paddingLeft} y1={y} x2={paddingLeft - 4} y2={y} stroke="#6b7280" strokeWidth={1} />
                                <text
                                  x={paddingLeft - 6}
                                  y={y + 4}
                                  textAnchor="end"
                                  className="fill-gray-200"
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
                                  className="fill-gray-200"
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
                        <div className="text-[10px] text-gray-400 mb-1 flex-shrink-0">Area (ha) by growth class · {selectedLabel}</div>
                        <div className="flex-1 min-h-0 w-full">
                          <svg width="100%" height={H} className="w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                            <defs><clipPath id="growth-chart-clip"><rect x={paddingLeft} y={paddingTop} width={chartW} height={chartH} /></clipPath></defs>
                            <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={H - paddingBottom} stroke="#4b5563" strokeWidth={1} />
                            {yTicks.map(({ ratio, value }) => {
                              const y = paddingTop + chartH - ratio * chartH;
                              return (
                                <g key={ratio}>
                                  <line x1={paddingLeft} y1={y} x2={paddingLeft - 4} y2={y} stroke="#6b7280" strokeWidth={1} />
                                  <text
                                    x={paddingLeft - 6}
                                    y={y + 4}
                                    textAnchor="end"
                                    className="fill-gray-200"
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
                              className="fill-gray-200"
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
                    const W = 400;
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
                    return (
                      <div className="w-full min-h-0 flex flex-col flex-1 overflow-x-auto">
                        <div className="text-[10px] text-gray-400 mb-1 flex-shrink-0">Area (ha) · {currentCategory.replace(/_/g, ' ')} time series</div>
                        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block flex-shrink-0">
                          <line x1={P} y1={topPadding} x2={P} y2={H - bottomPadding} stroke="#4b5563" strokeWidth={1} />
                          <line x1={P} y1={H - bottomPadding} x2={W - P} y2={H - bottomPadding} stroke="#4b5563" strokeWidth={1} />
                          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                            const value = paddedMaxValue * ratio;
                            const y = H - bottomPadding - (chartHeight * ratio);
                            return (
                              <g key={`y-${ratio}`}>
                                <line x1={P - 5} y1={y} x2={P} y2={y} stroke="#6b7280" strokeWidth={1} />
                                <text x={P - 8} y={y + 3} textAnchor="end" className="fill-gray-400 text-[9px]" fontSize={9}>
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
                    return (
                      <div className="w-full min-h-0 flex flex-col flex-1">
                        <div className="text-[10px] text-gray-400 mb-1 flex-shrink-0">Area (ha) by water uptake class · {selectedLabel}</div>
                        <div className="flex-1 min-h-0 w-full">
                          <svg width="100%" height={H} className="w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                            <defs><clipPath id="water-chart-clip"><rect x={paddingLeft} y={paddingTop} width={chartW} height={chartH} /></clipPath></defs>
                            <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={H - paddingBottom} stroke="#4b5563" strokeWidth={1} />
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                              const value = paddedMax * ratio;
                              const y = paddingTop + chartH - ratio * chartH;
                              return (
                                <g key={ratio}>
                                  <line x1={paddingLeft} y1={y} x2={paddingLeft - 4} y2={y} stroke="#6b7280" strokeWidth={1} />
                                  <text x={paddingLeft - 6} y={y + 4} textAnchor="end" className="fill-gray-200" fontSize={10}>{value.toFixed(0)}</text>
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
                              <text key={`l-${cn}`} x={paddingLeft + ci * (barWidth + barGap) + barWidth / 2} y={H - 8} textAnchor="middle" className="fill-gray-400" fontSize={9}>{cn}</text>
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
            {/* Daily Weather card – header shows selected district, subdistrict or village name */}
            <div className="bg-gray-800/80 rounded-lg border border-gray-700 overflow-hidden flex flex-col min-h-[320px]">
              <div className="px-4 py-2 border-b border-gray-700 bg-gray-800/90">
                <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Daily Weather {getWeatherCardLocationName('left') !== '—' ? `· ${getWeatherCardLocationName('left')}` : ''}
                </h3>
              </div>
              <div className="flex-1 p-4 min-h-0">
                {getWeatherCardLocationName('left') === '—' ? (
                  <div className="h-full flex items-center justify-center text-gray-500 text-sm text-center">
                    Select district, subdistrict or village to load daily weather graph here.
                  </div>
                ) : weatherDailyLoading ? (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                    Loading daily weather…
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
                            <div className="text-gray-400">temp_max: <span className="text-orange-400">{days[weatherChartHoverDay].temp_max}</span> °C</div>
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
                            <span>Temp max (°C)</span>
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
            </div>
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
                  onClick={() => setActiveTabForSide('growth', 'right')}
                  onDoubleClick={() => { if (getActiveTab('right') === 'growth') setActiveTabForSide(null, 'right'); }}
                  className={`px-1.5 py-1 min-w-[28px] rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 ${
                    getActiveTab('right') === 'growth' ? 'bg-emerald-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                  }`}
                  title="Growth (double-click when active to close)"
                >
                  <Sprout size={16} />
                </button>
                <button
                  onClick={() => setActiveTabForSide('water', 'right')}
                  onDoubleClick={() => { if (getActiveTab('right') === 'water') setActiveTabForSide(null, 'right'); }}
                  className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 min-w-[36px] ${
                    getActiveTab('right') === 'water' ? 'bg-sky-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                  }`}
                  title="Water Uptake (double-click when active to close)"
                >
                  <Droplets size={18} />
                </button>
                <button
                  onClick={() => setActiveTabForSide('soil', 'right')}
                  onDoubleClick={() => { if (getActiveTab('right') === 'soil') setActiveTabForSide(null, 'right'); }}
                  className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 min-w-[36px] ${
                    getActiveTab('right') === 'soil' ? 'bg-teal-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                  }`}
                  title="Soil Moisture (double-click when active to close)"
                >
                  <Droplet size={18} />
                </button>
                <button
                  onClick={() => setActiveTabForSide('pest', 'right')}
                  onDoubleClick={() => { if (getActiveTab('right') === 'pest') setActiveTabForSide(null, 'right'); }}
                  className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 min-w-[36px] ${
                    getActiveTab('right') === 'pest' ? 'bg-rose-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                  }`}
                  title="Pest (double-click when active to close)"
                >
                  <Bug size={18} />
                </button>
                <button
                  onClick={() => setActiveTabForSide('waterSource', 'right')}
                  onDoubleClick={() => { if (getActiveTab('right') === 'waterSource') setActiveTabForSide(null, 'right'); }}
                  className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 min-w-[36px] ${
                    getActiveTab('right') === 'waterSource' ? 'bg-blue-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                  }`}
                  title="Water Source (double-click when active to close)"
                >
                  <Waves size={18} />
                </button>
                <button
                  onClick={() => setActiveTabForSide('forest', 'right')}
                  onDoubleClick={() => { if (getActiveTab('right') === 'forest') setActiveTabForSide(null, 'right'); }}
                  className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md transition-colors whitespace-nowrap flex items-center justify-center flex-shrink-0 min-w-[36px] ${
                    getActiveTab('right') === 'forest' ? 'bg-lime-500 text-black' : 'text-gray-300 hover:bg-gray-700'
                  }`}
                  title="Forest (double-click when active to close)"
                >
                  <Trees size={18} />
                </button>

                {/* Land Surface Temperature Card - Inline; double-click when active to close */}
                <div 
                  onClick={async () => {
                    if (Date.now() - lastMethaneDoubleClickRef.current < LST_METHANE_DBLCLICK_MS) return;
                    const currentDistrict = splitScreenMode ? rightSelectedDistrict : selectedDistrict;
                    if (lstLoading || loading || !currentDistrict) return;
                    setMethaneTileUrl(null);
                    setMethaneEnabled(false);
                    setAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['methane']; return n; });
                    if (splitScreenMode) setRightAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['methane']; return n; });
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
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!lstTileUrl) return;
                    lstClosedByUserRef.current = true;
                    lastLstDoubleClickRef.current = Date.now();
                    setLstTileUrl(null);
                    setAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['land-surface-temperature']; return n; });
                    if (splitScreenMode) setRightAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['land-surface-temperature']; return n; });
                  }}
                  role="button"
                  tabIndex={0}
                  className={`px-1.5 py-1 rounded-md border-2 transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 ${
                    (splitScreenMode ? rightSelectedDistrict : selectedDistrict) && !lstLoading && !loading
                      ? 'cursor-pointer hover:border-green-500 hover:bg-gray-600' 
                      : 'cursor-not-allowed opacity-50'
                  } ${
                    lstTileUrl 
                      ? 'bg-green-600/20 border-green-500' 
                      : 'bg-gray-700 border-gray-600'
                  }`}
                  title="Land Surface Temperature (double-click when active to close)"
                >
                  <span className="text-base">🌡️</span>
                </div>

                {/* Methane Concentration Card - Inline; double-click when active to close */}
                <div 
                  onClick={async () => {
                    if (Date.now() - lastLstDoubleClickRef.current < LST_METHANE_DBLCLICK_MS) return;
                    const currentDistrict = splitScreenMode ? rightSelectedDistrict : selectedDistrict;
                    const currentSubdistrict = splitScreenMode ? rightSelectedSubdistrict : selectedSubdistrict;
                    if (methaneLoading || loading || !currentDistrict) return;
                    setLstTileUrl(null);
                    setAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['land-surface-temperature']; return n; });
                    if (splitScreenMode) setRightAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['land-surface-temperature']; return n; });
                    methaneClosedByUserRef.current = false;
                    try {
                      setMethaneLoading(true);
                      setError(null);
                      
                      const response = await fetchMethane(
                        currentDistrict,
                        currentSubdistrict || undefined
                      );
                      
                      if (methaneClosedByUserRef.current) return;
                      if (response.tile_url) {
                        setMethaneTileUrl(response.tile_url);
                        if (splitScreenMode) {
                          setRightAllPlotsTileUrls(prev => ({ ...prev, 'methane': response.tile_url }));
                          setRightShowTileLayers(true);
                        } else {
                          setAllPlotsTileUrls(prev => ({ ...prev, 'methane': response.tile_url }));
                          setShowTileLayers(true);
                        }
                        setMethaneEnabled(true);
                      } else {
                        throw new Error('No tile_url in response');
                      }
                    } catch (err) {
                      if (methaneClosedByUserRef.current) return;
                      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
                      setError(`Failed to load Methane Concentration: ${errorMessage}`);
                      setMethaneTileUrl(null);
                      setMethaneEnabled(true);
                    } finally {
                      setMethaneLoading(false);
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!methaneTileUrl) return;
                    methaneClosedByUserRef.current = true;
                    lastMethaneDoubleClickRef.current = Date.now();
                    setMethaneTileUrl(null);
                    setMethaneEnabled(false);
                    setAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['methane']; return n; });
                    if (splitScreenMode) setRightAllPlotsTileUrls(prev => { const n = { ...prev }; delete n['methane']; return n; });
                  }}
                  role="button"
                  tabIndex={0}
                  className={`px-1.5 py-1 rounded-md border-2 transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 ${
                    methaneEnabled && !methaneLoading && !loading
                      ? 'cursor-pointer hover:border-blue-500 hover:bg-gray-600' 
                      : 'cursor-pointer opacity-50'
                  } ${
                    methaneTileUrl 
                      ? 'bg-blue-600/20 border-blue-500' 
                      : 'bg-gray-700 border-gray-600'
                  }`}
                  title="Methane Concentration (double-click when active to close)"
                >
                  <span className="text-base">💨</span>
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
                      <div className="text-[9px] text-gray-400">Loading…</div>
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

            {/* Controls - Right Side */}
            <div className="absolute top-36 md:top-32 right-4 z-[1000] flex flex-col gap-2">
              <button
                onClick={() => setRightShowTileLayers(!rightShowTileLayers)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center ${
                  rightShowTileLayers
                    ? 'bg-blue-600 text-white'
                    : 'bg-black/60 backdrop-blur-sm border border-gray-700 text-gray-300 hover:bg-gray-700'
                }`}
                title={rightShowTileLayers ? 'Hide tile layers' : 'Show tile layers'}
              >
                {rightShowTileLayers ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>

              <button
                type="button"
                onClick={() => setRightShowWeatherDaily(prev => !prev)}
                className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition-colors ${
                  rightShowWeatherDaily
                    ? 'bg-sky-500 text-black hover:bg-sky-400'
                    : 'bg-black/60 backdrop-blur-sm border border-gray-700 text-gray-100 hover:bg-gray-700'
                }`}
                title={rightShowWeatherDaily ? 'Hide daily weather' : 'Show daily weather'}
              >
                <span className="text-xl">🌧️</span>
              </button>

              {/* Download Button - Right Side (Split Screen) */}
              {(getActiveTab('right') === 'pest' || (rightShowWeatherDaily && rightWeatherDailyData)) && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                    className="px-3 py-2 rounded-lg text-sm font-medium bg-black/60 backdrop-blur-sm border border-gray-700 text-gray-100 hover:bg-gray-700 flex items-center justify-center transition-colors"
                    title="Download Data"
                  >
                    <Download size={18} />
                  </button>
                  
                  {showDownloadMenu && (
                    <>
                      <div 
                        className="fixed inset-0 z-[999]" 
                        onClick={() => setShowDownloadMenu(false)}
                      />
                      <div className="absolute top-full right-0 mt-2 bg-black/80 backdrop-blur-sm rounded-md border border-gray-600/50 shadow-xl overflow-hidden z-[1000]">
                        <button
                          type="button"
                          onClick={() => {
                            setShowDownloadMenu(false);
                            downloadPestGraphPDF();
                          }}
                          className="w-full px-2 md:px-3 py-1.5 md:py-2 text-white hover:bg-red-500/30 hover:text-red-300 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <FileText size={18} />
                          <span className="text-xs md:text-sm">PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowDownloadMenu(false);
                            downloadPestGraphExcel();
                          }}
                          className="w-full px-2 md:px-3 py-1.5 md:py-2 text-white hover:bg-green-500/30 hover:text-green-300 flex items-center justify-center gap-1.5 transition-colors border-t border-gray-600/50"
                        >
                          <FileSpreadsheet size={18} />
                          <span className="text-xs md:text-sm">Excel</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

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
                        {rightSelectedPestCategory?.replace(/_/g, ' ') || ''} · Time Series
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
                          <IoResize size={12} />
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
                      <line x1={P} y1={topPadding} x2={P} y2={H - bottomPadding} stroke="#e5e7eb" strokeWidth={1} />
                      {/* X-axis line */}
                      <line x1={P} y1={H - bottomPadding} x2={W - P} y2={H - bottomPadding} stroke="#e5e7eb" strokeWidth={1} />
                      
                      {/* Y-axis labels – same format as Growth/Water/Soil (e.g. 1.5k for 1500) */}
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                        const value = paddedMaxValue * ratio;
                        const y = H - bottomPadding - (chartHeight * ratio);
                        return (
                          <g key={`y-label-right-${ratio}`}>
                            <line x1={P - 5} y1={y} x2={P} y2={y} stroke="#e5e7eb" strokeWidth={1} />
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
                            {child.pct_of_parent?.toFixed(1) ?? '0.0'}% · {child.area_ha?.toFixed(2) ?? '0.00'} ha
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Weather Chart - Right Side */}
            {rightShowWeatherDaily && rightWeatherDailyData?.daily?.length && (
              <div className="absolute bottom-4 left-4 z-[1000] w-[280px] max-w-[calc(50vw-2rem)] bg-black/70 backdrop-blur-sm rounded-lg border border-gray-600 shadow-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Daily Weather</div>
                    <div className="text-sm text-gray-100">
                      {rightWeatherDailyData?.name || rightSelectedVillage || rightSelectedSubdistrict || rightSelectedDistrict || '—'}
                      {rightWeatherDailyData?.level ? (
                        <span className="text-xs text-gray-400"> · {String(rightWeatherDailyData.level)}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {rightWeatherDailyLoading ? (
                      <div className="text-xs text-gray-400">Loading…</div>
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
                            <div className="text-gray-400">temp_max: <span className="text-orange-400">{days[rightWeatherChartHoverDay].temp_max}</span> °C</div>
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
                    console.warn('Plot not found or has no boundary:', id);
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
              />
            )}
          </div>
        )}
      </main>

      {/* Right Sidebar - Enabled for split screen mode */}
      {sidebarVisible && splitScreenMode && (
        <aside 
          className="w-full md:w-48 flex-shrink-0 border-l border-gray-700 flex flex-col z-10 shadow-xl relative overflow-hidden"
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
            {/* Header section removed - no title or logout icon for right sidebar */}

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Crops Dropdown - before District, independent */}
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

              {/* Percentage / Area (ha) — grid 2 per row; click loads tile on map */}
              {['growth', 'water', 'soil', 'pest'].includes(getActiveTab('right') || '') && calculateAreaCards('right').length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Percentage / Area (ha)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {calculateAreaCards('right').map((item, idx) => {
                      const currentTab = getActiveTab('right');
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
                              setRightAllPlotsTileUrls({ [currentTab!]: item.tileUrl! });
                              setRightShowTileLayers(true);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              if ((currentTab === 'pest' && (item.tileUrl != null || item.pestKey != null)) || (['growth', 'water', 'soil'].includes(currentTab || '') && item.tileUrl != null))
                                e.currentTarget.click();
                            }
                          }}
                          className={`p-3 bg-gray-700 rounded-lg border border-gray-600 flex flex-col items-center text-center gap-1.5 min-w-0 ${(currentTab === 'pest' && (item.tileUrl != null || item.pestKey != null)) || (['growth', 'water', 'soil'].includes(currentTab || '') && item.tileUrl != null) ? 'cursor-pointer hover:bg-gray-600 transition-colors' : ''}`}
                        >
                          <div className="flex items-center gap-1.5 justify-center w-full min-w-0">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: item.color || '#f97316' }}
                            />
                            <span className="text-xs text-gray-200 truncate w-full">{item.label}</span>
                          </div>
                          <div className="flex flex-col gap-0.5 mt-1 w-full">
                            <span className="font-semibold text-green-400 text-xs md:text-sm break-words">
                              {item.percentage != null ? `${formatPct(item.percentage)}%` : '0%'}
                            </span>
                            <span className="font-semibold text-green-400 text-xs md:text-sm break-words">
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
