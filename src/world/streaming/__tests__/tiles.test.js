import { describe, it, expect } from 'vitest';
import { tilesAround } from '../tiles.js';

describe('tilesAround', () => {
  it('returns a (2r+1)^2 block away from edges', () => {
    const t = tilesAround({ x: 100, y: 100 }, 1, 8);
    expect(t.length).toBe(9);
    expect(t).toContainEqual({ x: 100, y: 100, z: 8 });
  });

  it('wraps longitude across the antimeridian', () => {
    const t = tilesAround({ x: 0, y: 100 }, 1, 8); // n = 256
    expect(t.some((p) => p.x === 255)).toBe(true); // x=-1 wrapped to 255
  });

  it('clamps latitude at the poles (drops out-of-range rows)', () => {
    const t = tilesAround({ x: 100, y: 0, z: 8 }, 1, 8);
    expect(t.every((p) => p.y >= 0)).toBe(true);
    expect(t.length).toBe(6); // top row dropped
  });
});
