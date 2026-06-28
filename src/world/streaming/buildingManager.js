import { tileForLonLat, lonLatForTile } from '../../core/geo/tile.js';
import { buildBuildingGroup, disposeBuildingMesh } from '../buildings/buildingMesh.js';

// Footprint + lat/lon bounding box, for fast collision tests.
function withBBox(b) {
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  for (const [la, lo] of b.pts) {
    if (la < minLat) minLat = la;
    if (la > maxLat) maxLat = la;
    if (lo < minLon) minLon = lo;
    if (lo > maxLon) maxLon = lo;
  }
  return { pts: b.pts, minLat, maxLat, minLon, maxLon };
}

// Ray-casting point-in-polygon (lon = x, lat = y).
function inside(lat, lon, pts) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [yi, xi] = pts[i];
    const [yj, xj] = pts[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Streams OSM building tiles around the player and extrudes them on the terrain. */
export function createBuildingManager({ scene, buildingSource, elevation, worldFrame, zoom, radius }) {
  const loaded = new Map(); // key -> { mesh, foots } | null
  const inflight = new Set();
  const keyFor = (t) => `${t.z}/${t.x}/${t.y}`;

  async function load(t) {
    const key = keyFor(t);
    if (loaded.has(key) || inflight.has(key)) return;
    inflight.add(key);
    try {
      const data = await buildingSource.getTile(t.z, t.x, t.y);
      if (loaded.has(key)) return;
      if (!data || !data.buildings.length) {
        loaded.set(key, null);
        return;
      }
      const nw = lonLatForTile(t.x, t.y, t.z);
      const mesh = buildBuildingGroup(data.buildings, nw, elevation);
      if (!mesh) {
        loaded.set(key, null);
        return;
      }
      const wp = worldFrame.toWorld(nw);
      mesh.position.set(wp.x, 0, wp.z);
      scene.add(mesh);
      loaded.set(key, { mesh, foots: data.buildings.map(withBBox) });
    } catch (err) {
      console.error('building tile failed', key, err);
    } finally {
      inflight.delete(key);
    }
  }

  return {
    update(playerLatLon) {
      const c = tileForLonLat(playerLatLon.lat, playerLatLon.lon, zoom);
      const needed = [];
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          needed.push({ x: c.x + dx, y: c.y + dy, z: zoom });
        }
      }
      const neededKeys = new Set(needed.map(keyFor));
      needed.forEach(load);
      for (const [key, entry] of loaded) {
        if (!neededKeys.has(key)) {
          if (entry) {
            scene.remove(entry.mesh);
            disposeBuildingMesh(entry.mesh);
          }
          loaded.delete(key);
        }
      }
    },
    // True if (lat, lon) is inside any loaded building footprint.
    blocks(lat, lon) {
      for (const entry of loaded.values()) {
        if (!entry) continue;
        for (const f of entry.foots) {
          if (lat < f.minLat || lat > f.maxLat || lon < f.minLon || lon > f.maxLon) continue;
          if (inside(lat, lon, f.pts)) return true;
        }
      }
      return false;
    },
    applyRebase(shift) {
      for (const entry of loaded.values()) {
        if (entry) {
          entry.mesh.position.x += shift.x;
          entry.mesh.position.z += shift.z;
        }
      }
    },
  };
}
