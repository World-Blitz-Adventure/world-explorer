import { tileForLonLat, lonLatForTile } from '../../core/geo/tile.js';
import { buildRoadGroup } from '../roads/roadMesh.js';

/**
 * Streams OSM road tiles around the player and drapes them on the terrain.
 * Uses a small radius to stay gentle on the road backend (Overpass).
 */
export function createRoadManager({ scene, roadSource, elevation, worldFrame, zoom, radius }) {
  const loaded = new Map(); // key -> mesh | null (null = loaded, no roads)
  const inflight = new Set();
  const keyFor = (t) => `${t.z}/${t.x}/${t.y}`;

  async function load(t) {
    const key = keyFor(t);
    if (loaded.has(key) || inflight.has(key)) return;
    inflight.add(key);
    try {
      const data = await roadSource.getTile(t.z, t.x, t.y);
      if (loaded.has(key)) return;
      if (!data || !data.roads.length) {
        loaded.set(key, null);
        return;
      }
      const nw = lonLatForTile(t.x, t.y, t.z);
      const mesh = buildRoadGroup(data.roads, nw, elevation);
      const wp = worldFrame.toWorld(nw);
      mesh.position.set(wp.x, 0, wp.z);
      scene.add(mesh);
      loaded.set(key, mesh);
    } catch (err) {
      console.error('road tile failed', key, err);
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
      for (const [key, mesh] of loaded) {
        if (!neededKeys.has(key)) {
          if (mesh) {
            scene.remove(mesh);
            mesh.geometry.dispose();
          }
          loaded.delete(key);
        }
      }
    },
    applyRebase(shift) {
      for (const mesh of loaded.values()) {
        if (mesh) {
          mesh.position.x += shift.x;
          mesh.position.z += shift.z;
        }
      }
    },
  };
}
