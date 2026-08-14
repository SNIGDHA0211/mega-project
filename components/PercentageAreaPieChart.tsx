import React, { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

export interface AreaCardItem {
  label: string;
  value: number;
  percentage?: number;
  color?: string;
  tileUrl?: string | null;
  pestKey?: string;
}

interface PercentageAreaPieChartProps {
  items: AreaCardItem[];
  selectedLabel?: string | null;
  onItemClick?: (item: AreaCardItem, index: number) => void;
  isItemClickable?: (item: AreaCardItem) => boolean;
  formatPct?: (p: number) => string;
  compact?: boolean;
}

const defaultFormatPct = (p: number) =>
  p > 0 && p < 1 ? p.toFixed(2) : String(Math.round(p));

const formatAreaHa = (v: number, includeUnit = true) =>
  includeUnit ? `${v.toFixed(2)} ha` : v.toFixed(2);

type SliceLabelProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
  payload?: AreaCardItem & { pct: number };
};

const RADIAN = Math.PI / 180;

const PercentageAreaPieChart: React.FC<PercentageAreaPieChartProps> = ({
  items,
  selectedLabel,
  onItemClick,
  isItemClickable,
  formatPct = defaultFormatPct,
  compact = false,
}) => {
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);

  const chartData = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        pct: Math.max(Number(item.percentage ?? 0), 0),
      })),
    [items]
  );

  const focusLabel = hoverLabel ?? selectedLabel ?? chartData[0]?.label ?? null;
  const focusItem = chartData.find((d) => d.label === focusLabel) ?? chartData[0];

  if (chartData.length === 0) return null;

  const renderSliceLabels = (props: SliceLabelProps) => {
    const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, payload } = props;
    if (!payload) return null;

    const cos = Math.cos(-midAngle * RADIAN);
    const sin = Math.sin(-midAngle * RADIAN);

    // Outer: area (ha)
    const outerR = outerRadius + (compact ? 20 : 26);
    const ox = cx + outerR * cos;
    const oy = cy + outerR * sin;

    // Inner (on ring): percentage
    const innerR = innerRadius + (outerRadius - innerRadius) * 0.55;
    const ix = cx + innerR * cos;
    const iy = cy + innerR * sin;

    return (
      <g style={{ pointerEvents: 'none' }}>
        {payload.pct >= 1.2 ? (
          <text
            x={ox}
            y={oy}
            fill="#000000"
            textAnchor={ox > cx ? 'start' : 'end'}
            dominantBaseline="central"
            style={{ fontSize: compact ? 12 : 14, fontWeight: 700 }}
          >
            {/* Right-side labels omit "ha" so text is not clipped by the card edge */}
            {formatAreaHa(payload.value, ox <= cx)}
          </text>
        ) : null}
        {payload.pct >= 2 ? (
          <text
            x={ix}
            y={iy}
            fill="#ffffff"
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              fontSize: compact ? 10 : 12,
              fontWeight: 700,
              textShadow: '0 1px 2px rgba(0,0,0,0.55)',
            }}
          >
            {formatPct(payload.pct)}%
          </text>
        ) : null}
      </g>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className={`relative w-full ${compact ? 'h-[250px]' : 'h-[310px]'}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 24, right: 48, bottom: 24, left: 48 }}>
            <Pie
              data={chartData}
              dataKey="pct"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={compact ? '40%' : '44%'}
              outerRadius={compact ? '70%' : '74%'}
              paddingAngle={1.5}
              label={renderSliceLabels}
              labelLine={false}
              onClick={(_, index) => {
                const item = items[index];
                if (item && onItemClick) onItemClick(item, index);
              }}
              onMouseEnter={(_, index) => setHoverLabel(items[index]?.label ?? null)}
              onMouseLeave={() => setHoverLabel(null)}
            >
              {chartData.map((entry) => {
                const clickable = isItemClickable ? isItemClickable(entry) : !!onItemClick;
                const isActive = entry.label === focusLabel;
                return (
                  <Cell
                    key={entry.label}
                    fill={entry.color || '#f97316'}
                    stroke={isActive ? '#ffffff' : 'rgba(0,0,0,0.25)'}
                    strokeWidth={isActive ? 2.5 : 1}
                    opacity={clickable ? 1 : 0.85}
                    style={{ cursor: clickable ? 'pointer' : 'default' }}
                  />
                );
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center hole: selected/hovered percentage */}
        {focusItem ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center text-center leading-tight px-2">
              <span className={`font-semibold text-gray-300 ${compact ? 'text-[10px]' : 'text-xs'}`}>
                {focusItem.label}
              </span>
              <span className={`font-bold text-white ${compact ? 'text-2xl' : 'text-3xl'}`}>
                {formatPct(focusItem.pct)}%
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        {chartData.map((item, idx) => {
          const clickable = isItemClickable ? isItemClickable(item) : !!onItemClick;
          const isActive = item.label === focusLabel;
          return (
            <button
              key={`legend-${item.label}-${idx}`}
              type="button"
              disabled={!clickable}
              onClick={() => onItemClick?.(items[idx], idx)}
              onMouseEnter={() => setHoverLabel(item.label)}
              onMouseLeave={() => setHoverLabel(null)}
              className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] transition-colors ${
                clickable ? 'cursor-pointer hover:bg-white/5' : 'cursor-default opacity-80'
              } ${isActive ? 'bg-white/10 ring-1 ring-white/20' : ''}`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color || '#f97316' }}
              />
              <span className="min-w-0 flex-1 truncate font-medium text-gray-200">{item.label}</span>
              <span className="shrink-0 font-semibold text-gray-100">{formatPct(item.pct)}%</span>
              <span className="shrink-0 text-gray-400">{item.value.toFixed(2)} ha</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PercentageAreaPieChart;
