import * as THREE from 'three';
import { makeProjection } from '../../core/geo/projection.js';

// Road width (metres) by OSM class.
const WIDTH = {
  motorway: 10, trunk: 9, primary: 7.5, secondary: 6.5, tertiary: 5.5,
  residential: 4, unclassified: 4, service: 3, living_street: 3,
};

const roadMat = new THREE.MeshLambertMaterial({
  color: 0x35363d,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -2, // sit on top of the terrain without z-fighting
});

/**
 * Build one mesh of all roads in a tile, draped on the terrain (tile-local
 * metres from `anchor`, y = terrain elevation + small lift). Positioned in
 * world space by the caller, like terrain.
 */
export function buildRoadGroup(roads, anchor, elevation) {
  const proj = makeProjection(anchor);
  const positions = [];
  const indices = [];
  let base = 0;

  for (const road of roads) {
    const hw = (WIDTH[road.type] || 4) / 2;
    const pts = road.pts.map(([lat, lon]) => {
      const y = elevation.heightAtCached(lat, lon);
      if (y == null) return null;
      const w = proj.toWorld({ lat, lon });
      return { x: w.east, y: y + 0.4, z: -w.north };
    });
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (!a || !b) continue;
      let dx = b.x - a.x;
      let dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      dx /= len;
      dz /= len;
      const px = -dz * hw;
      const pz = dx * hw;
      positions.push(
        a.x + px, a.y, a.z + pz,
        a.x - px, a.y, a.z - pz,
        b.x + px, b.y, b.z + pz,
        b.x - px, b.y, b.z - pz
      );
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      base += 4;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, roadMat);
  mesh.renderOrder = 1;
  return mesh;
}
