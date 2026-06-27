import * as THREE from 'three';
import { createGroundTexture } from './groundTexture.js';

// One shared material: smooth-shaded, vertex-colored, with a tiled detail map
// (grain × biome tint) so the ground reads textured instead of flat.
const TERRAIN_MATERIAL = new THREE.MeshLambertMaterial({
  vertexColors: true,
  map: createGroundTexture(),
  flatShading: false,
  side: THREE.DoubleSide,
});

/** Turn tile-local geometry buffers into a positioned-by-caller mesh. */
export function createTerrainMesh({ positions, colors, uvs, indices }) {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));
  geom.computeVertexNormals(); // smooth normals for soft, Slow-Roads-like shading
  geom.computeBoundingSphere();
  return new THREE.Mesh(geom, TERRAIN_MATERIAL);
}

export function disposeTerrainMesh(mesh) {
  mesh.geometry.dispose();
}
