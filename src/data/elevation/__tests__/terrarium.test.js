import { describe, it, expect } from 'vitest';
import { decodeElevation, decodeHeightmap, SEA_LEVEL_M } from '../terrarium.js';

describe('terrarium decode', () => {
  it('defines sea level at 0 m', () => {
    expect(SEA_LEVEL_M).toBe(0);
  });

  it('decodes the sea-level reference pixel (128,0,0) to 0 m', () => {
    expect(decodeElevation(128, 0, 0)).toBeCloseTo(0, 6);
  });

  it('decodes the real verified pixel (130,192,0) to 704 m', () => {
    // Same pixel measured live from terrarium 10/535/400.
    expect(decodeElevation(130, 192, 0)).toBeCloseTo(704, 6);
  });

  it('decodes negative elevations (bathymetry)', () => {
    // 127,246,0 -> 127*256 + 246 - 32768 = -10 m
    expect(decodeElevation(127, 246, 0)).toBeCloseTo(-10, 6);
  });

  it('decodes a full RGBA buffer into a heightmap', () => {
    // 2x2 tile, all pixels at sea level (128,0,0,255).
    const size = 2;
    const rgba = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      rgba[i * 4] = 128;
      rgba[i * 4 + 3] = 255;
    }
    const hm = decodeHeightmap(rgba, size);
    expect(hm).toBeInstanceOf(Float32Array);
    expect(hm.length).toBe(4);
    expect(Array.from(hm)).toEqual([0, 0, 0, 0]);
  });
});
