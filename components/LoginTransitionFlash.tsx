import React, { useEffect, useRef, useState } from 'react';
import { Satellite, Scan, Loader2 } from 'lucide-react';

export interface LoginTransitionFlashProps {
  districts: Array<{ district: string }>;
  districtsLoading?: boolean;
  /** Called when user picks a district tab */
  onSelectDistrict: (district: string) => void;
  /** Called after brief flash, when main window should show */
  onComplete: () => void;
}

/**
 * District picker over blurred main window (sidebar + map).
 * Title stays white; pick district → brief flash → main app.
 */
const LoginTransitionFlash: React.FC<LoginTransitionFlashProps> = ({
  districts,
  districtsLoading = false,
  onSelectDistrict,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'pick' | 'flash' | 'out'>('pick');
  const [picked, setPicked] = useState('');
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onSelectRef = useRef(onSelectDistrict);
  onSelectRef.current = onSelectDistrict;

  useEffect(() => {
    if (phase !== 'flash' || !picked) return;
    const tOut = window.setTimeout(() => setPhase('out'), 1400);
    const tDone = window.setTimeout(() => onCompleteRef.current(), 1900);
    return () => {
      window.clearTimeout(tOut);
      window.clearTimeout(tDone);
    };
  }, [phase, picked]);

  const handlePick = (name: string) => {
    if (phase !== 'pick') return;
    setPicked(name);
    onSelectRef.current(name);
    setPhase('flash');
  };

  return (
    <div
      className={`login-flash-overlay fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden transition-opacity duration-500 ${
        phase === 'out' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-live="polite"
      aria-label="Select district"
    >
      {/* Soft earth wash — slow drift motion */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 login-flash-bg-drift"
        style={{
          backgroundImage:
            'url(https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="absolute inset-0 bg-[#020617]/45 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(16,185,129,0.12),transparent_55%)] pointer-events-none" />

      <div
        className={`absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 w-[min(78vw,480px)] h-[min(78vw,480px)] rounded-full border-4 pointer-events-none transition-all duration-700 ${
          phase === 'flash'
            ? 'border-white shadow-[0_0_40px_rgba(255,255,255,0.85),0_0_90px_rgba(16,185,129,0.45)] scale-100 opacity-100 district-flash-ring'
            : 'border-white/25 login-flash-ring-idle'
        }`}
      />

      <div className="relative z-10 flex flex-col items-center gap-4 px-4 w-full max-w-3xl text-center">
        <div className="login-flash-uplink flex items-center gap-2" style={{ color: '#67e8f9' }}>
          <Satellite className="w-5 h-5" />
          <span className="font-mono text-[10px] md:text-xs tracking-[0.28em] uppercase">
            Region uplink
          </span>
        </div>

        {phase === 'pick' ? (
          <>
            <div className="login-flash-panel-in rounded-2xl border border-white/40 bg-black/60 px-6 py-4 backdrop-blur-md shadow-xl">
              <div
                className="text-[10px] md:text-xs font-mono tracking-[0.35em] uppercase mb-1"
                style={{ color: '#a5f3fc' }}
              >
                Select district
              </div>
              <div
                className="login-flash-title login-flash-title-pulse text-xl md:text-2xl font-extrabold tracking-tight"
                style={{ color: '#ffffff' }}
              >
                Nearlive Crop Monitoring
              </div>
              <p className="mt-2 text-xs" style={{ color: 'rgba(207,250,254,0.85)' }}>
                Choose a district to open the map
              </p>
            </div>

            <div
              className="login-flash-panel-in w-full max-w-2xl rounded-2xl border border-cyan-300/30 bg-black/60 backdrop-blur-md p-3 md:p-4 shadow-2xl"
              style={{ animationDelay: '0.12s' }}
            >
              {districtsLoading || districts.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm" style={{ color: '#a5f3fc' }}>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading districts…
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-2 max-h-[42vh] overflow-y-auto pr-1">
                  {districts.map((d, i) => (
                    <button
                      key={d.district}
                      type="button"
                      onClick={() => handlePick(d.district)}
                      className="login-flash-tab px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap border border-cyan-300/40 bg-cyan-300/15 hover:bg-emerald-500 hover:border-emerald-400"
                      style={{
                        color: '#ffffff',
                        animationDelay: `${Math.min(i, 24) * 0.03}s`,
                      }}
                    >
                      {d.district}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="district-name-flash rounded-2xl border-2 border-white/90 bg-black/55 px-8 py-5 backdrop-blur-md shadow-[0_0_30px_rgba(255,255,255,0.55)]">
              <div
                className="text-[10px] md:text-xs font-mono tracking-[0.35em] uppercase mb-2"
                style={{ color: '#a5f3fc' }}
              >
                Selected district
              </div>
              <div
                className="login-flash-title text-3xl md:text-5xl font-extrabold tracking-tight"
                style={{ color: '#ffffff', textShadow: '0 0 18px rgba(255,255,255,0.65)' }}
              >
                {picked}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono" style={{ color: 'rgba(165,243,252,0.9)' }}>
              <Scan className="w-4 h-4 animate-spin" />
              Loading map…
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginTransitionFlash;
