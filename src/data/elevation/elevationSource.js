import { tileFraction } from '../../core/geo/tile.js';
import { decodeHeightmap, SEA_LEVEL_M } from './terrarium.js';
import { bilinearSample } from './sample.js';
import { createTileCache } from './tileCache.js';
import { tileUrl, DEFAULT_URL_TEMPLATE } from './tileUrl.js';

export const DEFAULT_MAX_ZOOM = 12;
export const DEFAULT_CACHE_TILES = 256;

/**
 * Elevation lookup over streamed Terrarium tiles.
 * `loadTile(url) => Promise<{size, rgba}>` is injected (browser default in Task 6).
 */
export function createElevationSource(opts = {}) {
  const urlTemplate = opts.urlTemplate ?? DEFAULT_URL_TEMPLATE;
  const maxZoom = opts.maxZoom ?? DEFAULT_MAX_ZOOM;
  const loadTile = opts.loadTile;
  const cache = createTileCache(opts.cacheTiles ?? DEFAULT_CACHE_TILES);
  const pending = new Map();

  const keyFor = (z, x, y) => `${z}/${x}/${y}`;

  function ensureTile(z, x, y) {
    const key = keyFor(z, x, y);
    const cached = cache.get(key);
    if (cached) return Promise.resolve(cached);
    if (pending.has(key)) return pending.get(key);
    const promise = Promise.resolve(loadTile(tileUrl(urlTemplate, z, x, y))).then(
      ({ size, rgba }) => {
        const tile = { size, heightmap: decodeHeightmap(rgba, size) };
        cache.set(key, tile);
        pending.delete(key);
        return tile;
      }
    );
    pending.set(key, promise);
    return promise;
  }

  const sampleTile = (tile, fx, fy) =>
    bilinearSample(tile.heightmap, tile.size, fx * (tile.size - 1), fy * (tile.size - 1));

  function heightAtCached(lat, lon, z = maxZoom) {
    const { x, y, fx, fy } = tileFraction(lat, lon, z);
    const tile = cache.get(keyFor(z, x, y));
    return tile ? sampleTile(tile, fx, fy) : null;
  }

  function isWater(lat, lon, z = maxZoom) {
    const h = heightAtCached(lat, lon, z);
    return h === null ? null : h <= SEA_LEVEL_M;
  }

  return {
    async heightAt(lat, lon, z = maxZoom) {
      const { x, y, fx, fy } = tileFraction(lat, lon, z);
      const tile = await ensureTile(z, x, y);
      return sampleTile(tile, fx, fy);
    },
    heightAtCached,
    isWater,
    async prefetch(tiles) {
      await Promise.all(tiles.map(({ x, y, z }) => ensureTile(z, x, y)));
    },
    get cacheSize() {
      return cache.size;
    },
  };
}
