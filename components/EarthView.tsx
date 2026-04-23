import React from 'react';
import PredictAreaMapCard, { type PredictAreaMapCardProps } from './PredictAreaMapCard';

export interface EarthViewProps {
  className?: string;
  /** CSS height of the whole frame (iframe + underlay), e.g. '100%' or 600 */
  height?: string | number;
  title?: string;
  /**
   * Same crop/area table as the main map (top-right). Pass `null` to hide the card.
   * Typically reuse `predictAreaMapCard` from App.
   */
  predictCard?: PredictAreaMapCardProps | null;
  /** Extra classes on the outer frame (e.g. rounded-lg) */
  frameClassName?: string;
}

/**
 * Google Earth in an iframe with optional dark “space” underlay and the predict-area
 * card overlaid on the right (Sugarcane / Wheat, blue / red).
 * Note: earth.google.com may block embedding in some environments; the layout still works.
 */
export function EarthView({
  className = 'w-full',
  height = '100%',
  title = 'Google Earth',
  predictCard = null,
  frameClassName = '',
}: EarthViewProps) {
  const hStyle: React.CSSProperties =
    typeof height === 'number' ? { height: `${height}px` } : { height };

  return (
    <div
      className={`relative min-h-0 overflow-hidden ${className}`}
      style={hStyle}
    >
      {/* Dark frame (globe / star feel) behind the iframe — matches a dark 3D Earth UI */}
      <div
        className={`absolute inset-0 z-0 bg-black ${frameClassName}`}
        aria-hidden
      >
        <div
          className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-black to-zinc-950"
          style={{
            backgroundImage: `
              radial-gradient(1.5px 1.5px at 8% 12%, rgba(255,255,255,0.45), transparent),
              radial-gradient(1.5px 1.5px at 22% 40%, rgba(255,255,255,0.2), transparent),
              radial-gradient(1px 1px at 55% 8%, rgba(255,255,255,0.35), transparent),
              radial-gradient(1px 1px at 88% 25%, rgba(255,255,255,0.15), transparent),
              radial-gradient(1.5px 1.5px at 70% 70%, rgba(255,255,255,0.25), transparent),
              radial-gradient(1px 1px at 15% 85%, rgba(255,255,255,0.2), transparent)
            `,
          }}
        />
      </div>

      <iframe
        title={title}
        src="https://earth.google.com/web/"
        className="absolute inset-0 z-[1] h-full w-full border-0"
        allowFullScreen
        loading="lazy"
      />

      {predictCard && (
        <div className="pointer-events-none absolute right-2 top-2 z-[2] max-w-[min(18rem,calc(100%-1rem))] sm:right-3 sm:top-3">
          <div className="pointer-events-auto">
            <PredictAreaMapCard {...predictCard} />
          </div>
        </div>
      )}
    </div>
  );
}

export default EarthView;
