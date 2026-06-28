import { tileForLonLat, lonLatForTile } from '../../core/geo/tile.js';
import { buildBuildingGroup, disposeBuildingMesh } from '../buildings/buildingMesh.js';

/** Streams OSM building tiles around the player and extrudes them on the terrain. */
export function createBuildingManager({ scene, buildingSource, elevation, worldFrame, zoom, radius }) {
  const loaded = new Map(); // key -> mesh | null
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
      loaded.set(key, mesh);
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
      for (const [key, mesh] of loaded) {
        if (!neededKeys.has(key)) {
          if (mesh) {
            scene.remove(mesh);
            disposeBuildingMesh(mesh);
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
