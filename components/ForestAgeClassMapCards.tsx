import React from 'react';

const FOREST_AGE_CLASS_META = [
  { key: 'young', label: 'Young', color: '#84cc16' },
  { key: 'mid_age', label: 'Mid Age', color: '#22c55e' },
  { key: 'mature', label: 'Mature', color: '#15803d' },
  { key: 'old_age', label: 'Old Age', color: '#92400e' },
] as const;

type ForestAgeClasses = Record<
  string,
  { tile_url: string; area_hectares: number } | undefined
>;

interface ForestAgeClassMapCardsProps {
  forestData: ForestAgeClasses | null;
  selectedAgeClass: string | null;
  onSelect: (ageClass: string, tileUrl: string, areaHa: number) => void;
  textColorOnBackground: (hex: string | undefined) => string;
}

const ForestAgeClassMapCards: React.FC<ForestAgeClassMapCardsProps> = ({
  forestData,
  selectedAgeClass,
  onSelect,
  textColorOnBackground,
}) => {
  if (!forestData) return null;

  const cards = FOREST_AGE_CLASS_META.filter(({ key }) => forestData[key]?.tile_url);
  if (cards.length === 0) return null;

  return (
    <div className="absolute top-28 md:top-20 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto">
      <div className="p-1 bg-black/55 backdrop-blur-sm rounded-md border border-gray-700/80 shadow-lg">
        <div className="grid grid-cols-2 gap-0.5">
          {cards.map(({ key, label, color }) => {
            const entry = forestData[key]!;
            const isSelected = selectedAgeClass === key;
            const cardFg = textColorOnBackground(color);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(key, entry.tile_url, entry.area_hectares)}
                className={`rounded px-1.5 py-1 flex flex-col items-center justify-center text-center min-h-[48px] min-w-[72px] transition-all ${
                  isSelected ? 'ring-1 ring-white ring-offset-1 ring-offset-gray-900' : 'hover:brightness-110'
                }`}
                style={{ backgroundColor: color, color: cardFg }}
              >
                <span className="text-[9px] font-semibold leading-tight">{label}</span>
                <span className="font-bold text-[10px] leading-tight mt-0.5">
                  {entry.area_hectares.toFixed(2)} ha
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ForestAgeClassMapCards;
