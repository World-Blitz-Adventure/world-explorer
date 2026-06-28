import { buildTerrainGeometry } from './buildTerrainGeometry.js';

self.onmessage = (e) => {
  const { id, heightmap, size, box, grid, landcover } = e.data;
  const geo = buildTerrainGeometry(heightmap, size, box, grid, landcover);
  self.postMessage({ id, ...geo }, [
    geo.positions.buffer,
    geo.colors.buffer,
    geo.uvs.buffer,
    geo.indices.buffer,
  ]);
};
