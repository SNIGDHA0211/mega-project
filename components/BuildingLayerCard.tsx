import React, { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { BuildingBuiltupResponse, BuildingClasswiseItem } from '../services/analysisService';

interface BuildingLayerCardProps {
  data: BuildingBuiltupResponse;
  scopeLabel: string;
  selectedClassId: number | 'all' | null;
  onSelectClass: (classId: number | 'all', tileUrl: string) => void;
  textColorOnBackground: (hex: string | undefined) => string;
}

type BuildingSlice = BuildingClasswiseItem & { pct: number };

const BuildingLayerCard: React.FC<BuildingLayerCardProps> = ({
  data,
  scopeLabel,
  selectedClassId,
  onSelectClass,
}) => {
  const summary = data.building_summary;
  const mainTile = data.features?.[0]?.properties?.tile_url;
  const classwise = (data.classwise ?? []).filter((c) => c.tile_url);

  const [hoverClassId, setHoverClassId] = useState<number | null>(null);

  const chartData: BuildingSlice[] = useMemo(
    () =>
      classwise.map((item) => ({
        ...item,
        pct: Math.max(Number(item.percentage ?? 0), 0),
      })),
    [classwise]
  );

  const focusClassId =
    hoverClassId ??
    (typeof selectedClassId === 'number' ? selectedClassId : chartData[0]?.class_id ?? null);
  const focusItem = chartData.find((d) => d.class_id === focusClassId) ?? chartData[0];

  return (
    <div className="pointer-events-auto w-full">
      <div className="rounded-lg border border-gray-300 bg-white p-3 text-black shadow-lg w-full min-w-[16rem] max-w-[18rem]">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Build layers</div>
            <div className="text-sm font-bold text-gray-900">{scopeLabel}</div>
          </div>
          {summary ? (
            <div className="shrink-0 space-y-0.5 text-[10px] text-gray-700 text-right leading-snug">
              <div>
                <span className="text-gray-500">Total buildings </span>
                <span className="font-semibold text-gray-900">{summary.total_buildings.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-500">Built-up area </span>
                <span className="font-semibold text-gray-900">{summary.builtup_area_hectares.toFixed(2)} ha</span>
              </div>
              <div>
                <span className="text-gray-500">Built-up % </span>
                <span className="font-semibold text-gray-900">{summary.builtup_percentage.toFixed(2)}%</span>
              </div>
            </div>
          ) : null}
        </div>

        {mainTile ? (
          <div className="mb-2 flex justify-start">
            <button
              type="button"
              onClick={() => onSelectClass('all', mainTile)}
              className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-bold border shadow-sm transition-colors focus:outline-none ${
                selectedClassId === 'all'
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-gray-400 bg-white text-gray-900 hover:bg-gray-50'
              }`}
            >
              All built-up
            </button>
          </div>
        ) : null}

        {chartData.length > 0 ? (
          <>
            <div className="relative h-[200px] w-full outline-none [&_*]:outline-none [&_*:focus]:outline-none">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={chartData}
                    dataKey="pct"
                    nameKey="class_name"
                    cx="50%"
                    cy="50%"
                    innerRadius="42%"
                    outerRadius="72%"
                    paddingAngle={1.5}
                    activeIndex={-1}
                    isAnimationActive={false}
                    onClick={(_, index) => {
                      const item = chartData[index];
                      if (item) onSelectClass(item.class_id, item.tile_url);
                    }}
                    onMouseEnter={(_, index) => {
                      const item = chartData[index];
                      if (item) setHoverClassId(item.class_id);
                    }}
                    onMouseLeave={() => setHoverClassId(null)}
                  >
                    {chartData.map((entry) => {
                      const isActive =
                        typeof selectedClassId === 'number'
                          ? entry.class_id === selectedClassId
                          : entry.class_id === focusClassId;
                      return (
                        <Cell
                          key={entry.class_id}
                          fill={entry.color}
                          stroke="#ffffff"
                          strokeWidth={1}
                          opacity={isActive ? 1 : 0.88}
                          style={{ cursor: 'pointer', outline: 'none' }}
                        />
                      );
                    })}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {focusItem ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center text-center leading-tight px-2">
                    <span className="font-bold text-gray-900 text-lg">{focusItem.count.toLocaleString()}</span>
                    <span className="text-[10px] text-gray-600">{focusItem.pct.toFixed(1)}%</span>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default BuildingLayerCard;
