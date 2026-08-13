import React from 'react';
import { X } from 'lucide-react';

export interface VillageCropAreaPopupProps {
  village: string;
  cropAreas: Record<string, number>;
  cropLabel?: string;
  subdistrictTotal?: number | null;
  onClose: () => void;
  isDarkMode?: boolean;
}

const formatCropLabel = (key: string): string =>
  key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const VillageCropAreaPopup: React.FC<VillageCropAreaPopupProps> = ({
  village,
  cropAreas,
  cropLabel,
  subdistrictTotal,
  onClose,
  isDarkMode = false,
}) => {
  const entries = Object.entries(cropAreas).filter(([, ha]) => typeof ha === 'number' && !Number.isNaN(ha));

  return (
    <div
      className="absolute inset-0 z-[1150] flex items-center justify-center p-4 pointer-events-none"
      aria-modal
      role="dialog"
    >
      <div
        className={`pointer-events-auto w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden ${
          isDarkMode ? 'bg-gray-900 border-gray-600 text-gray-100' : 'bg-white border-emerald-100 text-gray-900'
        }`}
      >
        <div
          className={`flex items-start justify-between gap-2 px-4 py-3 border-b ${
            isDarkMode ? 'border-gray-700 bg-gray-800/90' : 'border-emerald-100 bg-emerald-50/80'
          }`}
        >
          <div className="min-w-0">
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
              Village crop area
            </p>
            <h3 className="text-lg font-bold truncate">{village}</h3>
            {cropLabel ? (
              <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>{cropLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`shrink-0 p-1.5 rounded-lg border transition-colors ${
              isDarkMode
                ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                : 'border-emerald-200 text-slate-600 hover:bg-emerald-100'
            }`}
            title="Close"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 space-y-2">
          {entries.length === 0 ? (
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>No crop area data for this village.</p>
          ) : (
            entries.map(([crop, ha]) => (
              <div
                key={crop}
                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${
                  isDarkMode ? 'bg-gray-800/80' : 'bg-emerald-50/60'
                }`}
              >
                <span className="text-sm font-medium capitalize">{formatCropLabel(crop)}</span>
                <span className={`text-sm font-bold tabular-nums ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  {ha.toFixed(4)} ha
                </span>
              </div>
            ))
          )}
          {subdistrictTotal != null && !Number.isNaN(subdistrictTotal) ? (
            <div
              className={`mt-2 pt-2 border-t text-xs flex justify-between ${
                isDarkMode ? 'border-gray-700 text-gray-400' : 'border-emerald-100 text-slate-500'
              }`}
            >
              <span>Subdistrict total</span>
              <span className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-slate-700'}`}>
                {subdistrictTotal.toFixed(4)} ha
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default VillageCropAreaPopup;
