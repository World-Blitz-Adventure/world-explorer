// Reverse geocoding via Nominatim (server-side). Cached on a ~1 km grid to stay
// well within Nominatim's 1 req/s policy.
const cache = new Map();

export async function place(lat, lon) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=12&accept-language=fr`;
    const r = await fetch(url, { headers: { 'User-Agent': 'WorldExplorer/0.1 (dev)' } });
    const d = await r.json();
    const a = d.address || {};
    const result = {
      place: a.city || a.town || a.village || a.municipality || a.county || a.state || a.country || null,
      country: a.country || null,
      code: (a.country_code || '').toUpperCase() || null,
    };
    cache.set(key, result);
    return result;
  } catch {
    return { place: null, country: null, code: null };
  }
}
