import React from 'react';

interface RealEarthProps {
  slow?: boolean;
}

export const RealEarth: React.FC<RealEarthProps> = ({ slow = false }) => {
  return (
    <div 
      className="w-full h-full rounded-full overflow-hidden relative"
      style={{
        backgroundImage: 'url(https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        animation: `earth-spin ${slow ? '120s' : '30s'} linear infinite`
      }}
    >
      {/* Atmosphere gradient */}
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.05),transparent_60%,rgba(0,0,0,0.8)_100%)]"></div>
      {/* Glow effect */}
      <div className="absolute -inset-[2px] rounded-full shadow-[0_0_50px_rgba(34,211,238,0.2)] opacity-50 pointer-events-none"></div>
    </div>
  );
};

export default RealEarth;

