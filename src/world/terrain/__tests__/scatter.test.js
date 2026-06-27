import { describe, it, expect } from 'vitest';
import { scatterForTile } from '../scatter.js';

const BOX = { nw: { lat: 6.2, lon: 1.2 }, se: { lat: 6.15, lon: 1.25 } };

function constHeightmap(size, value) {
  const hm = new Float32Array(size * size);
  hm.fill(value);
  return hm;
}

describe('scatterForTile', () => {
  it('places objects on flat low land, with elevation in y', () => {
    const items = scatterForTile(constHeightmap(8, 100), 8, BOX, 40, 1);
    expect(items.length).toBeGreaterThan(20);
    expect(items.every((s) => s.type === 'tree')).toBe(true); // below treeline
    expect(items.every((s) => Math.abs(s.y - 100) < 1e-6)).toBe(true);
    expect(items.every((s) => Number.isFinite(s.x) && Number.isFinite(s.z))).toBe(true);
  });

  it('places nothing on water', () => {
    expect(scatterForTile(constHeightmap(8, 0), 8, BOX, 40, 1)).toHaveLength(0);
    expect(scatterForTile(constHeightmap(8, -5), 8, BOX, 40, 1)).toHaveLength(0);
  });

  it('uses rocks above the treeline and nothing above the snow line', () => {
    const rocks = scatterForTile(constHeightmap(8, 2200), 8, BOX, 40, 1);
    expect(rocks.length).toBeGreaterThan(0);
    expect(rocks.every((s) => s.type === 'rock')).toBe(true);
    expect(scatterForTile(constHeightmap(8, 3000), 8, BOX, 40, 1)).toHaveLength(0);
  });

  it('is deterministic for the same seed', () => {
    const a = scatterForTile(constHeightmap(8, 100), 8, BOX, 30, 42);
    const b = scatterForTile(constHeightmap(8, 100), 8, BOX, 30, 42);
    expect(a).toEqual(b);
  });
});
