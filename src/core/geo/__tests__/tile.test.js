import { describe, it, expect } from 'vitest';
import { tileFraction, tileForLonLat, lonLatForTile } from '../tile.js';

describe('tile math', () => {
  it('puts the whole world in tile 0/0 at zoom 0', () => {
    expect(tileForLonLat(0, 0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('returns the NW corner of the zoom-0 tile', () => {
    const nw = lonLatForTile(0, 0, 0);
    expect(nw.lon).toBeCloseTo(-180, 6);
    expect(nw.lat).toBeCloseTo(85.0511, 3); // mercator top edge
  });

  it('round-trips a real tile (terrarium 10/535/400)', () => {
    // Center of tile 535/400 at z10 must map back to that tile.
    const nw = lonLatForTile(535, 400, 10);
    const se = lonLatForTile(536, 401, 10);
    const center = { lat: (nw.lat + se.lat) / 2, lon: (nw.lon + se.lon) / 2 };
    expect(tileForLonLat(center.lat, center.lon, 10)).toEqual({ x: 535, y: 400 });
  });

  it('reports in-tile fractions near 0.5 at a tile center', () => {
    const nw = lonLatForTile(535, 400, 10);
    const se = lonLatForTile(536, 401, 10);
    const center = { lat: (nw.lat + se.lat) / 2, lon: (nw.lon + se.lon) / 2 };
    const f = tileFraction(center.lat, center.lon, 10);
    expect(f.x).toBe(535);
    expect(f.y).toBe(400);
    expect(f.fx).toBeCloseTo(0.5, 2);
    expect(f.fy).toBeCloseTo(0.5, 2);
  });

  it('clamps latitudes beyond the mercator limit without NaN', () => {
    const t = tileForLonLat(89.9, 0, 5);
    expect(Number.isFinite(t.x)).toBe(true);
    expect(Number.isFinite(t.y)).toBe(true);
  });
});
