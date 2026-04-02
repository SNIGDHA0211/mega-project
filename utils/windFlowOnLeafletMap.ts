import L from 'leaflet';
import type { WindDirectResponse, WindDirectLatLon, WindDirectPointWeather } from '../services/analysisService';

const STYLES_ID = 'wind-flow-marker-global-styles';

function ensureMarkerStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLES_ID)) return;
  const s = document.createElement('style');
  s.id = STYLES_ID;
  s.textContent = `
    .wind-flow-pin.leaflet-marker-icon {
      background: transparent !important;
      border: none !important;
    }
  `;
  document.head.appendChild(s);
}

export function blowTowardDeg(fromDeg: number | null | undefined): number {
  const d = Number(fromDeg);
  if (!Number.isFinite(d)) return 0;
  return (d + 180) % 360;
}

function pointInRing(lat: number, lon: number, ring: WindDirectLatLon[]): boolean {
  if (!ring || ring.length < 3) return true;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = Number(ring[i].lat);
    const xi = Number(ring[i].lon);
    const yj = Number(ring[j].lat);
    const xj = Number(ring[j].lon);
    const intersect =
      xi > lon !== xj > lon && lat < ((yj - yi) * (lon - xi)) / ((xj - xi) || 1e-12) + yi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function estimateVectorAt(
  lat: number,
  lon: number,
  samples: WindDirectPointWeather[]
): { east: number; north: number } | null {
  if (!samples?.length) return null;
  let sumW = 0;
  let sumEast = 0;
  let sumNorth = 0;
  for (const p of samples) {
    const s = Number(p.wind_speed_10m);
    const from = Number(p.wind_direction_10m);
    if (!Number.isFinite(s) || !Number.isFinite(from)) continue;
    const dLat = lat - Number(p.latitude);
    const dLon = lon - Number(p.longitude);
    const dist2 = dLat * dLat + dLon * dLon + 1e-8;
    const w = 1 / dist2;
    const toward = (blowTowardDeg(from) * Math.PI) / 180;
    const mps = s / 3.6;
    const east = Math.sin(toward) * mps;
    const north = Math.cos(toward) * mps;
    sumEast += east * w;
    sumNorth += north * w;
    sumW += w;
  }
  if (!sumW) return null;
  return { east: sumEast / sumW, north: sumNorth / sumW };
}

function randomPointInAoi(payload: WindDirectResponse, maxTries = 40): { lat: number; lon: number } {
  const b = payload.bbox;
  const ring = payload.aoi_ring || [];
  for (let i = 0; i < maxTries; i++) {
    const lat = b.min_lat + Math.random() * (b.max_lat - b.min_lat);
    const lon = b.min_lon + Math.random() * (b.max_lon - b.min_lon);
    if (pointInRing(lat, lon, ring)) return { lat, lon };
  }
  return { lat: payload.centroid.lat, lon: payload.centroid.lon };
}

export interface MountWindFlowOptions {
  particleCount?: number;
  motionScale?: number;
  showMarkers?: boolean;
}

/**
 * Animated wind streaks (canvas) + optional speed/direction markers. Returns dispose().
 */
export function mountWindFlowOnMap(
  map: L.Map,
  payload: WindDirectResponse,
  options?: MountWindFlowOptions
): () => void {
  ensureMarkerStyles();
  const particleCount = options?.particleCount ?? 420;
  const motionScale = options?.motionScale ?? 1400;
  const showMarkers = options?.showMarkers !== false;
  const samples = payload.points_weather || [];

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText =
    'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:550;';
  map.getContainer().appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return () => {};
  }

  const markerLayer = L.layerGroup();
  if (showMarkers && samples.length) {
    for (const p of samples) {
      const rot = blowTowardDeg(p.wind_direction_10m);
      const spd =
        p.wind_speed_10m != null && !Number.isNaN(Number(p.wind_speed_10m))
          ? Number(p.wind_speed_10m).toFixed(1)
          : '–';
      const html =
        `<div style="display:flex;flex-direction:column;align-items:center;width:52px;user-select:none;">` +
        `<span style="display:block;color:#ffffff;font-size:18px;line-height:1;text-shadow:0 0 3px rgba(0,0,0,1),0 0 6px rgba(0,0,0,.85);transform:rotate(${rot}deg);transform-origin:50% 65%;">▲</span>` +
        `<span style="font-size:10px;font-weight:600;color:#fff;background:rgba(0,0,0,.62);padding:1px 5px;border-radius:4px;margin-top:2px;white-space:nowrap;">${spd}</span>` +
        `</div>`;
      const icon = L.divIcon({
        className: 'wind-flow-pin',
        html,
        iconSize: [52, 44],
        iconAnchor: [26, 22],
      });
      const m = L.marker([p.latitude, p.longitude], { icon });
      m.bindPopup(
        `<strong>${spd} km/h</strong> &nbsp;from ${p.wind_direction_10m ?? '–'}°<br>` +
          `Gust: ${p.wind_gusts_10m ?? '–'} km/h<br>Temp: ${p.temperature_2m ?? '–'} °C`
      );
      markerLayer.addLayer(m);
    }
    markerLayer.addTo(map);
  }

  let windAnimRaf: number | null = null;
  let lastFrameTs = 0;
  let latestPayload = payload;

  const syncSize = () => {
    const size = map.getSize();
    canvas.width = Math.max(1, size.x);
    canvas.height = Math.max(1, size.y);
  };
  syncSize();

  type Particle = { lat: number; lon: number; age: number };
  let windParticles: Particle[] = Array.from({ length: particleCount }, () => {
    const p = randomPointInAoi(latestPayload);
    return { lat: p.lat, lon: p.lon, age: Math.random() * 120 };
  });

  const onMapChange = () => {
    syncSize();
  };
  map.on('resize zoom move moveend zoomend', onMapChange);

  const animate = (ts: number) => {
    windAnimRaf = requestAnimationFrame(animate);
    if (!ctx || !latestPayload.points_weather?.length) return;
    if (!lastFrameTs) lastFrameTs = ts;
    const dt = Math.min(0.08, Math.max(0.016, (ts - lastFrameTs) / 1000));
    lastFrameTs = ts;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineWidth = 1.2;

    const ring = latestPayload.aoi_ring || [];
    const b = latestPayload.bbox;

    for (const part of windParticles) {
      const prev = map.latLngToContainerPoint([part.lat, part.lon]);
      const vec = estimateVectorAt(part.lat, part.lon, latestPayload.points_weather);
      if (!vec) {
        const np = randomPointInAoi(latestPayload);
        part.lat = np.lat;
        part.lon = np.lon;
        continue;
      }

      const metersNorth = vec.north * dt * motionScale;
      const metersEast = vec.east * dt * motionScale;
      part.lat += metersNorth / 111320;
      const cosLat = Math.max(0.2, Math.cos((part.lat * Math.PI) / 180));
      part.lon += metersEast / (111320 * cosLat);
      part.age += 1;

      const outsideBBox =
        part.lat < b.min_lat || part.lat > b.max_lat || part.lon < b.min_lon || part.lon > b.max_lon;
      const outsideRing = !pointInRing(part.lat, part.lon, ring);
      if (part.age > 160 || outsideBBox || outsideRing) {
        const np = randomPointInAoi(latestPayload);
        part.lat = np.lat;
        part.lon = np.lon;
        part.age = 0;
        continue;
      }

      const next = map.latLngToContainerPoint([part.lat, part.lon]);
      if (
        !Number.isFinite(prev.x) ||
        !Number.isFinite(prev.y) ||
        !Number.isFinite(next.x) ||
        !Number.isFinite(next.y)
      )
        continue;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
    }
  };

  windAnimRaf = requestAnimationFrame(animate);

  return () => {
    if (windAnimRaf != null) cancelAnimationFrame(windAnimRaf);
    windAnimRaf = null;
    map.off('resize zoom move moveend zoomend', onMapChange);
    if (map.hasLayer(markerLayer)) map.removeLayer(markerLayer);
    markerLayer.clearLayers();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  };
}
