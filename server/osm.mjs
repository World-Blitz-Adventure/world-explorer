// Roads from OpenStreetMap via Overpass, server-side (no browser CORS/limits).
const cache = new Map(); // "z/x/y" -> { roads }
const pending = new Map();

// Mirrors are tried in order; rate-limited/erroring ones fall through.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const ROAD_RE = '^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|service|living_street)$';

async function overpass(query) {
  for (const url of ENDPOINTS) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
      });
      const text = await r.text();
      if (!r.ok || text[0] !== '{') continue; // rate-limited / HTML error page
      return JSON.parse(text);
    } catch {
      /* try next mirror */
    }
  }
  return null; // all mirrors failed
}

function tileBBox(z, x, y) {
  const n = 2 ** z;
  const lon = (xx) => (xx / n) * 360 - 180;
  const lat = (yy) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * yy) / n))) * 180) / Math.PI;
  return { north: lat(y), south: lat(y + 1), west: lon(x), east: lon(x + 1) };
}

const bCache = new Map();
const bPending = new Map();

function parseHeight(t) {
  if (t.height) {
    const h = parseFloat(t.height);
    if (h > 0) return h;
  }
  if (t['building:levels']) {
    const l = parseFloat(t['building:levels']);
    if (l > 0) return l * 3.2;
  }
  return 9; // sensible default
}

/** Real OSM building footprints (+ height) for a web-mercator tile. */
export async function buildingsTile(z, x, y) {
  const key = `${z}/${x}/${y}`;
  if (bCache.has(key)) return bCache.get(key);
  if (bPending.has(key)) return bPending.get(key);

  const bb = tileBBox(z, x, y);
  const q = `[out:json][timeout:25];way[building](${bb.south},${bb.west},${bb.north},${bb.east});out geom;`;
  const p = overpass(q).then((d) => {
    if (!d) {
      bPending.delete(key);
      return { buildings: [], stale: true };
    }
    const buildings = (d.elements || [])
      .filter((e) => e.type === 'way' && e.geometry && e.geometry.length >= 4)
      .slice(0, 2500) // bound dense city tiles
      .map((w) => ({
        pts: w.geometry.map((g) => [g.lat, g.lon]),
        height: parseHeight(w.tags || {}),
      }));
    const result = { buildings };
    bCache.set(key, result);
    bPending.delete(key);
    return result;
  });
  bPending.set(key, p);
  return p;
}

/** Real OSM roads for a web-mercator tile: [{ type, name, pts: [[lat,lon],...] }]. */
export async function roadsTile(z, x, y) {
  const key = `${z}/${x}/${y}`;
  if (cache.has(key)) return cache.get(key);
  if (pending.has(key)) return pending.get(key);

  const bb = tileBBox(z, x, y);
  const q = `[out:json][timeout:25];way[highway~"${ROAD_RE}"](${bb.south},${bb.west},${bb.north},${bb.east});out geom;`;
  const p = overpass(q).then((d) => {
    if (!d) {
      pending.delete(key);
      return { roads: [], stale: true }; // don't cache a failure; let it retry later
    }
    const roads = (d.elements || [])
      .filter((e) => e.type === 'way' && e.geometry)
      .map((w) => ({
        type: w.tags.highway,
        name: w.tags.name || null,
        pts: w.geometry.map((g) => [g.lat, g.lon]),
      }));
    const result = { roads };
    cache.set(key, result);
    pending.delete(key);
    return result;
  });
  pending.set(key, p);
  return p;
}
