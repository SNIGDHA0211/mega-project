import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import {
  CROP_SELECTION_OPTIONS,
  type CropSelectionKey,
  type CropSelectionState,
} from './CropDropdownChecklist';

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
  cropAreas: Record<CropSelectionKey, number | null>;
  cropColors?: Partial<Record<CropSelectionKey, string>>;
  selectedCrops: CropSelectionState;
  onToggleCrop: (crop: CropSelectionKey) => void;
}

const PredictAreaMapCard: React.FC<PredictAreaMapCardProps> = ({
  loading,
  regionLabel,
  cropAreas,
  cropColors = {},
  selectedCrops,
  onToggleCrop,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const rows = CROP_SELECTION_OPTIONS.map((crop, index) => ({
    key: crop.key,
    index: index + 1,
    name: crop.label,
    color: cropColors[crop.key] ?? crop.color ?? '#166534',
    area: cropAreas[crop.key] ?? null,
  }));

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
        <div className="px-2 pb-2.5 max-h-[min(50vh,280px)] overflow-y-auto">
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
                  <th className="w-8 py-1.5 pl-0.5 !text-white" style={{ color: '#ffffff' }}>
                    Show
                  </th>
                  <th className="py-1.5 !text-white" style={{ color: '#ffffff' }}>
                    Crop
                  </th>
                  <th className="py-1.5 pr-0.5 text-right !text-white" style={{ color: '#ffffff' }}>
                    Total area
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const checked = selectedCrops[row.key];
                  return (
                    <tr
                      key={row.key}
                      className={`border-t border-zinc-600/80 ${checked ? 'bg-white/5' : ''}`}
                    >
                      <td className="py-1.5 align-middle">
                        <label className="inline-flex cursor-pointer items-center justify-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggleCrop(row.key)}
                            className="h-3.5 w-3.5 rounded border-zinc-500 accent-amber-500"
                            aria-label={`Show ${row.name} on map`}
                          />
                        </label>
                      </td>
                      <td className="py-1.5 align-middle">
                        <label
                          className="flex cursor-pointer items-center gap-1.5"
                          onClick={() => onToggleCrop(row.key)}
                        >
                          <span
                            className="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-white/30"
                            style={{ backgroundColor: row.color }}
                          />
                          <span
                            className={`font-medium !text-white ${checked ? 'opacity-100' : 'opacity-70'}`}
                            style={{ color: '#ffffff' }}
                          >
                            {row.name}
                          </span>
                        </label>
                      </td>
                      <td
                        className="py-1.5 text-right align-middle tabular-nums !text-white"
                        style={{ color: '#ffffff' }}
                      >
                        {row.area == null || Number.isNaN(row.area) ? '—' : formatAreaHa(row.area)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default PredictAreaMapCard;
