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

  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-1, 2, 1);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x47553c, 1.0));

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
