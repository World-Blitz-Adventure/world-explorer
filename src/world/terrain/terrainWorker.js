import { buildTerrainGeometry } from './buildTerrainGeometry.js';

self.onmessage = (e) => {
  const { id, heightmap, size, box, grid } = e.data;
  const geo = buildTerrainGeometry(heightmap, size, box, grid);
  self.postMessage({ id, ...geo }, [geo.positions.buffer, geo.colors.buffer, geo.indices.buffer]);
};
