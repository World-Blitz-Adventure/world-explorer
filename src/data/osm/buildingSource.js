const DEFAULT_BASE = 'http://localhost:8787';

/** Fetches real OSM building tiles from the backend; caches, retries, degrades to null. */
export function createBuildingSource(opts = {}) {
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE;
  const doFetch = opts.fetchImpl ?? ((url) => fetch(url));
  const cache = new Map();
  const pending = new Map();
  let available = true;

  function getTile(z, x, y) {
    const key = `${z}/${x}/${y}`;
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    if (pending.has(key)) return pending.get(key);
    if (!available) return Promise.resolve(null);

    const p = doFetch(`${baseUrl}/buildings/${z}/${x}/${y}`)
      .then((r) => (r && r.ok ? r.json() : null))
      .then((tile) => {
        pending.delete(key);
        if (!tile || !tile.buildings) return null;
        if (!tile.stale) cache.set(key, tile);
        return tile;
      })
      .catch(() => {
        available = false;
        pending.delete(key);
        return null;
      });
    pending.set(key, p);
    return p;
  }

  return { getTile };
}
