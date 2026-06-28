import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** Build the renderer, an atmospheric sky, sun-aligned lights, and matched fog. */
export function createScene({ canvas }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  // Filmic tone mapping — cohesive, cinematic color (pairs with the sky).
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.6;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
  sunLight.position.copy(sunDir).multiplyScalar(900);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  const sc = sunLight.shadow.camera;
  sc.left = -380;
  sc.right = 380;
  sc.top = 380;
  sc.bottom = -380;
  sc.near = 1;
  sc.far = 2200;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.6;
  scene.add(sunLight, sunLight.target);
  scene.add(new THREE.HemisphereLight(0xbcd6ff, 0x4a5440, 0.7));

  // Fog tuned to the horizon haze so distant terrain melts into the sky.
  const haze = new THREE.Color(0xc3d4e6);
  scene.fog = new THREE.Fog(haze, 3000, 30000);

  const camera = new THREE.PerspectiveCamera(60, 1, 1, 48000);
  camera.position.set(0, 600, 800);

  // Cinematic post-processing: subtle bloom + filmic output.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.12, 0.35, 1.4); // strength, radius, threshold (only bright highlights)
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, composer, resize, sunLight, sunDir };
}
