import { makeProjection } from '../../core/geo/projection.js';
import { bilinearSample } from '../../data/elevation/sample.js';
import { biomeFrom, sampleLandcover, BIOME } from './climate.js';

function rng(n) {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

// Per-biome: how dense (probability to keep an attempt) and which species.
const RULES = {
  [BIOME.TROPICAL_FOREST]: { density: 0.85, pick: (r) => (r < 0.45 ? 'palm' : 'broadleaf') },
  [BIOME.TEMPERATE_FOREST]: { density: 0.6, pick: () => 'broadleaf' },
  [BIOME.BOREAL_FOREST]: { density: 0.55, pick: () => 'conifer' },
  [BIOME.SAVANNA]: { density: 0.14, pick: () => 'acacia' },
  [BIOME.GRASSLAND]: { density: 0.07, pick: (r) => (r < 0.5 ? 'broadleaf' : 'acacia') },
  [BIOME.SHRUBLAND]: { density: 0.06, pick: () => 'cactus' },
  [BIOME.DESERT]: { density: 0.02, pick: () => 'cactus' },
};

const MAX_SLOPE = 9;

/**
 * Deterministically place vegetation across a tile, with species and density
 * chosen by the real biome at each point (palm at the equator, conifer up high,
 * acacia in savanna, sparse cactus in desert, nothing on snow/tundra/sea).
 * @returns {Array<{x,y,z, species, scale, rotY}>}
 */
export function vegetationForTile(heightmap, size, box, attempts, seed, landcover = null) {
  const proj = makeProjection(box.nw);
  const out = [];
  for (let i = 0; i < attempts; i++) {
    const u = rng(seed + i * 2.1 + 0.5);
    const v = rng(seed + i * 3.7 + 11.3);
    const gx = u * (size - 1);
    const gy = v * (size - 1);
    const elev = bilinearSample(heightmap, size, gx, gy);
    if (elev <= 1) continue;

    const lat = box.nw.lat + (box.se.lat - box.nw.lat) * v;
    const lon = box.nw.lon + (box.se.lon - box.nw.lon) * u;
    const lc = sampleLandcover(landcover, u, v);
    const rule = RULES[biomeFrom(lc, lat, lon, elev)];
    if (!rule) continue;
    if (rng(seed + i * 9.1) > rule.density) continue;

    const eR = bilinearSample(heightmap, size, Math.min(size - 1, gx + 1), gy);
    const eD = bilinearSample(heightmap, size, gx, Math.min(size - 1, gy + 1));
    if (Math.abs(eR - elev) + Math.abs(eD - elev) > MAX_SLOPE) continue;

    const w = proj.toWorld({ lat, lon });
    out.push({
      x: w.east,
      y: elev,
      z: -w.north,
      species: rule.pick(rng(seed + i * 5.3)),
      scale: 0.8 + rng(seed + i * 7.1) * 0.7,
      rotY: rng(seed + i * 13.7) * Math.PI * 2,
    });
  }
  return out;
}
