import { createScene } from '../render/scene.js';
import { createWorldFrame } from '../core/state/index.js';
import { makeProjection } from '../core/geo/index.js';
import { createElevationSource, loadTerrariumTile } from '../data/elevation/index.js';
import { createTileManager } from '../world/streaming/tileManager.js';

// Temporary demo start with dramatic real relief (Mont Blanc, Alps) so the
// terrain can be judged on more than flat coastal plain. The real start point
// (geolocation / your own choice) arrives with the start-anywhere layer.
const START = { lat: 45.8326, lon: 6.8652 };
const ZOOM = 12;
const RADIUS = 3;
const GRID = 97;

const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block';
document.getElementById('app').appendChild(canvas);

const { renderer, scene, camera } = createScene({ canvas });
const worldFrame = createWorldFrame(START);
const elevation = createElevationSource({ loadTile: loadTerrariumTile, maxZoom: ZOOM });
const tiles = createTileManager({ scene, elevation, worldFrame, zoom: ZOOM, radius: RADIUS, grid: GRID });

// Fly camera state: player ground position (lat/lon) + heading.
const player = { ...START };
let yaw = 0; // radians, 0 = looking north
const keys = new Set();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code.startsWith('Arrow')) e.preventDefault(); // don't scroll the page
});
addEventListener('keyup', (e) => keys.delete(e.code));
let dragging = false;
canvas.addEventListener('pointerdown', () => (dragging = true));
addEventListener('pointerup', () => (dragging = false));
addEventListener('pointermove', (e) => {
  if (dragging) yaw += e.movementX * 0.005;
});

let lastGroundY = 0;
let prev = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;

  // Move the player across the real surface.
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1200 : 400; // m/s
  let fwd = 0;
  // QWERTY (WASD), AZERTY (ZQSD), and arrow keys all work.
  if (keys.has('KeyW') || keys.has('KeyZ') || keys.has('ArrowUp')) fwd += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) fwd -= 1;
  if (keys.has('KeyA') || keys.has('KeyQ') || keys.has('ArrowLeft')) yaw -= 1.5 * dt;
  if (keys.has('KeyD') || keys.has('ArrowRight')) yaw += 1.5 * dt;
  if (fwd !== 0) {
    const east = Math.sin(yaw) * fwd * speed * dt;
    const north = Math.cos(yaw) * fwd * speed * dt;
    const next = makeProjection(player).toLatLon(east, north);
    player.lat = next.lat;
    player.lon = next.lon;
  }

  tiles.update(player);
  const shift = worldFrame.maybeRebase(player);
  if (shift) tiles.applyRebase(shift);

  // Place the camera behind/above the player, looking along the heading.
  const pw = worldFrame.toWorld(player);
  const groundY = elevation.heightAtCached(player.lat, player.lon);
  if (groundY != null) lastGroundY = groundY;
  const fx = Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const back = 600;
  const height = 420;
  camera.position.set(pw.x - fx * back, lastGroundY + height, pw.z - fz * back);
  camera.lookAt(pw.x + fx * back, lastGroundY + 20, pw.z + fz * back);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Surface a little state for verification.
window.__we = { tiles, player };
