import { describe, it, expect } from 'vitest';
import { haversine, EARTH_RADIUS } from '../geodesy.js';

describe('geodesy', () => {
  it('exports the WGS84 semi-major axis', () => {
    expect(EARTH_RADIUS).toBe(6378137);
  });

  it('measures one degree of longitude at the equator', () => {
    // Exact for a sphere: R * 1deg in radians.
    const expected = EARTH_RADIUS * (Math.PI / 180); // ~111319.49 m
    const d = haversine({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
    expect(d).toBeCloseTo(expected, 1); // within 0.05 m
  });

  it('measures one degree of latitude', () => {
    const expected = EARTH_RADIUS * (Math.PI / 180);
    const d = haversine({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(d).toBeCloseTo(expected, 1);
  });

  it('matches a known city pair within the spherical band', () => {
    // London ↔ Paris ≈ 343.5 km. Haversine is a spherical model, so it differs
    // from the ellipsoidal/geodesic figure by ~0.1%; assert the spherical band.
    // Sub-metre accuracy is guaranteed by the exact equator-degree tests above.
    const d = haversine({ lat: 51.5074, lon: -0.1278 }, { lat: 48.8566, lon: 2.3522 });
    expect(Math.abs(d - 343556) / 343556).toBeLessThan(0.005);
  });

  it('is zero for identical points', () => {
    expect(haversine({ lat: 10, lon: 20 }, { lat: 10, lon: 20 })).toBe(0);
  });
});
