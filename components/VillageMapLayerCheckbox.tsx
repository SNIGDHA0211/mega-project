import React from 'react';
import { Loader2 } from 'lucide-react';

type LayerTone = 'emerald' | 'sky' | 'violet';

const toneStyles: Record<
  LayerTone,
  { checkedDark: string; uncheckedDark: string; checkedLight: string; uncheckedLight: string; accent: string }
> = {
  emerald: {
    checkedDark: 'border-emerald-400 bg-emerald-800/80 ring-1 ring-emerald-400 text-white',
    uncheckedDark: 'border-emerald-600 bg-emerald-900/50 text-white hover:bg-emerald-800/70',
    checkedLight: 'border-emerald-500 bg-emerald-100 ring-1 ring-emerald-400 text-emerald-950',
    uncheckedLight: 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
    accent: 'accent-emerald-500',
  },
  sky: {
    checkedDark: 'border-sky-400 bg-sky-800/80 ring-1 ring-sky-400 text-white',
    uncheckedDark: 'border-sky-600 bg-sky-900/50 text-white hover:bg-sky-800/70',
    checkedLight: 'border-sky-500 bg-sky-100 ring-1 ring-sky-400 text-sky-950',
    uncheckedLight: 'border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100',
    accent: 'accent-sky-500',
  },
  violet: {
    checkedDark: 'border-violet-400 bg-violet-800/80 ring-1 ring-violet-400 text-white',
    uncheckedDark: 'border-violet-600 bg-violet-900/50 text-white hover:bg-violet-800/70',
    checkedLight: 'border-violet-500 bg-violet-100 ring-1 ring-violet-400 text-violet-950',
    uncheckedLight: 'border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100',
    accent: 'accent-violet-500',
  },
};

export interface VillageMapLayerCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  tone: LayerTone;
  loading?: boolean;
  disabled?: boolean;
  isDarkMode?: boolean;
}

const VillageMapLayerCheckbox: React.FC<VillageMapLayerCheckboxProps> = ({
  label,
  checked,
  onChange,
  tone,
  loading = false,
  disabled = false,
  isDarkMode = true,
}) => {
  const styles = toneStyles[tone];
  const stateClass = checked
    ? isDarkMode
      ? styles.checkedDark
      : styles.checkedLight
    : isDarkMode
      ? styles.uncheckedDark
      : styles.uncheckedLight;

  return (
    <label
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      } ${stateClass}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={`h-4 w-4 shrink-0 rounded border-gray-500 ${styles.accent}`}
      />
      <span className="flex-1">{label}</span>
      {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
    </label>
  );
};

export default VillageMapLayerCheckbox;
