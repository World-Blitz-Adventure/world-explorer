// A self-contained climate model: from (lat, lon, elevation) it derives a real
// biome, so content matches the actual region — Sahara desert, equatorial
// jungle, alpine snow, savanna. The single source of truth for ground colour,
// and (later) which plants and animals belong here. Pure: runs in the worker.

export const BIOME = {
  OCEAN: 'OCEAN',
  DESERT: 'DESERT',
  SAVANNA: 'SAVANNA',
  GRASSLAND: 'GRASSLAND',
  SHRUBLAND: 'SHRUBLAND',
  TEMPERATE_FOREST: 'TEMPERATE_FOREST',
  TROPICAL_FOREST: 'TROPICAL_FOREST',
  BOREAL_FOREST: 'BOREAL_FOREST',
  TUNDRA: 'TUNDRA',
  SNOW: 'SNOW',
};

// Hadley-cell moisture by latitude: wet equator, dry subtropics (deserts),
// wet temperate belt, dry poles. Piecewise-linear control points.
const MOIST = [
  [0, 0.9], [8, 0.72], [14, 0.42], [20, 0.17], [30, 0.15],
  [37, 0.42], [50, 0.72], [62, 0.55], [74, 0.3], [90, 0.2],
];

export function moisture(lat) {
  const a = Math.abs(lat);
  for (let i = 0; i < MOIST.length - 1; i++) {
    const [x0, y0] = MOIST[i];
    const [x1, y1] = MOIST[i + 1];
    if (a <= x1) return y0 + (y1 - y0) * ((a - x0) / (x1 - x0));
  }
  return 0.2;
}

/** Rough mean temperature (°C) from latitude and elevation (lapse rate). */
export function temperature(lat, elev) {
  return 32 - 0.42 * Math.abs(lat) - Math.max(0, elev) * 0.0065;
}

/** Permanent snow line (metres), high at the equator, low toward the poles. */
export function snowline(lat) {
  return 4200 - 42 * Math.abs(lat);
}

/** Classify the biome at a real location. */
export function classifyBiome(lat, lon, elev) {
  if (elev <= 0) return BIOME.OCEAN;
  if (elev > snowline(lat)) return BIOME.SNOW;
  const t = temperature(lat, elev);
  const m = moisture(lat);
  if (t < -2) return BIOME.SNOW;
  if (t < 2) return BIOME.TUNDRA;
  if (m < 0.2 && t > 10) return BIOME.DESERT; // hot deserts
  if (t < 8) return m > 0.4 ? BIOME.BOREAL_FOREST : BIOME.SHRUBLAND; // taiga / steppe
  if (t < 19) {
    if (m < 0.3) return BIOME.SHRUBLAND;
    return m < 0.55 ? BIOME.GRASSLAND : BIOME.TEMPERATE_FOREST;
  }
  return m < 0.5 ? BIOME.SAVANNA : BIOME.TROPICAL_FOREST; // hot
}

const COLORS = {
  OCEAN: [0.1, 0.28, 0.4],
  DESERT: [0.85, 0.76, 0.52],
  SAVANNA: [0.74, 0.66, 0.36],
  GRASSLAND: [0.56, 0.63, 0.34],
  SHRUBLAND: [0.58, 0.57, 0.4],
  TEMPERATE_FOREST: [0.3, 0.45, 0.26],
  TROPICAL_FOREST: [0.16, 0.4, 0.2],
  BOREAL_FOREST: [0.24, 0.37, 0.29],
  TUNDRA: [0.56, 0.56, 0.5],
  SNOW: [0.93, 0.94, 0.97],
};
const ROCK = [0.45, 0.42, 0.4];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Ground colour for a biome, with steep slopes exposing rock. */
export function biomeColorFor(biome, slope) {
  const base = COLORS[biome] || COLORS.GRASSLAND;
  return mix(base, ROCK, clamp01((slope - 0.4) / 0.4));
}
