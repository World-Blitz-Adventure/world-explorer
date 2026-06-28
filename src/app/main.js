import { createScene } from '../render/scene.js';
import { createHUD } from '../render/hud.js';
import { createGlobe } from '../render/globe.js';
import { haversine, makeProjection } from '../core/geo/index.js';
import { createWorldFrame } from '../core/state/index.js';
import { createElevationSource, loadTerrariumTile } from '../data/elevation/index.js';
import { createBiomeSource } from '../data/landcover/biomeSource.js';
import { createRoadSource } from '../data/osm/roadSource.js';
import { createBuildingSource } from '../data/osm/buildingSource.js';
import { createPlaceSource } from '../data/osm/placeSource.js';
import { capitalOf } from '../data/capitals.js';
import { createTileManager } from '../world/streaming/tileManager.js';
import { createRoadManager } from '../world/streaming/roadManager.js';
import { createBuildingManager } from '../world/streaming/buildingManager.js';
import { createLocomotion } from '../entities/locomotion/locomotion.js';
import { createAvatars } from '../entities/avatars.js';
import { createFollowCamera } from '../entities/camera/followCamera.js';
import { createWater } from '../world/water.js';
import { createStartScreen } from './startScreen.js';

const ZOOM = 13;
const RADIUS = 4; // wider so the open sea loads around coastal demos
const GRID = 113;

/** Boot the world at a chosen start point (lat/lon). */
async function startWorld(START) {
const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block';
document.getElementById('app').appendChild(canvas);

const { renderer, scene, camera, composer, sunLight } = createScene({ canvas });
const worldFrame = createWorldFrame(START);
const elevation = createElevationSource({ loadTile: loadTerrariumTile, maxZoom: ZOOM });
const biomeSource = createBiomeSource();
const tiles = createTileManager({ scene, elevation, biomeSource, worldFrame, zoom: ZOOM, radius: RADIUS, grid: GRID });
const roadSource = createRoadSource();
const roads = createRoadManager({ scene, roadSource, elevation, worldFrame, zoom: ZOOM, radius: 1 });
const buildingSource = createBuildingSource();
const buildings = createBuildingManager({ scene, buildingSource, elevation, worldFrame, zoom: ZOOM, radius: 1 });
const loco = createLocomotion({ start: START });
const avatars = createAvatars(scene);
const follow = createFollowCamera(camera);
const water = createWater(scene, sunLight.position.clone().normalize());
const hud = createHUD();
const globe = createGlobe();
const placeSource = createPlaceSource();
let placeInfo = null;
let placeCell = '';

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

let elapsed = 0;
let totalMeters = 0; // real distance travelled (odometer)
const prevPos = { ...START };
let prev = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  elapsed += dt;

  let forward = 0;
  if (keys.has('KeyW') || keys.has('KeyZ') || keys.has('ArrowUp')) forward += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= 1;
  let turn = 0;
  if (keys.has('KeyA') || keys.has('KeyQ') || keys.has('ArrowLeft')) turn -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) turn += 1;
  loco.update(dt, { forward, turn });

  totalMeters += haversine(prevPos, loco.position);
  prevPos.lat = loco.position.lat;
  prevPos.lon = loco.position.lon;

  tiles.update(loco.position);
  roads.update(loco.position);
  buildings.update(loco.position);
  const shift = worldFrame.maybeRebase(loco.position);
  if (shift) {
    tiles.applyRebase(shift);
    roads.applyRebase(shift);
    buildings.applyRebase(shift);
    follow.shift(shift);
  }

  const groundY = elevation.heightAtCached(loco.position.lat, loco.position.lon);
  if (groundY != null) lastGroundY = groundY;
  const pw = worldFrame.toWorld(loco.position);
  const target = { x: pw.x, y: lastGroundY, z: pw.z };
  water.update(elapsed, pw);

  // Person stands at the player when on foot.
  avatars.setPerson(target, loco.heading);
  avatars.showPerson(!loco.inCar);
  avatars.animatePerson({ speed: loco.inCar ? 0 : Math.abs(loco.speed), dt });

  // Car sits at its own position when left behind, or at the player while driving.
  const carLL = loco.inCar ? loco.position : loco.car;
  const carHeading = loco.inCar ? loco.heading : loco.car.heading;
  const carGroundY = elevation.heightAtCached(carLL.lat, carLL.lon);
  const cw = worldFrame.toWorld(carLL);
  avatars.setCar({ x: cw.x, y: carGroundY != null ? carGroundY : lastGroundY, z: cw.z }, carHeading);
  avatars.animateCar({ speed: loco.inCar ? loco.speed : 0, steer: loco.inCar ? turn : 0, dt });

  follow.update({ target, headingRad: loco.heading, mode: loco.mode, groundY: lastGroundY, orbit, pitch, dt });

  // Never let the camera sink below the terrain at its own location.
  const camLL = makeProjection(worldFrame.origin).toLatLon(camera.position.x, -camera.position.z);
  const camGround = elevation.heightAtCached(camLL.lat, camLL.lon);
  if (camGround != null && camera.position.y < camGround + 3) camera.position.y = camGround + 3;

  hud.update({
    speedKmh: Math.abs(loco.speed) * 3.6,
    totalKm: totalMeters / 1000,
    mode: loco.mode,
    headingDeg: (loco.heading * 180) / Math.PI,
    lat: loco.position.lat,
    lon: loco.position.lon,
  });
  globe.update(loco.position.lat, loco.position.lon);

  // Reverse-geocode when we cross into a new ~1 km cell.
  const cell = `${loco.position.lat.toFixed(2)},${loco.position.lon.toFixed(2)}`;
  if (cell !== placeCell) {
    placeCell = cell;
    placeSource.get(loco.position.lat, loco.position.lon).then((p) => {
      if (p) placeInfo = p;
    });
  }
  let capitalLabel = null;
  if (placeInfo) {
    const cap = capitalOf(placeInfo.code);
    if (cap) {
      const km = haversine(loco.position, cap) / 1000;
      capitalLabel = km < 5 ? `${cap.name} (capitale)` : `à ${Math.round(km)} km de ${cap.name}`;
    }
  }
  hud.update({
    speedKmh: Math.abs(loco.speed) * 3.6,
    totalKm: totalMeters / 1000,
    mode: loco.mode,
    headingDeg: (loco.heading * 180) / Math.PI,
    lat: loco.position.lat,
    lon: loco.position.lon,
    place: placeInfo?.place,
    country: placeInfo?.country,
    capital: capitalLabel,
  });

  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Surface state for verification (incl. a manual render to inspect when the
// tab's rAF loop is throttled in the background).
window.__we = {
  loco,
  tiles,
  roads,
  buildings,
  camera,
  elevation,
  renderer,
  scene,
  globe,
  get groundY() {
    return lastGroundY;
  },
  renderOnce: () => composer.render(),
};
}

// Choose where on Earth to begin, then boot the world there.
createStartScreen((loc) => startWorld(loc));
