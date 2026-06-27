import { describe, it, expect } from 'vitest';
import { makeProjection } from '../projection.js';
import { EARTH_RADIUS } from '../geodesy.js';

const ORIGIN = { lat: 48.8566, lon: 2.3522 }; // Paris

describe('projection', () => {
  it('maps the origin to (0,0)', () => {
    const proj = makeProjection(ORIGIN);
    const w = proj.toWorld(ORIGIN);
    expect(w.east).toBeCloseTo(0, 6);
    expect(w.north).toBeCloseTo(0, 6);
  });

  it('maps one degree north to the right number of metres', () => {
    const proj = makeProjection(ORIGIN);
    const w = proj.toWorld({ lat: ORIGIN.lat + 1, lon: ORIGIN.lon });
    expect(w.north).toBeCloseTo(EARTH_RADIUS * (Math.PI / 180), 0); // ~111319 m
    expect(w.east).toBeCloseTo(0, 6);
  });

  it('scales eastings by cos(latitude)', () => {
    const proj = makeProjection(ORIGIN);
    const w = proj.toWorld({ lat: ORIGIN.lat, lon: ORIGIN.lon + 1 });
    const expected = EARTH_RADIUS * (Math.PI / 180) * Math.cos((ORIGIN.lat * Math.PI) / 180);
    expect(w.east).toBeCloseTo(expected, 0);
  });

  it('round-trips lat/lon within 0.5 m across a 50 km box', () => {
    const proj = makeProjection(ORIGIN);
    const p = { lat: ORIGIN.lat + 0.3, lon: ORIGIN.lon + 0.4 }; // ~tens of km
    const w = proj.toWorld(p);
    const back = proj.toLatLon(w.east, w.north);
    // Convert the lat/lon error to metres to assert < 0.5 m.
    const errNorth = Math.abs(back.lat - p.lat) * (Math.PI / 180) * EARTH_RADIUS;
    const errEast =
      Math.abs(back.lon - p.lon) * (Math.PI / 180) * EARTH_RADIUS * Math.cos((p.lat * Math.PI) / 180);
    expect(errNorth).toBeLessThan(0.5);
    expect(errEast).toBeLessThan(0.5);
  });
});
