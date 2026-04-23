import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react';

/** Default legend swatches: sugarcane = blue, wheat = red (when API does not pass colors) */
const SUGARCANE_SWATCH = '#2563eb';
const WHEAT_SWATCH = '#dc2626';

function formatAreaHa(ha: number | null | undefined): string {
  if (ha == null || Number.isNaN(ha)) {
    return '—';
  }
  return `${ha.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`;
}

export interface PredictAreaMapCardProps {
  loading: boolean;
  /** e.g. village name under the title */
  regionLabel: string;
  sugarcaneHa: number | null;
  wheatHa: number | null;
  /** Optional; defaults match map legend */
  sugarcaneColor?: string;
  wheatColor?: string;
}

const PredictAreaMapCard: React.FC<PredictAreaMapCardProps> = ({
  loading,
  regionLabel,
  sugarcaneHa,
  wheatHa,
  sugarcaneColor = SUGARCANE_SWATCH,
  wheatColor = WHEAT_SWATCH,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const rows: { index: number; name: string; color: string; area: number | null }[] = [
    { index: 1, name: 'Sugarcane', color: sugarcaneColor, area: sugarcaneHa },
    { index: 2, name: 'Wheat', color: wheatColor, area: wheatHa },
  ];

  return (
    <div
      className="w-[min(100%,18rem)] rounded-md border border-gray-500/90 bg-zinc-950/98 shadow-xl backdrop-blur-sm"
      style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', color: '#ffffff' }}
    >
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3
              className="text-[13px] font-bold leading-tight !text-white"
              style={{ color: '#ffffff' }}
            >
              Total predicted crop area
            </h3>
            <p
              className="mt-0.5 truncate text-[11px] !text-white"
              style={{ color: '#ffffff' }}
              title={regionLabel}
            >
              {regionLabel || '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex-shrink-0 rounded p-0.5 !text-white hover:bg-white/15"
            style={{ color: '#ffffff' }}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" strokeWidth={2} /> : <ChevronUp className="h-4 w-4" strokeWidth={2} />}
          </button>
        </div>
        <div className="mt-2 h-px w-full bg-amber-500" />
      </div>

      {!collapsed && (
        <div className="px-2 pb-2.5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-4" style={{ color: '#ffffff' }}>
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-400" />
              <span className="text-xs !text-white" style={{ color: '#ffffff' }}>
                Loading…
              </span>
            </div>
          ) : (
            <table className="w-full text-left text-[11px]" style={{ color: '#ffffff' }}>
              <thead>
                <tr>
                  <th
                    className="w-8 py-1.5 pl-0.5 !text-white"
                    style={{ color: '#ffffff' }}
                  >
                    Row
                  </th>
                  <th className="py-1.5 !text-white" style={{ color: '#ffffff' }}>
                    Crop
                  </th>
                  <th
                    className="py-1.5 pr-0.5 text-right !text-white"
                    style={{ color: '#ffffff' }}
                  >
                    Total area
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.name}
                    className="border-t border-zinc-600/80"
                  >
                    <td className="py-1.5 align-middle">
                      <span
                        className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-zinc-600/80 bg-zinc-800/90 px-1 py-0.5 text-[10px] font-semibold !text-white"
                        style={{ color: '#ffffff' }}
                      >
                        {row.index}
                      </span>
                    </td>
                    <td className="py-1.5 align-middle">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-white/30"
                          style={{ backgroundColor: row.color }}
                        />
                        <span
                          className="font-medium !text-white"
                          style={{ color: '#ffffff' }}
                        >
                          {row.name}
                        </span>
                      </div>
                    </td>
                    <td
                      className="py-1.5 text-right align-middle tabular-nums !text-white"
                      style={{ color: '#ffffff' }}
                    >
                      {row.area == null || Number.isNaN(row.area) ? (
                        '—'
                      ) : (
                        formatAreaHa(row.area)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default PredictAreaMapCard;
