# Lot 4 — Land Locomotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move through the world on land — drive, walk, run — and leave / recall the car, replacing the free-fly camera with an embodied player (V1-SPEC §9 step 4 / §5 land clauses).

**Architecture:** A pure, Node-tested locomotion state machine (`entities/locomotion`) holds the player's lat/lon, heading, mode, and the car's persisted lat/lon; `update(dt, input)` advances position via the Lot 1 projection. Thin Three.js shells add visible avatars (a simple car and a person) and a per-mode follow camera, wired in `app/main.js`. Water modes (swim/boat) are explicitly Lot 5.

**Tech Stack:** Three.js, Vite, Vitest. Depends on Lots 1–3.

## Global Constraints

- **Sole author, no AI trailer.** Authored by Abdou-Raouf ATARMLA; never a `Co-Authored-By:` / AI line.
- **Conventional Commits**, scopes `loco`, `app`, `render`.
- **lat/lon is truth.** Player and car positions are lat/lon; world placement via `worldFrame.toWorld`.
- **Pure state machine.** `entities/locomotion` imports only `core/geo` (projection, haversine) — no Three.js, fully Node-tested.
- **Land only this lot.** Modes: `WALKING`, `RUNNING`, `DRIVING`. Swim/boat deferred to Lot 5.
- **Speeds (m/s):** walk 2.5, run 6, drive 28. **Turn (rad/s):** on foot 2.4, driving 1.2. **Enter-car distance:** 12 m.

---

### Task 1: Locomotion state machine (pure)

**Files:**
- Create: `src/entities/locomotion/locomotion.js`
- Test: `src/entities/locomotion/__tests__/locomotion.test.js`

**Interfaces:**
- Consumes: `makeProjection` from `../../core/geo/projection.js`; `haversine` from `../../core/geo/geodesy.js`.
- Produces:
  - `createLocomotion({ start: {lat,lon} }): {`
    - `mode` (`'WALKING'|'RUNNING'|'DRIVING'`), `position` ({lat,lon}), `heading` (rad), `inCar` (bool), `car` ({lat,lon})
    - `update(dt, { forward:-1..1, turn:-1..1 })` — advances heading then position at the mode's speed
    - `toggleRun()` — WALKING↔RUNNING when on foot (no-op while driving)
    - `enterCar()` — if on foot and within 12 m of the car: mode DRIVING, inCar true
    - `exitCar()` — if driving: drop the car at the current position, mode WALKING, inCar false
    - `recallCar()` — move the car to the current position (so it can be entered)
    - `}`

- [ ] **Step 1: Write the failing test**

