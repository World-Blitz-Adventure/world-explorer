const DEFAULT_BASE = 'http://localhost:8787';

/** Reverse-geocodes the player's location via the backend; cached on a ~1 km grid. */
export function createPlaceSource(opts = {}) {
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE;
  const doFetch = opts.fetchImpl ?? ((url) => fetch(url));
  const cache = new Map();
  const pending = new Map();
  let available = true;

  function get(lat, lon) {
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    if (pending.has(key)) return pending.get(key);
    if (!available) return Promise.resolve(null);

    const p = doFetch(`${baseUrl}/place?lat=${lat}&lon=${lon}`)
      .then((r) => (r && r.ok ? r.json() : null))
      .then((d) => {
        if (d) cache.set(key, d);
        pending.delete(key);
        return d;
      })
      .catch(() => {
        available = false;
        pending.delete(key);
        return null;
      });
    pending.set(key, p);
    return p;
  }

  return { get };
}
