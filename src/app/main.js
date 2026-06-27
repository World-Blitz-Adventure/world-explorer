import { createScene } from '../render/scene.js';
import { createWorldFrame } from '../core/state/index.js';
import { createElevationSource, loadTerrariumTile } from '../data/elevation/index.js';
import { createTileManager } from '../world/streaming/tileManager.js';
import { createLocomotion } from '../entities/locomotion/locomotion.js';
import { createAvatars } from '../entities/avatars.js';
import { createFollowCamera } from '../entities/camera/followCamera.js';

// Temporary demo start in the Chamonix valley (Alps) — mountains all around,
// which frames the embodied third-person view well. The real start point
// (geolocation / your own choice) arrives with the start-anywhere layer.
const START = { lat: 45.9237, lon: 6.8694 };
const ZOOM = 13;
const RADIUS = 3;
const GRID = 129;

const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block';
document.getElementById('app').appendChild(canvas);

const { renderer, scene, camera } = createScene({ canvas });
const worldFrame = createWorldFrame(START);
const elevation = createElevationSource({ loadTile: loadTerrariumTile, maxZoom: ZOOM });
const tiles = createTileManager({ scene, elevation, worldFrame, zoom: ZOOM, radius: RADIUS, grid: GRID });
const loco = createLocomotion({ start: START });
const avatars = createAvatars(scene);
const follow = createFollowCamera(camera);

// Controls: WASD / ZQSD / arrows to move, drag to orbit, F enter/exit car,
// R recall car, Shift toggles run.
let orbit = 0;
let pitch = 0.35; // vertical look; raised by dragging down, lowered by dragging up
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyF') loco.inCar ? loco.exitCar() : loco.enterCar();
  if (e.code === 'KeyR') loco.recallCar();
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') loco.toggleRun();
  keys.add(e.code);
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
let dragging = false;
canvas.addEventListener('pointerdown', () => (dragging = true));
addEventListener('pointerup', () => (dragging = false));
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  orbit += e.movementX * 0.005;
  pitch += e.movementY * 0.004; // drag down → look down at feet; up → toward horizon
  pitch = Math.max(-0.5, Math.min(1.2, pitch));
});

// Preload the start tile so we spawn on the ground, not in the sky.
let lastGroundY = await elevation.heightAt(START.lat, START.lon);

let prev = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;

  let forward = 0;
  if (keys.has('KeyW') || keys.has('KeyZ') || keys.has('ArrowUp')) forward += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= 1;
  let turn = 0;
  if (keys.has('KeyA') || keys.has('KeyQ') || keys.has('ArrowLeft')) turn -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) turn += 1;
  loco.update(dt, { forward, turn });

  tiles.update(loco.position);
  const shift = worldFrame.maybeRebase(loco.position);
  if (shift) {
    tiles.applyRebase(shift);
    follow.shift(shift);
  }

  const groundY = elevation.heightAtCached(loco.position.lat, loco.position.lon);
  if (groundY != null) lastGroundY = groundY;
  const pw = worldFrame.toWorld(loco.position);
  const target = { x: pw.x, y: lastGroundY, z: pw.z };

  // Person stands at the player when on foot.
  avatars.setPerson(target, loco.heading);
  avatars.showPerson(!loco.inCar);

  // Car sits at its own position when left behind, or at the player while driving.
  const carLL = loco.inCar ? loco.position : loco.car;
  const carGroundY = elevation.heightAtCached(carLL.lat, carLL.lon);
  const cw = worldFrame.toWorld(carLL);
  avatars.setCar({ x: cw.x, y: carGroundY != null ? carGroundY : lastGroundY, z: cw.z }, loco.heading);

  follow.update({ target, headingRad: loco.heading, mode: loco.mode, groundY: lastGroundY, orbit, pitch, dt });

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Surface state for verification.
window.__we = {
  loco,
  tiles,
  camera,
  elevation,
  get groundY() {
    return lastGroundY;
  },
};
