import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const updateMenuPosition = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const maxH = Math.min(256, Math.max(120, window.innerHeight - rect.bottom - 12));
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 180),
      maxHeight: maxH,
      zIndex: 9999,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updateMenuPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        ref={buttonRef}
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

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className={`overflow-y-auto rounded-lg border shadow-xl ${
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
          </div>,
          document.body
        )}
    </div>
  );
};

export default LayersDropdown;
