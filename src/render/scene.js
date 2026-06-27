import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

/** Build the renderer, an atmospheric sky, sun-aligned lights, and matched fog. */
export function createScene({ canvas }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  // Filmic tone mapping — cohesive, cinematic color (pairs with the sky).
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.6;

  const scene = new THREE.Scene();

  // Physical sky: atmospheric scattering, real sun disc and horizon glow.
  const sky = new Sky();
  sky.scale.setScalar(450000); // renders at the far plane regardless of size
  scene.add(sky);
  const u = sky.material.uniforms;
  u.turbidity.value = 6;
  u.rayleigh.value = 2.4;
  u.mieCoefficient.value = 0.005;
  u.mieDirectionalG.value = 0.8;

  // Sun direction from elevation/azimuth (a pleasant mid-morning light).
  const sunDir = new THREE.Vector3();
  const elevation = 26; // degrees above the horizon
  const azimuth = 140;
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  sunDir.setFromSphericalCoords(1, phi, theta);
  u.sunPosition.value.copy(sunDir);

  // Lights aligned to the sun.
  const sunLight = new THREE.DirectionalLight(0xfff2e0, 3.0);
  sunLight.position.copy(sunDir).multiplyScalar(1000);
  scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0xbcd6ff, 0x4a5440, 0.7));

  // Fog tuned to the horizon haze so distant terrain melts into the sky.
  const haze = new THREE.Color(0xc3d4e6);
  scene.fog = new THREE.Fog(haze, 3000, 30000);

  const camera = new THREE.PerspectiveCamera(60, 1, 1, 48000);
  camera.position.set(0, 600, 800);

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, resize, sunLight };
}
