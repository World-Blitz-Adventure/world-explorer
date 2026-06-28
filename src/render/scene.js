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

  const sunDir = new THREE.Vector3();
  const sunLight = new THREE.DirectionalLight(0xffe2b0, 3.3);
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
  const hemi = new THREE.HemisphereLight(0xcdd9ee, 0x5a513a, 0.55);
  scene.add(hemi);

  scene.fog = new THREE.Fog(new THREE.Color(0xd6d2c6), 3000, 28000);

  const FOG_NIGHT = new THREE.Color(0x0e1320);
  const FOG_DUSK = new THREE.Color(0xd6975a);
  const FOG_DAY = new THREE.Color(0xd6d2c6);
  const _f = new THREE.Color();
  const clamp = THREE.MathUtils.clamp;

  // Set the sun by elevation/azimuth and grade lights/fog to match the time of day.
  function updateSun(elev, az) {
    const phi = THREE.MathUtils.degToRad(90 - elev);
    const theta = THREE.MathUtils.degToRad(az);
    sunDir.setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(sunDir);

    const day = clamp(elev / 10, 0, 1); // 0 at/below horizon → 1 once up
    const high = clamp(elev / 35, 0, 1); // 0 low → 1 near noon
    sunLight.color.setRGB(1, 0.5 + 0.45 * high, 0.28 + 0.6 * high); // orange low → warm-white high
    sunLight.intensity = 3.5 * day;
    hemi.intensity = 0.08 + 0.5 * day;
    // Lower exposure at dusk/night so the bright sky doesn't wash out; bright at noon.
    renderer.toneMappingExposure = 0.28 + 0.27 * high;

    if (elev <= 2) _f.copy(FOG_NIGHT).lerp(FOG_DUSK, clamp((elev + 6) / 8, 0, 1));
    else _f.copy(FOG_DUSK).lerp(FOG_DAY, clamp((elev - 2) / 14, 0, 1));
    scene.fog.color.copy(_f);
  }
  updateSun(19, 135);

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

  return { renderer, scene, camera, composer, resize, sunLight, sunDir, updateSun };
}
