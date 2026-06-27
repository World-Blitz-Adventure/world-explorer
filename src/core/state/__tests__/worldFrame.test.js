import { describe, it, expect } from 'vitest';
import { createWorldFrame, REBASE_THRESHOLD_M } from '../worldFrame.js';

const ORIGIN = { lat: 48.8566, lon: 2.3522 };

describe('world frame (floating origin)', () => {
  it('exposes the rebase threshold', () => {
    expect(REBASE_THRESHOLD_M).toBe(8000);
  });

  it('maps the origin to (0,0,0)', () => {
    const f = createWorldFrame(ORIGIN);
    const w = f.toWorld(ORIGIN);
    // Per-component to avoid signed-zero (-0) strict-equality artifacts.
    expect(w.x).toBeCloseTo(0, 6);
    expect(w.y).toBeCloseTo(0, 6);
    expect(w.z).toBeCloseTo(0, 6);
  });

  it('places north toward -z and east toward +x', () => {
    const f = createWorldFrame(ORIGIN);
    const north = f.toWorld({ lat: ORIGIN.lat + 0.01, lon: ORIGIN.lon });
    const east = f.toWorld({ lat: ORIGIN.lat, lon: ORIGIN.lon + 0.01 });
    expect(north.z).toBeLessThan(0);
    expect(east.x).toBeGreaterThan(0);
  });

  it('does not rebase below the threshold', () => {
    const f = createWorldFrame(ORIGIN);
    const near = { lat: ORIGIN.lat + 0.01, lon: ORIGIN.lon }; // ~1.1 km
    expect(f.maybeRebase(near)).toBeNull();
    expect(f.origin).toEqual(ORIGIN);
  });

  it('rebases beyond the threshold and re-centers the player', () => {
    const f = createWorldFrame(ORIGIN);
    // Due east at the same latitude (~73 km > 8 km threshold).
    const player = { lat: ORIGIN.lat, lon: ORIGIN.lon + 1 };
    const shift = f.maybeRebase(player);
    expect(shift).not.toBeNull();
    expect(f.origin).toEqual(player);
    // After rebasing, the player sits at the new origin.
    const playerWorld = f.toWorld(player);
    expect(playerWorld.x).toBeCloseTo(0, 6);
    expect(playerWorld.z).toBeCloseTo(0, 6);
  });

  it('keeps a static object consistent through a rebase (same latitude)', () => {
    const f = createWorldFrame(ORIGIN);
    const obj = { lat: ORIGIN.lat, lon: ORIGIN.lon + 0.1 };
    const before = f.toWorld(obj);
    const player = { lat: ORIGIN.lat, lon: ORIGIN.lon + 1 };
    const shift = f.maybeRebase(player);
    const after = f.toWorld(obj);
    // before + shift must equal the object's new world position.
    expect(before.x + shift.x).toBeCloseTo(after.x, 3);
    expect(before.z + shift.z).toBeCloseTo(after.z, 3);
  });
});
