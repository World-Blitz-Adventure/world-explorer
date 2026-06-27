import { describe, it, expect } from 'vitest';
import { createElevationSource } from '../elevationSource.js';

// Build a synthetic terrarium RGBA tile of one constant elevation (integer m).
function makeTile(size, elevation) {
  const v = elevation + 32768;
  const r = Math.floor(v / 256) & 255;
  const g = ((v % 256) + 256) % 256;
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = 0;
    rgba[i * 4 + 3] = 255;
  }
  return { size, rgba };
}

const PARIS = { lat: 48.8566, lon: 2.3522 };

describe('elevation source', () => {
  it('resolves heightAt through an injected loader', async () => {
    const src = createElevationSource({ loadTile: async () => makeTile(4, 100) });
    const h = await src.heightAt(PARIS.lat, PARIS.lon);
    expect(h).toBeCloseTo(100, 3);
  });

  it('returns null from heightAtCached before the tile loads, value after', async () => {
    const src = createElevationSource({ loadTile: async () => makeTile(4, 100) });
    expect(src.heightAtCached(PARIS.lat, PARIS.lon)).toBeNull();
    await src.heightAt(PARIS.lat, PARIS.lon);
    expect(src.heightAtCached(PARIS.lat, PARIS.lon)).toBeCloseTo(100, 3);
  });

  it('classifies water from cached elevation', async () => {
    const land = createElevationSource({ loadTile: async () => makeTile(4, 100) });
    expect(land.isWater(PARIS.lat, PARIS.lon)).toBeNull(); // not loaded yet
    await land.heightAt(PARIS.lat, PARIS.lon);
    expect(land.isWater(PARIS.lat, PARIS.lon)).toBe(false);

    const sea = createElevationSource({ loadTile: async () => makeTile(4, -10) });
    await sea.heightAt(PARIS.lat, PARIS.lon);
    expect(sea.isWater(PARIS.lat, PARIS.lon)).toBe(true);
  });

  it('fetches each tile only once (dedupes concurrent + repeat calls)', async () => {
    let calls = 0;
    const src = createElevationSource({
      loadTile: async () => {
        calls++;
        return makeTile(4, 50);
      },
    });
    await Promise.all([
      src.heightAt(PARIS.lat, PARIS.lon),
      src.heightAt(PARIS.lat, PARIS.lon),
    ]);
    await src.heightAt(PARIS.lat, PARIS.lon);
    expect(calls).toBe(1);
  });

  it('prefetch warms the cache', async () => {
    const src = createElevationSource({ loadTile: async () => makeTile(4, 0) });
    expect(src.cacheSize).toBe(0);
    await src.prefetch([{ x: 1, y: 1, z: 5 }, { x: 2, y: 1, z: 5 }]);
    expect(src.cacheSize).toBe(2);
  });

  it('exposes a decoded tile via getTile', async () => {
    const src = createElevationSource({ loadTile: async () => makeTile(8, 42) });
    const tile = await src.getTile(5, 1, 1);
    expect(tile.size).toBe(8);
    expect(tile.heightmap).toBeInstanceOf(Float32Array);
    expect(tile.heightmap.length).toBe(64);
    expect(tile.heightmap[0]).toBeCloseTo(42, 3);
  });
});
