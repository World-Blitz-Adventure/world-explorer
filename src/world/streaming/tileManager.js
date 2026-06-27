import { tileForLonLat, lonLatForTile } from '../../core/geo/tile.js';
import { buildTerrainGeometry } from '../terrain/buildTerrainGeometry.js';
import { createTerrainMesh, disposeTerrainMesh } from '../terrain/terrainMesh.js';
import { tilesAround } from './tiles.js';

// One worker, promise-keyed by id. Falls back to a sync build if Worker is absent.
let worker = null;
let seq = 0;
const waiting = new Map();
function getWorker() {
  if (worker === null && typeof Worker !== 'undefined') {
    worker = new Worker(new URL('../terrain/terrainWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, positions, colors, uvs, indices } = e.data;
      const resolve = waiting.get(id);
      if (resolve) {
        waiting.delete(id);
        resolve({ positions, colors, uvs, indices });
      }
    };
  }
  return worker;
}
function buildGeometryAsync(heightmap, size, box, grid) {
  const w = getWorker();
  if (!w) return Promise.resolve(buildTerrainGeometry(heightmap, size, box, grid));
  const id = ++seq;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    // Copy the heightmap so the transfer doesn't neuter the cached tile.
    const hm = heightmap.slice();
    w.postMessage({ id, heightmap: hm, size, box, grid }, [hm.buffer]);
  });
}

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
      const geo = await buildGeometryAsync(heightmap, size, { nw, se }, grid);
      if (loaded.has(key)) return; // raced; keep the existing one

      const mesh = createTerrainMesh(geo);
      const wp = worldFrame.toWorld(nw);
      mesh.position.set(wp.x, wp.y, wp.z);
      scene.add(mesh);
      loaded.set(key, mesh);
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
