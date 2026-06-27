import { describe, it, expect } from 'vitest';
import { buildTerrainGeometry } from '../buildTerrainGeometry.js';

// 0.05° tile near the equator, constant elevation.
const BOX = { nw: { lat: 6.2, lon: 1.2 }, se: { lat: 6.15, lon: 1.25 } };

function constHeightmap(size, value) {
  const hm = new Float32Array(size * size);
  hm.fill(value);
  return hm;
}

describe('buildTerrainGeometry', () => {
  it('produces correctly sized indexed buffers', () => {
    const grid = 5;
    const g = buildTerrainGeometry(constHeightmap(4, 100), 4, BOX, grid);
    expect(g.positions.length).toBe(grid * grid * 3);
    expect(g.colors.length).toBe(grid * grid * 3);
    expect(g.indices.length).toBe((grid - 1) * (grid - 1) * 6);
  });

  it('anchors the NW corner vertex at local origin (0, h, 0)', () => {
    const g = buildTerrainGeometry(constHeightmap(4, 100), 4, BOX, 5);
    expect(g.positions[0]).toBeCloseTo(0, 6); // x east
    expect(g.positions[1]).toBeCloseTo(100, 3); // y elevation
    expect(g.positions[2]).toBeCloseTo(0, 6); // z north
  });

  it('puts elevation into the y component', () => {
    const g = buildTerrainGeometry(constHeightmap(4, 250), 4, BOX, 4);
    for (let i = 0; i < g.positions.length; i += 3) {
      expect(g.positions[i + 1]).toBeCloseTo(250, 3);
    }
  });

  it('spreads vertices east (+x) and south (+z) across the tile', () => {
    const grid = 5;
    const g = buildTerrainGeometry(constHeightmap(4, 0), 4, BOX, grid);
    const last = (grid * grid - 1) * 3; // SE corner
    expect(g.positions[last]).toBeGreaterThan(0); // east of NW
    // worldFrame convention: north = -z, so south of the anchor is +z.
    expect(g.positions[last + 2]).toBeGreaterThan(0);
  });

  it('contains no NaNs', () => {
    const g = buildTerrainGeometry(constHeightmap(4, 50), 4, BOX, 6);
    expect(Array.from(g.positions).every(Number.isFinite)).toBe(true);
    expect(Array.from(g.colors).every(Number.isFinite)).toBe(true);
  });
});