```js
// src/entities/locomotion/__tests__/locomotion.test.js
import { describe, it, expect } from 'vitest';
import { haversine } from '../../../core/geo/geodesy.js';
import { createLocomotion } from '../locomotion.js';

const START = { lat: 45.9, lon: 6.8 };

describe('locomotion', () => {
  it('starts on foot with the car at the start point', () => {
    const loco = createLocomotion({ start: START });
    expect(loco.mode).toBe('WALKING');
    expect(loco.inCar).toBe(false);
    expect(haversine(loco.position, START)).toBeCloseTo(0, 6);
    expect(haversine(loco.car, START)).toBeCloseTo(0, 6);
  });

  it('moves forward and leaves the car behind', () => {
    const loco = createLocomotion({ start: START });
    for (let i = 0; i < 60; i++) loco.update(0.1, { forward: 1, turn: 0 });
    expect(haversine(loco.position, START)).toBeGreaterThan(10); // walked away
    expect(haversine(loco.car, START)).toBeCloseTo(0, 6); // car stayed
  });

  it('runs faster than it walks', () => {
    const walk = createLocomotion({ start: START });
    walk.update(1, { forward: 1, turn: 0 });
    const run = createLocomotion({ start: START });
    run.toggleRun();
    run.update(1, { forward: 1, turn: 0 });
    expect(haversine(run.position, START)).toBeGreaterThan(haversine(walk.position, START));
  });

  it('enters the car only when close, then drives faster', () => {
    const loco = createLocomotion({ start: START });
    loco.update(1, { forward: 1, turn: 0 }); // walk ~2.5 m away (< 12 m)
    loco.enterCar();
    expect(loco.mode).toBe('DRIVING');
    expect(loco.inCar).toBe(true);
    const before = haversine(loco.position, START);
    loco.update(1, { forward: 1, turn: 0 });
    expect(haversine(loco.position, START) - before).toBeGreaterThan(20); // drive speed
  });

  it('cannot enter the car from far away', () => {
    const loco = createLocomotion({ start: START });
    for (let i = 0; i < 100; i++) loco.update(0.1, { forward: 1, turn: 0 }); // far
    loco.enterCar();
    expect(loco.mode).toBe('WALKING');
    expect(loco.inCar).toBe(false);
  });

  it('drops the car where you exit, and recall brings it back to you', () => {
    const loco = createLocomotion({ start: START });
    loco.enterCar(); // at start, distance 0
    for (let i = 0; i < 40; i++) loco.update(0.1, { forward: 1, turn: 0 }); // drive off
    loco.exitCar();
    expect(loco.mode).toBe('WALKING');
    expect(haversine(loco.car, START)).toBeGreaterThan(20); // car left here
    for (let i = 0; i < 40; i++) loco.update(0.1, { forward: 1, turn: 0 }); // walk further
    expect(haversine(loco.car, loco.position)).toBeGreaterThan(5);
    loco.recallCar();
    expect(haversine(loco.car, loco.position)).toBeCloseTo(0, 6); // car comes to you
  });

  it('turns the heading', () => {
    const loco = createLocomotion({ start: START });
    const h0 = loco.heading;
    loco.update(1, { forward: 0, turn: 1 });
    expect(loco.heading).not.toBeCloseTo(h0, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/entities/locomotion/__tests__/locomotion.test.js`
Expected: FAIL — cannot resolve `../locomotion.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/entities/locomotion/locomotion.js
import { makeProjection } from '../../core/geo/projection.js';
import { haversine } from '../../core/geo/geodesy.js';

const SPEED = { WALKING: 2.5, RUNNING: 6, DRIVING: 28 }; // m/s
const TURN_ON_FOOT = 2.4; // rad/s
const TURN_DRIVING = 1.2;
const ENTER_DISTANCE_M = 12;

/** Land locomotion: walk / run / drive, leave and recall the car. */
export function createLocomotion({ start }) {
  const state = {
    mode: 'WALKING',
    position: { ...start },
    heading: 0, // radians, 0 = north
    inCar: false,
    car: { ...start },
  };

  function step(dt, input) {
    const turnRate = state.mode === 'DRIVING' ? TURN_DRIVING : TURN_ON_FOOT;
    state.heading += (input.turn || 0) * turnRate * dt;
    const fwd = input.forward || 0;
    if (fwd !== 0) {
      const dist = fwd * SPEED[state.mode] * dt;
      const east = Math.sin(state.heading) * dist;
      const north = Math.cos(state.heading) * dist;
      const next = makeProjection(state.position).toLatLon(east, north);
      state.position.lat = next.lat;
      state.position.lon = next.lon;
      if (state.inCar) {
        state.car.lat = next.lat;
        state.car.lon = next.lon; // the car carries you while driving
      }
    }
  }

  return {
    get mode() { return state.mode; },
    get position() { return state.position; },
    get heading() { return state.heading; },
    get inCar() { return state.inCar; },
    get car() { return state.car; },
    update: step,
    toggleRun() {
      if (state.mode === 'WALKING') state.mode = 'RUNNING';
      else if (state.mode === 'RUNNING') state.mode = 'WALKING';
    },
    enterCar() {
      if (state.inCar) return;
      if (haversine(state.position, state.car) <= ENTER_DISTANCE_M) {
        state.inCar = true;
        state.mode = 'DRIVING';
      }
    },
    exitCar() {
      if (!state.inCar) return;
      state.inCar = false;
      state.mode = 'WALKING';
      state.car = { ...state.position };
    },
    recallCar() {
      state.car = { ...state.position };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/entities/locomotion/__tests__/locomotion.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/entities/locomotion/locomotion.js src/entities/locomotion/__tests__/locomotion.test.js
git commit -m "feat(loco): add land locomotion state machine"
```

