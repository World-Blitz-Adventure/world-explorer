import * as THREE from 'three';
import { createGroundTextures } from './texturePacks.js';

const { flat, steep } = createGroundTextures();

// Smooth-shaded, vertex-colored (biome hue). A shader injection blends a grassy
// detail texture on flat ground and a rocky one on steep slopes — so the ground
// reads like grass where it's flat and rock where it's steep.
const TERRAIN_MATERIAL = new THREE.MeshLambertMaterial({
  vertexColors: true,
  side: THREE.DoubleSide,
});
TERRAIN_MATERIAL.onBeforeCompile = (shader) => {
  shader.uniforms.uFlat = { value: flat };
  shader.uniforms.uSteep = { value: steep };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec2 vGuv;\nvarying float vSlope;')
    .replace(
      '#include <beginnormal_vertex>',
      '#include <beginnormal_vertex>\nvGuv = uv;\nvSlope = clamp(1.0 - normalize(mat3(modelMatrix) * objectNormal).y, 0.0, 1.0);'
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      '#include <common>\nuniform sampler2D uFlat;\nuniform sampler2D uSteep;\nvarying vec2 vGuv;\nvarying float vSlope;'
    )
    .replace(
      '#include <color_fragment>',
      '#include <color_fragment>\nfloat rk = smoothstep(0.35, 0.72, vSlope);\nvec3 det = mix(texture2D(uFlat, vGuv).rgb, texture2D(uSteep, vGuv).rgb, rk);\ndiffuseColor.rgb *= det * 1.55;'
    );
};

/** Turn tile-local geometry buffers into a positioned-by-caller mesh. */
export function createTerrainMesh({ positions, colors, uvs, indices }) {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));
  geom.computeVertexNormals();
  geom.computeBoundingSphere();
  const mesh = new THREE.Mesh(geom, TERRAIN_MATERIAL);
  mesh.receiveShadow = true;
  return mesh;
}

export function disposeTerrainMesh(mesh) {
  mesh.geometry.dispose();
}
