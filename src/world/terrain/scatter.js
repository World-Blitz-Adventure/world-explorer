import { makeProjection } from '../../core/geo/projection.js';
import { bilinearSample } from '../../data/elevation/sample.js';

// Deterministic pseudo-random in [0,1) from a number — keeps scatter stable
// across reloads and tile streaming (same tile → same trees).
function rng(n) {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

const TREELINE_M = 1900; // trees below, bare rock above
const ROCK_CEILING_M = 2700; // nothing above (snow)
const MAX_SLOPE = 9; // skip cliffs (elevation change per heightmap pixel)

/**
 * Deterministically scatter trees/rocks across a tile, on land, off cliffs,
 * below the snow line. Positions are tile-local metres (offset from box.nw),
 * matching the terrain geometry so they compose with the floating origin.
 *
 * @returns {Array<{x:number,y:number,z:number,type:'tree'|'rock',scale:number,rotY:number}>}
 */
export function scatterForTile(heightmap, size, box, attempts, seed) {
  const proj = makeProjection(box.nw);
  const out = [];
  for (let i = 0; i < attempts; i++) {
    const u = rng(seed + i * 2.1 + 0.5);
    const v = rng(seed + i * 3.7 + 11.3);
    const gx = u * (size - 1);
    const gy = v * (size - 1);
    const elev = bilinearSample(heightmap, size, gx, gy);
    if (elev <= 1 || elev > ROCK_CEILING_M) continue; // water/beach or snow

    const eRight = bilinearSample(heightmap, size, Math.min(size - 1, gx + 1), gy);
    const eDown = bilinearSample(heightmap, size, gx, Math.min(size - 1, gy + 1));
    if (Math.abs(eRight - elev) + Math.abs(eDown - elev) > MAX_SLOPE) continue; // cliff

    const lat = box.nw.lat + (box.se.lat - box.nw.lat) * v;
    const lon = box.nw.lon + (box.se.lon - box.nw.lon) * u;
    const w = proj.toWorld({ lat, lon });
    out.push({
      x: w.east,
      y: elev,
      z: -w.north,
      type: elev > TREELINE_M ? 'rock' : 'tree',
      scale: 0.7 + rng(seed + i * 5.3) * 0.8,
      rotY: rng(seed + i * 7.1) * Math.PI * 2,
    });
  }
  return out;
}