---

### Task 2: Visible avatars — car & person (browser glue)

**Files:**
- Create: `src/entities/avatars.js`

**Interfaces:**
- Consumes: `three`.
- Produces: `createAvatars(scene): { setCar(world, headingRad), setPerson(world, headingRad), showCar(bool), showPerson(bool) }` — simple low-poly meshes positioned in world space by the caller.

> **No Node unit test (by design):** Three.js meshes. Verified at the Task 4 browser gate.

- [ ] **Step 1: Create `src/entities/avatars.js`**

```js
// src/entities/avatars.js
import * as THREE from 'three';

function makeCar() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 1.3, 2),
    new THREE.MeshLambertMaterial({ color: 0xcc3322, flatShading: true })
  );
  body.position.y = 1;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1, 1.7),
    new THREE.MeshLambertMaterial({ color: 0x222831, flatShading: true })
  );
  cabin.position.set(-0.2, 2, 0);
  g.add(body, cabin);
  return g;
}

function makePerson() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x2266aa, flatShading: true });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.3, 6), mat);
  body.position.y = 1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), mat);
  head.position.y = 1.95;
  g.add(body, head);
  return g;
}

/** Two positioned-by-caller avatars in the scene. */
export function createAvatars(scene) {
  const car = makeCar();
  const person = makePerson();
  scene.add(car, person);

  const place = (obj, world, headingRad) => {
    obj.position.set(world.x, world.y, world.z);
    obj.rotation.y = -headingRad; // heading 0 = north (-z)
  };

  return {
    setCar: (world, headingRad) => place(car, world, headingRad),
    setPerson: (world, headingRad) => place(person, world, headingRad),
    showCar: (v) => (car.visible = v),
    showPerson: (v) => (person.visible = v),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/entities/avatars.js
git commit -m "feat(render): add low-poly car and person avatars"
```

---

### Task 3: Per-mode follow camera (browser glue)

**Files:**
- Create: `src/entities/camera/followCamera.js`

**Interfaces:**
- Consumes: `three`.
- Produces: `createFollowCamera(camera): { update({ target, headingRad, mode, groundY, orbit }) }` — positions the camera behind/above the target; closer on foot, higher/farther when driving; `orbit` adds yaw offset from mouse drag.

> **No Node unit test (by design):** drives a Three.js camera. Verified at Task 4.

- [ ] **Step 1: Create `src/entities/camera/followCamera.js`**

```js
// src/entities/camera/followCamera.js
const RIG = {
  WALKING: { back: 8, height: 4, look: 2 },
  RUNNING: { back: 9, height: 4.5, look: 2 },
  DRIVING: { back: 16, height: 7, look: 2.5 },
};

/** Third-person follow camera, parameters per locomotion mode. */
export function createFollowCamera(camera) {
  return {
    update({ target, headingRad, mode, groundY, orbit = 0 }) {
      const a = headingRad + orbit;
      const fx = Math.sin(a);
      const fz = -Math.cos(a);
      const rig = RIG[mode] || RIG.WALKING;
      const y = Math.max(groundY, target.y) + rig.height;
      camera.position.set(target.x - fx * rig.back, y, target.z - fz * rig.back);
      camera.lookAt(target.x + fx * rig.look, target.y + rig.look, target.z + fz * rig.look);
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/entities/camera/followCamera.js
git commit -m "feat(render): add per-mode follow camera"
```

---

### Task 4: Wire locomotion into the app — BROWSER GATE

**Files:**
- Modify: `src/app/main.js`

**Interfaces:**
- Replaces the free-fly camera with the embodied player: WASD/ZQSD/arrows to move, mouse-drag to orbit, **F** to enter/exit the car, **R** to recall it, **Shift** to run.

- [ ] **Step 1: Rewrite the control + frame section of `src/app/main.js`**

Replace the fly-camera block (from `const player = { ...START };` through the end of the `frame` function) with:

