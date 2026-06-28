import { describe, it, expect } from 'vitest';
import { vegetationForTile } from '../vegetation.js';

function constHeightmap(size, value) {
  const hm = new Float32Array(size * size);
  hm.fill(value);
  return hm;
}
const boxAt = (lat, lon) => ({ nw: { lat: lat + 0.02, lon }, se: { lat, lon: lon + 0.04 } });

describe('vegetationForTile (biome-driven)', () => {
  it('grows palms or broadleaf in the equatorial tropics', () => {
    const v = vegetationForTile(constHeightmap(8, 120), 8, boxAt(0, 20), 200, 1);
    expect(v.length).toBeGreaterThan(20);
    expect(v.every((t) => t.species === 'palm' || t.species === 'broadleaf')).toBe(true);
  });

  it('grows conifers on mid-elevation cold mountains', () => {
    const v = vegetationForTile(constHeightmap(8, 1500), 8, boxAt(46, 8), 200, 2);
    expect(v.length).toBeGreaterThan(10);
    expect(v.every((t) => t.species === 'conifer')).toBe(true);
  });

  it('is sparse (or cactus) in hot desert latitudes', () => {
    const dense = vegetationForTile(constHeightmap(8, 120), 8, boxAt(0, 20), 200, 3);
    const desert = vegetationForTile(constHeightmap(8, 300), 8, boxAt(25, 15), 200, 3);
    expect(desert.length).toBeLessThan(dense.length / 3);
    expect(desert.every((t) => t.species === 'cactus')).toBe(true);
  });

  it('places nothing on snow, sea, or below the snow line', () => {
    expect(vegetationForTile(constHeightmap(8, 5000), 8, boxAt(46, 8), 200, 4)).toHaveLength(0);
    expect(vegetationForTile(constHeightmap(8, 0), 8, boxAt(10, 10), 200, 4)).toHaveLength(0);
  });

  it('is deterministic for the same seed', () => {
    const a = vegetationForTile(constHeightmap(8, 120), 8, boxAt(0, 20), 60, 9);
    const b = vegetationForTile(constHeightmap(8, 120), 8, boxAt(0, 20), 60, 9);
    expect(a).toEqual(b);
  });
});
