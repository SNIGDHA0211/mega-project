import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';

type LayerTone = 'emerald' | 'sky' | 'violet' | 'amber';

export interface LayerOption {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  tone: LayerTone;
  loading?: boolean;
  disabled?: boolean;
}

const toneDot: Record<LayerTone, string> = {
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
};

function formatSummary(options: LayerOption[]): string {
  const on = options.filter((o) => o.checked).map((o) => o.label);
  if (on.length === 0) return '-- Select Layers --';
  if (on.length === options.length) return 'All layers';
  if (on.length <= 2) return on.join(', ');
  return `${on.length} layers`;
}

export interface LayersDropdownProps {
  options: LayerOption[];
  isDarkMode?: boolean;
  footer?: React.ReactNode;
}

const LayersDropdown: React.FC<LayersDropdownProps> = ({
  options,
  isDarkMode = true,
  footer,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
          isDarkMode
            ? 'border-gray-600 bg-gray-700 text-white'
            : 'border-emerald-100 bg-white text-slate-800'
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{formatSummary(options)}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border shadow-lg ${
            isDarkMode ? 'border-gray-600 bg-gray-800' : 'border-emerald-100 bg-white'
          }`}
          role="listbox"
        >
          {options.map((opt) => (
            <label
              key={opt.id}
              className={`flex cursor-pointer items-center gap-2.5 border-b px-3 py-2.5 last:border-b-0 ${
                opt.disabled ? 'cursor-not-allowed opacity-50' : ''
              } ${
                isDarkMode
                  ? 'border-gray-700 hover:bg-gray-700/80'
                  : 'border-emerald-50 hover:bg-emerald-50/60'
              } ${
                opt.checked
                  ? isDarkMode
                    ? 'bg-emerald-900/25'
                    : 'bg-emerald-50'
                  : ''
              }`}
            >
              <input
                type="checkbox"
                checked={opt.checked}
                disabled={opt.disabled}
                onChange={(e) => opt.onChange(e.target.checked)}
                className="h-4 w-4 rounded border-gray-500 accent-emerald-500"
              />
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneDot[opt.tone]}`} />
              <span className={`flex-1 text-sm ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                {opt.label}
              </span>
              {opt.loading ? (
                <Loader2 className={`h-4 w-4 shrink-0 animate-spin ${isDarkMode ? 'text-gray-300' : 'text-slate-500'}`} />
              ) : null}
            </label>
          ))}
          {footer ? <div className="border-t border-gray-700/50 px-3 py-2">{footer}</div> : null}
        </div>
      )}
    </div>
  );
};

export default LayersDropdown;