```js
import { createLocomotion } from '../entities/locomotion/locomotion.js';
import { createAvatars } from '../entities/avatars.js';
import { createFollowCamera } from '../entities/camera/followCamera.js';

const loco = createLocomotion({ start: START });
const avatars = createAvatars(scene);
const follow = createFollowCamera(camera);

let orbit = 0;
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
  if (dragging) orbit += e.movementX * 0.005;
});

let lastGroundY = 0;
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
  if (shift) tiles.applyRebase(shift);

  const pw = worldFrame.toWorld(loco.position);
  const groundY = elevation.heightAtCached(loco.position.lat, loco.position.lon);
  if (groundY != null) lastGroundY = groundY;
  const target = { x: pw.x, y: lastGroundY, z: pw.z };

  avatars.setCar(target, loco.heading);
  avatars.setPerson(target, loco.heading);
  avatars.showCar(loco.inCar || true); // car always visible; it sits where you left it
  avatars.showPerson(!loco.inCar);

  follow.update({ target, headingRad: loco.heading, mode: loco.mode, groundY: lastGroundY, orbit });

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__we = { loco, tiles };
```

Also remove the now-unused `makeProjection` import if nothing else uses it, and delete the old `player`/`yaw` fly-cam code.

> Note: when not in the car, the car avatar should render at its **own** lat/lon, not the player's. The minimal version above pins both to the player; refine in Step 2.

- [ ] **Step 2: Render the car at its real position when left behind**

Replace the avatar block with:

```js
  const personW = worldFrame.toWorld(loco.position);
  avatars.setPerson({ x: personW.x, y: lastGroundY, z: personW.z }, loco.heading);
  avatars.showPerson(!loco.inCar);

  const carLL = loco.inCar ? loco.position : loco.car;
  const carGroundY = elevation.heightAtCached(carLL.lat, carLL.lon);
  const carW = worldFrame.toWorld(carLL);
  avatars.setCar({ x: carW.x, y: carGroundY != null ? carGroundY : lastGroundY, z: carW.z }, loco.heading);
```

And base the follow target on the active body:

```js
  const bodyLL = loco.inCar ? loco.position : loco.position;
  const bw = worldFrame.toWorld(bodyLL);
  const target = { x: bw.x, y: lastGroundY, z: bw.z };
```

- [ ] **Step 3: Start / reload the dev server**

Run: `npm run dev` (if not already running) and reload `http://localhost:5173`.

- [ ] **Step 4: BROWSER GATE — verify**

1. `read_console_messages` — no errors.
2. Screenshot — the person avatar stands on real terrain; the camera is third-person.
3. Move (W + drag), press **F** near the car → switch to driving (faster, camera pulls back); drive off, **F** to exit → car stays where you left it; **R** → car returns to you; **Shift** toggles run.

**Gate passes when** all transitions work, the car persists in place, and recall works — on real streaming terrain.

- [ ] **Step 5: Commit**

```bash
git add src/app/main.js
git commit -m "feat(app): embody player with drive/walk/run and car recall"
```

---

## Self-Review

**Spec coverage (against `V1-SPEC.md` §5, land clauses):**
- Modes WALKING/RUNNING/DRIVING + per-mode speed → Task 1. ✅
- Vehicle persists where left; recall to player ("inventory") → Task 1 (`exitCar`/`recallCar`). ✅
- Enter/exit gated by proximity → Task 1 (`enterCar` 12 m). ✅
- Per-mode follow camera → Task 3. ✅
- Visible avatars on real terrain → Tasks 2, 4. ✅
- §5 acceptance (leave car, walk away, it's where you left it; recall; no driving where you shouldn't) → Task 1 tests + Task 4 gate. Water gating (no driving on sea) deferred to Lot 5, noted. ✅

**Placeholder scan:** none — complete code or exact commands in every step.

**Type consistency:** `loco.position`/`loco.car` are `{lat,lon}` consumed via `worldFrame.toWorld`; `createFollowCamera.update` fields match Task 3; avatars `setCar/setPerson(world, headingRad)` match Task 2. ✅

**Out of scope (later lots):** swimming/boats & water gating (Lot 5), start-anywhere map (Lot 6), roads/OSM/odometer (Lot 7), audio/day-night (Lot 8).
