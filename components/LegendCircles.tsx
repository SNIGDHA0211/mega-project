import React from 'react';

export type AnalysisType = 'growth' | 'water' | 'soil' | 'pest' | 'waterSource' | 'forest';

const PEST_COLORS: Record<string, string> = {
  healthy: '#22c55e',
  chewing: '#f97316',
  fungi: '#a855f7',
  sucking: '#ef4444',
  wilt: '#92400e',
  soilborne: '#6b7280',
};

function formatPestLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface LegendItem {
  label: string;
  value: number;
  color: string;
  ageClass?: string;
  pestKey?: string;
  tileUrl?: string | null;
  totalAreaHa?: number;
  children?: Record<string, { tile_url: string; area_ha: number; pct_of_parent: number }>;
}

interface LegendCirclesProps {
  type: AnalysisType;
  data: any;
  onForestAgeClassClick?: (ageClass: string, tileUrl: string, areaHa: number) => void;
  onPestCategoryClick?: (key: string, tileUrl: string | null, totalAreaHa: number, percentage: number, children: Record<string, { tile_url: string; area_ha: number; pct_of_parent: number }>) => void;
}

const LegendCircles: React.FC<LegendCirclesProps> = ({ type, data, onForestAgeClassClick, onPestCategoryClick }) => {
  let items: LegendItem[] = [];

  switch (type) {
    case 'growth':
      items = [
        { label: 'Weak', value: data?.weak_pixel_percentage || 0, color: '#f97316' }, // Orange
        { label: 'Stress', value: data?.stress_pixel_percentage || 0, color: '#f97316' }, // Orange
        { label: 'Moderate', value: data?.moderate_pixel_percentage || 0, color: '#f97316' }, // Orange
        { label: 'Healthy', value: data?.healthy_pixel_percentage || 0, color: '#f97316' }, // Orange
      ];
      break;
    case 'water':
      items = [
        { label: 'Deficient', value: data?.deficient_pixel_percentage || 0, color: '#f97316' }, // Orange
        { label: 'Less', value: data?.less_pixel_percentage || 0, color: '#f97316' }, // Orange
        // API may use 'adequat_pixel_percentage' (missing 'e')
        { label: 'Adequate', value: data?.adequate_pixel_percentage || data?.adequat_pixel_percentage || 0, color: '#f97316' }, // Orange
        { label: 'Excellent', value: data?.excellent_pixel_percentage || 0, color: '#f97316' }, // Orange
        { label: 'Excess', value: data?.excess_pixel_percentage || 0, color: '#f97316' }, // Orange
      ];
      break;
    case 'soil':
      items = [
        { label: 'Less', value: data?.less_pixel_percentage || 0, color: '#f97316' }, // Orange
        { label: 'Adequate', value: data?.adequate_pixel_percentage || 0, color: '#f97316' }, // Orange
        { label: 'Excellent', value: data?.excellent_pixel_percentage || 0, color: '#f97316' }, // Orange
        { label: 'Excess', value: data?.excess_pixel_percentage || 0, color: '#f97316' }, // Orange
        { label: 'Shallow Water', value: data?.shallow_water_pixel_percentage || 0, color: '#f97316' }, // Orange
      ];
      break;
    case 'pest':
      // Hierarchy format: data is { healthy: { tile_url, total_area_ha, percentage, children }, ... }
      if (data && typeof data === 'object' && (data.healthy || data.chewing || data.fungi || data.sucking || data.wilt || data.soilborne)) {
        const order = ['healthy', 'chewing', 'fungi', 'sucking', 'wilt', 'soilborne'];
        items = order
          .filter(k => data[k] != null)
          .map(k => ({
            label: formatPestLabel(k),
            value: data[k].percentage ?? 0,
            color: PEST_COLORS[k] ?? '#f97316',
            pestKey: k,
            tileUrl: data[k].tile_url ?? null,
            totalAreaHa: data[k].total_area_ha ?? 0,
            children: data[k].children ?? {},
          }));
      } else {
        items = [
          { label: 'Chewing', value: data?.chewing_pixel_percentage || 0, color: '#f97316' },
          { label: 'Fungi', value: data?.fungi_pixel_percentage || 0, color: '#f97316' },
          { label: 'Sucking', value: data?.sucking_pixel_percentage || 0, color: '#f97316' },
          { label: 'Wilt', value: data?.wilt_pixel_percentage || 0, color: '#f97316' },
          { label: 'SoilBorn', value: data?.soilborne_pixel_percentage || data?.soilborn_pixel_percentage || 0, color: '#f97316' },
        ];
      }
      break;
    case 'waterSource':
      // For water source, show overall water percentage in blue
      // Check for water_area_percentage first (from area_summary), then fall back to water_pixel_percentage
      const waterPercentage = data?.water_area_percentage ?? data?.water_pixel_percentage ?? 0;
      console.log('🌊 LegendCircles - waterSource data:', data);
      console.log('🌊 LegendCircles - water_area_percentage:', data?.water_area_percentage);
      console.log('🌊 LegendCircles - water_pixel_percentage:', data?.water_pixel_percentage);
      console.log('🌊 LegendCircles - final waterPercentage:', waterPercentage);
      items = [
        { label: 'Water %', value: waterPercentage, color: '#3b82f6' }, // Blue
      ];
      break;
    case 'forest':
      // For forest, show age classes with orange color
      if (data && typeof data === 'object') {
        items = [
          { label: 'Young', value: data.young?.area_hectares || 0, color: '#f97316', ageClass: 'young' }, // Orange
          { label: 'Mid Age', value: data.mid_age?.area_hectares || 0, color: '#f97316', ageClass: 'mid_age' }, // Orange
          { label: 'Mature', value: data.mature?.area_hectares || 0, color: '#f97316', ageClass: 'mature' }, // Orange
          { label: 'Old Age', value: data.old_age?.area_hectares || 0, color: '#f97316', ageClass: 'old_age' }, // Orange
        ];
      }
      break;
  }

  return (
    <div className="flex items-center gap-2 md:gap-4 px-2 md:px-4 py-2 bg-black/60 backdrop-blur-sm rounded-lg border border-gray-700 overflow-x-auto w-auto">
      {items.map((item, index) => (
        <div key={index} className="flex flex-col items-center gap-1 flex-shrink-0">
          <div
            onClick={() => {
              if (type === 'forest' && item.ageClass && data && data[item.ageClass] && onForestAgeClassClick) {
                onForestAgeClassClick(
                  item.ageClass,
                  data[item.ageClass].tile_url,
                  data[item.ageClass].area_hectares
                );
              }
              if (type === 'pest' && item.pestKey != null && item.tileUrl !== undefined && onPestCategoryClick) {
                onPestCategoryClick(
                  item.pestKey,
                  item.tileUrl,
                  item.totalAreaHa ?? 0,
                  item.value,
                  item.children ?? {}
                );
              }
            }}
            className={`w-8 h-8 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-lg ${
              (type === 'forest' && item.ageClass) || (type === 'pest' && item.pestKey != null) ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
            }`}
            style={{ backgroundColor: item.color }}
          >
            {item.value > 0 && item.value < 1
              ? item.value.toFixed(2) // Show 2 decimal places for small percentages (e.g. 0.02)
              : Math.round(item.value) // Round other values
            }
          </div>
          <span className="text-[10px] md:text-xs text-gray-300 whitespace-nowrap">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

export default LegendCircles;

