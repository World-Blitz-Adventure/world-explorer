import { makeProjection } from '../../core/geo/projection.js';
import { bilinearSample } from '../../data/elevation/sample.js';
import { biomeColor } from './biome.js';

/**
 * Build indexed terrain geometry in tile-local metres (offsets from box.nw).
 * No world origin here: the mesh is positioned in world space by the caller,
 * so geometry survives floating-origin rebases without rebuilding.
 */
export function buildTerrainGeometry(heightmap, size, box, grid) {
  const proj = makeProjection(box.nw);
  const positions = new Float32Array(grid * grid * 3);
  const colors = new Float32Array(grid * grid * 3);
  const latitude = (box.nw.lat + box.se.lat) / 2;

  const elevAt = (i, j) => {
    const gx = (i / (grid - 1)) * (size - 1);
    const gy = (j / (grid - 1)) * (size - 1);
    return bilinearSample(heightmap, size, gx, gy);
  };

  // metric spacing between adjacent grid nodes, for slope.
  const eastSpan = proj.toWorld({ lat: box.nw.lat, lon: box.se.lon }).east;
  const northSpan = -proj.toWorld({ lat: box.se.lat, lon: box.nw.lon }).north;
  const dx = Math.abs(eastSpan) / (grid - 1) || 1;
  const dz = Math.abs(northSpan) / (grid - 1) || 1;

  for (let j = 0; j < grid; j++) {
    const lat = box.nw.lat + (box.se.lat - box.nw.lat) * (j / (grid - 1));
    for (let i = 0; i < grid; i++) {
      const lon = box.nw.lon + (box.se.lon - box.nw.lon) * (i / (grid - 1));
      const { east, north } = proj.toWorld({ lat, lon });
      const elev = elevAt(i, j);
      const idx = (j * grid + i) * 3;
      positions[idx] = east;
      positions[idx + 1] = elev;
      positions[idx + 2] = -north;

      const dEdx =
        (elevAt(Math.min(grid - 1, i + 1), j) - elevAt(Math.max(0, i - 1), j)) / (2 * dx);
      const dEdz =
        (elevAt(i, Math.min(grid - 1, j + 1)) - elevAt(i, Math.max(0, j - 1))) / (2 * dz);
      const grad = Math.hypot(dEdx, dEdz);
      const slope = grad / (1 + grad);
      const [r, g, b] = biomeColor(elev, slope, latitude);
      colors[idx] = r;
      colors[idx + 1] = g;
      colors[idx + 2] = b;
    }
  }

  const indices = new Uint32Array((grid - 1) * (grid - 1) * 6);
  let k = 0;
  for (let j = 0; j < grid - 1; j++) {
    for (let i = 0; i < grid - 1; i++) {
      const a = j * grid + i;
      const b = a + 1;
      const c = a + grid;
      const d = c + 1;
      indices[k++] = a; indices[k++] = c; indices[k++] = b;
      indices[k++] = b; indices[k++] = c; indices[k++] = d;
    }
  }
  return { positions, colors, indices };
}
