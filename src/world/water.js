import * as THREE from 'three';

const vertexShader = `
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragmentShader = `
  precision highp float;
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSun;
  varying vec3 vWorld;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorld);
    // gentle moving ripples perturbing the normal
    float w = sin(vWorld.x * 0.04 + uTime) * 0.5 + cos(vWorld.z * 0.05 - uTime * 0.8) * 0.5;
    float w2 = sin(vWorld.x * 0.011 - uTime * 0.4) * cos(vWorld.z * 0.013 + uTime * 0.3);
    vec3 nrm = normalize(vec3(0.05 * w + 0.02 * w2, 1.0, 0.05 * w - 0.02 * w2));
    float fres = pow(1.0 - clamp(dot(viewDir, nrm), 0.0, 1.0), 3.0);
    vec3 col = mix(uDeep, uShallow, clamp(fres, 0.0, 1.0));
    // sun glint
    vec3 refl = reflect(-normalize(uSun), nrm);
    float glint = pow(max(dot(viewDir, refl), 0.0), 90.0);
    col += vec3(1.0, 0.96, 0.85) * glint * 0.7;
    gl_FragColor = vec4(col, 0.9);
  }
`;

/**
 * A sea-level water surface (y = 0). Renders ocean/sea wherever the terrain
 * dips below sea level; follows the player horizontally so it always fills the
 * view. Lakes/rivers above sea level come later with OSM water data.
 */
export function createWater(scene, sunDir) {
  const geo = new THREE.PlaneGeometry(90000, 90000);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x0a2740) },
      uShallow: { value: new THREE.Color(0x8fc4dc) },
      uSun: { value: sunDir.clone() },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2; // lie flat, normal up
  mesh.position.y = 0.1; // just above sea level to avoid z-fighting
  mesh.renderOrder = 1;
  scene.add(mesh);

  return {
    update(time, playerWorld) {
      mat.uniforms.uTime.value = time;
      mesh.position.x = playerWorld.x;
      mesh.position.z = playerWorld.z;
    },
  };
}
