import React from 'react';
import type { BuildingBuiltupResponse, BuildingClasswiseItem } from '../services/analysisService';

interface BuildingLayerCardProps {
  data: BuildingBuiltupResponse;
  scopeLabel: string;
  selectedClassId: number | 'all' | null;
  onSelectClass: (classId: number | 'all', tileUrl: string) => void;
  textColorOnBackground: (hex: string | undefined) => string;
}

const BuildingLayerCard: React.FC<BuildingLayerCardProps> = ({
  data,
  scopeLabel,
  selectedClassId,
  onSelectClass,
  textColorOnBackground,
}) => {
  const summary = data.building_summary;
  const mainTile = data.features?.[0]?.properties?.tile_url;
  const classwise = (data.classwise ?? []).filter((c) => c.tile_url);

  const renderClassBtn = (item: BuildingClasswiseItem) => {
    const isSelected = selectedClassId === item.class_id;
    const fg = textColorOnBackground(item.color);
    return (
      <button
        key={item.class_id}
        type="button"
        onClick={() => onSelectClass(item.class_id, item.tile_url)}
        className={`rounded px-1.5 py-1 flex flex-col items-center justify-center text-center min-h-[52px] min-w-[88px] transition-all ${
          isSelected ? 'ring-1 ring-white ring-offset-1 ring-offset-gray-900' : 'hover:brightness-110'
        }`}
        style={{ backgroundColor: item.color, color: fg }}
      >
        <span className="text-[9px] font-semibold leading-tight">{item.class_name}</span>
        <span className="font-bold text-[10px] leading-tight mt-0.5">{item.count.toLocaleString()}</span>
        <span className="text-[9px] leading-tight opacity-90">{item.percentage.toFixed(1)}%</span>
      </button>
    );
  };

  return (
    <div className="absolute top-28 md:top-20 right-3 md:right-4 z-[1000] pointer-events-auto w-[min(92vw,320px)]">
      <div className="rounded-lg border border-gray-300 bg-white p-3 text-black shadow-lg">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Build layers</div>
        <div className="text-sm font-bold text-gray-900 mb-2">{scopeLabel}</div>
        {summary ? (
          <div className="mb-3 space-y-1 text-xs text-gray-700">
            <div className="flex justify-between gap-2">
              <span>Total buildings</span>
              <span className="font-semibold">{summary.total_buildings.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Built-up area</span>
              <span className="font-semibold">{summary.builtup_area_hectares.toFixed(2)} ha</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Built-up %</span>
              <span className="font-semibold">{summary.builtup_percentage.toFixed(2)}%</span>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1">
          {mainTile ? (
            <button
              type="button"
              onClick={() => onSelectClass('all', mainTile)}
              className={`rounded px-2 py-1.5 text-[10px] font-semibold border transition-all ${
                selectedClassId === 'all'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                  : 'border-gray-300 bg-gray-50 text-gray-800 hover:bg-gray-100'
              }`}
            >
              All built-up
            </button>
          ) : null}
          {classwise.map(renderClassBtn)}
        </div>
      </div>
    </div>
  );
};

export default BuildingLayerCard;
