import React from 'react';

export type AnalysisType = 'growth' | 'water' | 'soil' | 'pest' | 'waterSource' | 'forest';

interface LegendItem {
  label: string;
  value: number;
  color: string;
  ageClass?: string; // For forest age classes
}

interface LegendCirclesProps {
  type: AnalysisType;
  data: any; // Pixel summary data or forest age classes
  onForestAgeClassClick?: (ageClass: string, tileUrl: string, areaHa: number) => void; // For forest age class clicks
}

const LegendCircles: React.FC<LegendCirclesProps> = ({ type, data, onForestAgeClassClick }) => {
  // Always display legend circles, even without data (show 0 values)
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
        { label: 'Adequate', value: data?.adequate_pixel_percentage || 0, color: '#f97316' }, // Orange
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
      items = [
        { label: 'Chewing', value: data?.chewing_pixel_percentage || 0, color: '#f97316' }, // Orange
        { label: 'Fungi', value: data?.fungi_pixel_percentage || 0, color: '#f97316' }, // Orange
        { label: 'Sucking', value: data?.sucking_pixel_percentage || 0, color: '#f97316' }, // Orange
        { label: 'Wilt', value: data?.wilt_pixel_percentage || 0, color: '#f97316' }, // Orange
        { label: 'SoilBorn', value: data?.soilborne_pixel_percentage || data?.soilborn_pixel_percentage || 0, color: '#f97316' }, // Orange
      ];
      break;
    case 'waterSource':
      // For water source, show overall water percentage in blue
      items = [
        { label: 'Water %', value: data?.water_pixel_percentage || 0, color: '#3b82f6' }, // Blue
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
              // Handle forest age class click
              if (type === 'forest' && item.ageClass && data && data[item.ageClass] && onForestAgeClassClick) {
                onForestAgeClassClick(
                  item.ageClass,
                  data[item.ageClass].tile_url,
                  data[item.ageClass].area_hectares
                );
              }
            }}
            className={`w-8 h-8 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-lg ${
              type === 'forest' && item.ageClass ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
            }`}
            style={{ backgroundColor: item.color }}
          >
            {Math.round(item.value)}
          </div>
          <span className="text-[10px] md:text-xs text-gray-300 whitespace-nowrap">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

export default LegendCircles;

