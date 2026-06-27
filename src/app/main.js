import { createScene } from '../render/scene.js';
import { createWorldFrame } from '../core/state/index.js';
import { makeProjection } from '../core/geo/index.js';
import { createElevationSource, loadTerrariumTile } from '../data/elevation/index.js';
import { createTileManager } from '../world/streaming/tileManager.js';

const START = { lat: 6.1725, lon: 1.2314 }; // Lomé, Togo
const ZOOM = 12;
const RADIUS = 3;
const GRID = 65;

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
addEventListener('keydown', (e) => keys.add(e.code));
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
  const speed = keys.has('ShiftLeft') ? 1200 : 400; // m/s
  let fwd = 0;
  if (keys.has('KeyW')) fwd += 1;
  if (keys.has('KeyS')) fwd -= 1;
  if (keys.has('KeyA')) yaw -= 1.5 * dt;
  if (keys.has('KeyD')) yaw += 1.5 * dt;
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
  const back = 350;
  const height = 220;
  camera.position.set(pw.x - fx * back, lastGroundY + height, pw.z - fz * back);
  camera.lookAt(pw.x + fx * back, lastGroundY + 40, pw.z + fz * back);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Surface a little state for verification.
window.__we = { tiles, player };
