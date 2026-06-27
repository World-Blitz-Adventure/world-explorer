import * as THREE from 'three';

/** Build the renderer, scene, camera, lights, and fog. */
export function createScene({ canvas }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

  const scene = new THREE.Scene();
  const sky = new THREE.Color(0x9fc9ff);
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 2500, 20000);

  const camera = new THREE.PerspectiveCamera(60, 1, 1, 40000);
  camera.position.set(0, 600, 800);

  const sun = new THREE.DirectionalLight(0xfff4e0, 2.9);
  sun.position.set(-1, 1.6, 0.8);
  scene.add(sun);
  // Lower fill so slopes keep contrast and the relief reads crisply.
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x47553c, 0.55));

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, resize };
}
