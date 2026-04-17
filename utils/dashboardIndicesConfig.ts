/**
 * Dashboard indices chart order and labels — matches GET /indices/retrieve-aggregated `series` keys.
 */
export const DASHBOARD_INDEX_ORDER = [
  'ndvi',
  'evi',
  'evi2',
  'gndvi',
  'ndre',
  'ndmi',
  'ndbi',
  'bsi',
  'savi',
  'osavi',
  'rvi_optical',
  'ndwi_mcfeeters',
  'ndwi_gao',
  'lst',
  'temperature',
  'precipitation_daily',
  'precipitation_sum',
] as const;

export type DashboardIndexKey = (typeof DASHBOARD_INDEX_ORDER)[number];

export const DASHBOARD_INDEX_LABELS: Record<DashboardIndexKey, string> = {
  ndvi: 'Crop Health (NDVI)',
  evi: 'Plantation thickness (EVI)',
  evi2: 'Crop Yield Potential (EVI2)',
  gndvi: 'Fertilizer status (GNDVI)',
  ndre: 'Crop Stress (NDRE)',
  ndmi: 'Soil Moisture (NDMI)',
  ndbi: 'Non Farm Area (NDBI)',
  bsi: 'Bare Soil Index (BSI)',
  savi: 'Soil-Adjusted VI (SAVI)',
  osavi: 'Optimized SAVI (OSAVI)',
  rvi_optical: 'RVI (Optical)',
  ndwi_mcfeeters: 'NDWI (McFeeters)',
  ndwi_gao: 'NDWI (Gao)',
  lst: 'Heat Stress (LST)',
  temperature: 'Air temperature (°C)',
  precipitation_daily: 'Precipitation (daily)',
  precipitation_sum: 'Precipitation (sum)',
};

/** Hex stroke/card colors for Recharts */
export const DASHBOARD_INDEX_CARD_COLORS_HEX: Record<DashboardIndexKey, string> = {
  ndvi: '#3b82f6',
  evi: '#22c55e',
  evi2: '#84cc16',
  gndvi: '#06b6d4',
  ndre: '#14b8a6',
  ndmi: '#ec4899',
  ndbi: '#8b5cf6',
  bsi: '#f59e0b',
  savi: '#059669',
  osavi: '#10b981',
  rvi_optical: '#6366f1',
  ndwi_mcfeeters: '#0ea5e9',
  ndwi_gao: '#0284c7',
  lst: '#ef4444',
  temperature: '#f97316',
  precipitation_daily: '#38bdf8',
  precipitation_sum: '#0c4a6e',
};

/** RGB for jsPDF charts */
export const DASHBOARD_INDEX_CARD_COLORS_RGB: Record<string, [number, number, number]> = {
  ndvi: [59, 130, 246],
  evi: [34, 197, 94],
  evi2: [132, 204, 22],
  gndvi: [6, 182, 212],
  ndre: [20, 184, 166],
  ndmi: [236, 72, 153],
  ndbi: [139, 92, 246],
  bsi: [245, 158, 11],
  savi: [5, 150, 105],
  osavi: [16, 185, 129],
  rvi_optical: [99, 102, 241],
  ndwi_mcfeeters: [14, 165, 233],
  ndwi_gao: [2, 132, 199],
  lst: [239, 68, 68],
  temperature: [249, 115, 22],
  precipitation_daily: [56, 189, 248],
  precipitation_sum: [12, 74, 110],
};
