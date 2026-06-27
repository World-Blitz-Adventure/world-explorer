import { describe, it, expect } from 'vitest';
import { bilinearSample } from '../sample.js';

// 2x2 grid:  row-major [ (0,0)=0, (1,0)=10, (0,1)=20, (1,1)=30 ]
const HM = Float32Array.from([0, 10, 20, 30]);

describe('bilinear sampling', () => {
  it('returns exact values at the corners', () => {
    expect(bilinearSample(HM, 2, 0, 0)).toBeCloseTo(0, 6);
    expect(bilinearSample(HM, 2, 1, 0)).toBeCloseTo(10, 6);
    expect(bilinearSample(HM, 2, 0, 1)).toBeCloseTo(20, 6);
    expect(bilinearSample(HM, 2, 1, 1)).toBeCloseTo(30, 6);
  });

  it('interpolates along x', () => {
    expect(bilinearSample(HM, 2, 0.5, 0)).toBeCloseTo(5, 6);
  });

  it('interpolates along y', () => {
    expect(bilinearSample(HM, 2, 0, 0.5)).toBeCloseTo(10, 6);
  });

  it('interpolates the centre', () => {
    expect(bilinearSample(HM, 2, 0.5, 0.5)).toBeCloseTo(15, 6);
  });

  it('clamps out-of-range coordinates', () => {
    expect(bilinearSample(HM, 2, -5, -5)).toBeCloseTo(0, 6);
    expect(bilinearSample(HM, 2, 99, 99)).toBeCloseTo(30, 6);
  });
});
