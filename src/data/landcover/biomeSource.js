const DEFAULT_BASE = 'http://localhost:8787';

/**
 * Fetches real landcover biome tiles from the geo-data backend. Caches results
 * and degrades gracefully: if the server is unreachable, it stops trying and
 * returns null, so the client falls back to the pure climate model.
 */
export function createBiomeSource(opts = {}) {
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE;
  const doFetch = opts.fetchImpl ?? ((url) => fetch(url));
  const cache = new Map(); // "z/x/y" -> {size, classes} | null
  const pending = new Map();
  let available = true;

  function getTile(z, x, y) {
    const key = `${z}/${x}/${y}`;
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    if (pending.has(key)) return pending.get(key);
    if (!available) return Promise.resolve(null);

    const p = doFetch(`${baseUrl}/biome/${z}/${x}/${y}`)
      .then((r) => (r && r.ok ? r.json() : null))
      .then((tile) => {
        cache.set(key, tile);
        pending.delete(key);
        return tile;
      })
      .catch(() => {
        available = false; // server down — stop hammering it
        cache.set(key, null);
        pending.delete(key);
        return null;
      });
    pending.set(key, p);
    return p;
  }

  return { getTile };
}
