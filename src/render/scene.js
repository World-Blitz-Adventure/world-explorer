import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** Build the renderer, an atmospheric sky, sun-aligned lights, and matched fog. */
export function createScene({ canvas }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  // Filmic tone mapping — cohesive, cinematic color (pairs with the sky).
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;
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

  // Sun direction — lower & warmer for golden-hour mood and long shadows.
  const sunDir = new THREE.Vector3();
  const elevation = 19; // degrees above the horizon
  const azimuth = 135;
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  sunDir.setFromSphericalCoords(1, phi, theta);
  u.sunPosition.value.copy(sunDir);

  // Lights aligned to the sun.
  const sunLight = new THREE.DirectionalLight(0xffe2b0, 3.3);
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
  scene.add(new THREE.HemisphereLight(0xcdd9ee, 0x5a513a, 0.55));

  // Fog tuned to the horizon haze so distant terrain melts into the sky.
  const haze = new THREE.Color(0xd6d2c6);
  scene.fog = new THREE.Fog(haze, 3000, 28000);

  const camera = new THREE.PerspectiveCamera(60, 1, 1, 48000);
  camera.position.set(0, 600, 800);

  // Cinematic post-processing: subtle bloom + filmic output.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // Ground-truth ambient occlusion — depth & contact darkening everywhere.
  const gtao = new GTAOPass(scene, camera, 1, 1);
  gtao.updateGtaoMaterial({ radius: 4, scale: 1.2, distanceExponent: 1, thickness: 2, samples: 16 });
  composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.08, 0.3, 1.6); // strength, radius, threshold (only the brightest)
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    gtao.setSize(w, h);
    bloom.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, composer, resize, sunLight, sunDir };
}
