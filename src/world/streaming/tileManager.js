import { tileForLonLat, lonLatForTile } from '../../core/geo/tile.js';
import { buildTerrainGeometry } from '../terrain/buildTerrainGeometry.js';
import { createTerrainMesh, disposeTerrainMesh } from '../terrain/terrainMesh.js';
import { tilesAround } from './tiles.js';

/** Streams terrain tiles around the player; evicts the rest; rebases on demand. */
export function createTileManager({ scene, elevation, worldFrame, zoom, radius, grid }) {
  const loaded = new Map(); // key -> mesh
  const inflight = new Set();
  const keyFor = (t) => `${t.z}/${t.x}/${t.y}`;

  async function load(t) {
    const key = keyFor(t);
    if (loaded.has(key) || inflight.has(key)) return;
    inflight.add(key);
    try {
      const { size, heightmap } = await elevation.getTile(t.z, t.x, t.y);
      const nw = lonLatForTile(t.x, t.y, t.z);
      const se = lonLatForTile(t.x + 1, t.y + 1, t.z);
      const geo = buildTerrainGeometry(heightmap, size, { nw, se }, grid);
      const mesh = createTerrainMesh(geo);
      const wp = worldFrame.toWorld(nw);
      mesh.position.set(wp.x, wp.y, wp.z);
      if (loaded.has(key)) {
        disposeTerrainMesh(mesh); // raced; keep the existing one
      } else {
        scene.add(mesh);
        loaded.set(key, mesh);
      }
    } catch (err) {
      console.error('tile load failed', key, err);
    } finally {
      inflight.delete(key);
    }
  }

  return {
    update(playerLatLon) {
      const center = tileForLonLat(playerLatLon.lat, playerLatLon.lon, zoom);
      const needed = tilesAround(center, radius, zoom);
      const neededKeys = new Set(needed.map(keyFor));
      needed.forEach(load);
      for (const [key, mesh] of loaded) {
        if (!neededKeys.has(key)) {
          scene.remove(mesh);
          disposeTerrainMesh(mesh);
          loaded.delete(key);
        }
      }
    },
    applyRebase(shift) {
      for (const mesh of loaded.values()) {
        mesh.position.x += shift.x;
        mesh.position.z += shift.z;
      }
    },
    get count() {
      return loaded.size;
    },
  };
}
