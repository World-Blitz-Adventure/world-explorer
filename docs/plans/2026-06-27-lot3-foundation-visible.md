# Lot 3 — Foundation Visible Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render real terrain of a chosen point in the browser — streamed in tiles around the player with a moving camera — the make-or-break "foundation visible" milestone (V1-SPEC §9 step 3).

**Architecture:** Pure, Node-tested core (biome palette, terrain geometry in **tile-local metres**, tile-ring selection) plus thin Three.js shells (scene, mesh, tile manager, app bootstrap). Geometry holds only tile-local offsets; the mesh is positioned in world space via `worldFrame.toWorld(anchor)`, so a floating-origin rebase only nudges `mesh.position` — **geometry never rebuilds**. Terrain builds synchronously first (proves the wiring), then moves into a Web Worker last (satisfies "main thread never blocks") with zero logic change.

**Tech Stack:** Three.js, Vite, Vitest. Depends on Lot 1 (`core/geo`, `core/state`) and Lot 2 (`data/elevation`).

## Global Constraints

- **Sole author, no AI trailer.** Every commit authored by Abdou-Raouf ATARMLA; never add `Co-Authored-By:` or any AI/tool attribution.
- **Conventional Commits.** `type(scope): subject`, imperative, lowercase, ≤ 50 chars. Scopes: `terrain`, `render`, `stream`, `app`, `data`.
- **No world coordinates in geometry.** Vertex buffers hold tile-local metres only (offset from the tile NW corner). The only thing that knows the world origin is `mesh.position`. (Advisor point 1 — load-bearing.)
- **Flat-shaded indexed geometry.** Indexed buffers + `flatShading: true` on the material; no duplicated vertices, no normals attribute.
- **Synchronous first, worker last.** Tasks 1–7 build terrain on the main thread; Task 8 offloads to a Worker with no logic rework.
- **Browser-only modules carry no Node unit test by design** (WebGL/canvas absent in Node); they are verified at the Task 7 browser gate via screenshot **and** console.
- **Start point for this lot:** Lomé, Togo — `{ lat: 6.1725, lon: 1.2314 }`. Zoom 12, ring radius 3, grid 65.

---

### Task 1: Biome palette (pure)

**Files:**
- Create: `src/world/terrain/biome.js`
- Test: `src/world/terrain/__tests__/biome.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `biomeColor(elevation: number, slope: number, latitude: number): [number, number, number]` — RGB in 0..1.

- [ ] **Step 1: Write the failing test**

```js
// src/world/terrain/__tests__/biome.test.js
import { describe, it, expect } from 'vitest';
import { biomeColor } from '../biome.js';

describe('biome palette', () => {
  it('colors water below sea level (bluish)', () => {
    const [r, g, b] = biomeColor(-5, 0, 0);
    expect(b).toBeGreaterThan(r); // blue dominant
  });

  it('colors low flat land green-ish, not blue', () => {
    const [r, g, b] = biomeColor(200, 0, 0);
    expect(g).toBeGreaterThan(b); // green dominant
  });

  it('caps high elevation toward snow (bright) at high latitude', () => {
    const [r, g, b] = biomeColor(2500, 0, 75);
    expect(Math.min(r, g, b)).toBeGreaterThan(0.8); // near-white
  });

  it('does not snow at the same elevation near the equator', () => {
    const cold = biomeColor(2500, 0, 75);
    const warm = biomeColor(2500, 0, 0);
    expect(Math.min(...warm)).toBeLessThan(Math.min(...cold));
  });

  it('pulls steep slopes toward rock (desaturated/darker than flat grass)', () => {
    const flat = biomeColor(200, 0, 0);
    const steep = biomeColor(200, 1, 0);
    expect(steep).not.toEqual(flat);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/world/terrain/__tests__/biome.test.js`
Expected: FAIL — cannot resolve `../biome.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/world/terrain/biome.js
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [
  lerp(c1[0], c2[0], t),
  lerp(c1[1], c2[1], t),
  lerp(c1[2], c2[2], t),
];

const WATER = [0.17, 0.36, 0.52];
const SAND = [0.76, 0.7, 0.5];
const GRASS = [0.4, 0.56, 0.3];
const FOREST = [0.26, 0.42, 0.24];
const ROCK = [0.45, 0.42, 0.4];
const SNOW = [0.92, 0.93, 0.95];

/**
 * Stylized low-poly terrain color.
 * @param {number} elevation metres
 * @param {number} slope 0 (flat) .. 1 (steep)
 * @param {number} latitude degrees (snow line drops toward the poles)
 * @returns {[number, number, number]} rgb 0..1
 */
export function biomeColor(elevation, slope, latitude) {
  if (elevation <= 0) return WATER.slice();
  const snowLine = lerp(3200, 200, clamp01(Math.abs(latitude) / 90));
  let base;
  if (elevation < 4) base = SAND.slice();
  else if (elevation < 600) base = mix(GRASS, FOREST, clamp01(elevation / 600));
  else if (elevation < snowLine)
    base = mix(FOREST, ROCK, clamp01((elevation - 600) / Math.max(1, snowLine - 600)));
  else base = SNOW.slice();
  return mix(base, ROCK, clamp01((slope - 0.4) / 0.4));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/world/terrain/__tests__/biome.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/world/terrain/biome.js src/world/terrain/__tests__/biome.test.js
git commit -m "feat(terrain): add stylized biome palette"
```

---

### Task 2: Terrain geometry (pure, tile-local)

**Files:**
- Create: `src/world/terrain/buildTerrainGeometry.js`
- Test: `src/world/terrain/__tests__/buildTerrainGeometry.test.js`

**Interfaces:**
- Consumes: `makeProjection` from `../../core/geo/projection.js`; `bilinearSample` from `../../data/elevation/sample.js`; `biomeColor` from `./biome.js`.
- Produces:
  - `buildTerrainGeometry(heightmap: Float32Array, size: number, box: {nw:{lat,lon}, se:{lat,lon}}, grid: number): { positions: Float32Array, colors: Float32Array, indices: Uint32Array }`
    — positions are tile-local metres (offset from `box.nw`), `y` = elevation. Indexed grid, `grid·grid` vertices, `(grid-1)²·2` triangles.

- [ ] **Step 1: Write the failing test**

```js
// src/world/terrain/__tests__/buildTerrainGeometry.test.js
import { describe, it, expect } from 'vitest';
import { buildTerrainGeometry } from '../buildTerrainGeometry.js';

// 0.05° tile near the equator, constant elevation.
const BOX = { nw: { lat: 6.2, lon: 1.2 }, se: { lat: 6.15, lon: 1.25 } };

function constHeightmap(size, value) {
  const hm = new Float32Array(size * size);
  hm.fill(value);
  return hm;
}

describe('buildTerrainGeometry', () => {
  it('produces correctly sized indexed buffers', () => {
    const grid = 5;
    const g = buildTerrainGeometry(constHeightmap(4, 100), 4, BOX, grid);
    expect(g.positions.length).toBe(grid * grid * 3);
    expect(g.colors.length).toBe(grid * grid * 3);
    expect(g.indices.length).toBe((grid - 1) * (grid - 1) * 6);
  });

  it('anchors the NW corner vertex at local origin (0, h, 0)', () => {
    const g = buildTerrainGeometry(constHeightmap(4, 100), 4, BOX, 5);
    expect(g.positions[0]).toBeCloseTo(0, 6); // x east
    expect(g.positions[1]).toBeCloseTo(100, 3); // y elevation
    expect(g.positions[2]).toBeCloseTo(0, 6); // z north
  });

  it('puts elevation into the y component', () => {
    const g = buildTerrainGeometry(constHeightmap(4, 250), 4, BOX, 4);
    for (let i = 0; i < g.positions.length; i += 3) {
      expect(g.positions[i + 1]).toBeCloseTo(250, 3);
    }
  });

  it('spreads vertices east (+x) and south (-z) across the tile', () => {
    const grid = 5;
    const g = buildTerrainGeometry(constHeightmap(4, 0), 4, BOX, grid);
    const last = (grid * grid - 1) * 3; // SE corner
    expect(g.positions[last]).toBeGreaterThan(0); // east of NW
    expect(g.positions[last + 2]).toBeLessThan(0); // south = -z
  });

  it('contains no NaNs', () => {
    const g = buildTerrainGeometry(constHeightmap(4, 50), 4, BOX, 6);
    expect(Array.from(g.positions).every(Number.isFinite)).toBe(true);
    expect(Array.from(g.colors).every(Number.isFinite)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/world/terrain/__tests__/buildTerrainGeometry.test.js`
Expected: FAIL — cannot resolve `../buildTerrainGeometry.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/world/terrain/buildTerrainGeometry.js
import { makeProjection } from '../../core/geo/projection.js';
import { bilinearSample } from '../../data/elevation/sample.js';
import { biomeColor } from './biome.js';

/**
 * Build indexed terrain geometry in tile-local metres (offsets from box.nw).
 * No world origin here: the mesh is positioned in world space by the caller,
 * so geometry survives floating-origin rebases without rebuilding.
 */
export function buildTerrainGeometry(heightmap, size, box, grid) {
  const proj = makeProjection(box.nw);
  const positions = new Float32Array(grid * grid * 3);
  const colors = new Float32Array(grid * grid * 3);
  const latitude = (box.nw.lat + box.se.lat) / 2;

  const elevAt = (i, j) => {
    const gx = (i / (grid - 1)) * (size - 1);
    const gy = (j / (grid - 1)) * (size - 1);
    return bilinearSample(heightmap, size, gx, gy);
  };

  // metric spacing between adjacent grid nodes, for slope.
  const eastSpan = makeProjection(box.nw).toWorld({ lat: box.nw.lat, lon: box.se.lon }).east;
  const northSpan = -makeProjection(box.nw).toWorld({ lat: box.se.lat, lon: box.nw.lon }).north;
  const dx = Math.abs(eastSpan) / (grid - 1) || 1;
  const dz = Math.abs(northSpan) / (grid - 1) || 1;

  for (let j = 0; j < grid; j++) {
    const lat = box.nw.lat + (box.se.lat - box.nw.lat) * (j / (grid - 1));
    for (let i = 0; i < grid; i++) {
      const lon = box.nw.lon + (box.se.lon - box.nw.lon) * (i / (grid - 1));
      const { east, north } = proj.toWorld({ lat, lon });
      const elev = elevAt(i, j);
      const idx = (j * grid + i) * 3;
      positions[idx] = east;
      positions[idx + 1] = elev;
      positions[idx + 2] = -north;

      const dEdx = (elevAt(Math.min(grid - 1, i + 1), j) - elevAt(Math.max(0, i - 1), j)) / (2 * dx);
      const dEdz = (elevAt(i, Math.min(grid - 1, j + 1)) - elevAt(i, Math.max(0, j - 1))) / (2 * dz);
      const grad = Math.hypot(dEdx, dEdz);
      const slope = grad / (1 + grad);
      const [r, g, b] = biomeColor(elev, slope, latitude);
      colors[idx] = r;
      colors[idx + 1] = g;
      colors[idx + 2] = b;
    }
  }

  const indices = new Uint32Array((grid - 1) * (grid - 1) * 6);
  let k = 0;
  for (let j = 0; j < grid - 1; j++) {
    for (let i = 0; i < grid - 1; i++) {
      const a = j * grid + i;
      const b = a + 1;
      const c = a + grid;
      const d = c + 1;
      indices[k++] = a; indices[k++] = c; indices[k++] = b;
      indices[k++] = b; indices[k++] = c; indices[k++] = d;
    }
  }
  return { positions, colors, indices };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/world/terrain/__tests__/buildTerrainGeometry.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/world/terrain/buildTerrainGeometry.js src/world/terrain/__tests__/buildTerrainGeometry.test.js
git commit -m "feat(terrain): build tile-local terrain geometry"
```

---

### Task 3: Tile-ring selection (pure)

**Files:**
- Create: `src/world/streaming/tiles.js`
- Test: `src/world/streaming/__tests__/tiles.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `tilesAround(center: {x,y}, radius: number, z: number): Array<{x,y,z}>` — square block of tiles, longitude wraps, latitude clamps (no tiles past the poles).

- [ ] **Step 1: Write the failing test**

```js
// src/world/streaming/__tests__/tiles.test.js
import { describe, it, expect } from 'vitest';
import { tilesAround } from '../tiles.js';

describe('tilesAround', () => {
  it('returns a (2r+1)^2 block away from edges', () => {
    const t = tilesAround({ x: 100, y: 100 }, 1, 8);
    expect(t.length).toBe(9);
    expect(t).toContainEqual({ x: 100, y: 100, z: 8 });
  });

  it('wraps longitude across the antimeridian', () => {
    const t = tilesAround({ x: 0, y: 100 }, 1, 8); // n = 256
    expect(t.some((p) => p.x === 255)).toBe(true); // x=-1 wrapped to 255
  });

  it('clamps latitude at the poles (drops out-of-range rows)', () => {
    const t = tilesAround({ x: 100, y: 0, z: 8 }, 1, 8);
    expect(t.every((p) => p.y >= 0)).toBe(true);
    expect(t.length).toBe(6); // top row dropped
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/world/streaming/__tests__/tiles.test.js`
Expected: FAIL — cannot resolve `../tiles.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/world/streaming/tiles.js

/**
 * Square block of tiles of `radius` around a center tile at zoom `z`.
 * Longitude (x) wraps around the world; latitude (y) clamps at the poles.
 * @returns {Array<{x:number, y:number, z:number}>}
 */
export function tilesAround(center, radius, z) {
  const n = 2 ** z;
  const out = [];
  for (let dy = -radius; dy <= radius; dy++) {
    const y = center.y + dy;
    if (y < 0 || y >= n) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      const x = (((center.x + dx) % n) + n) % n;
      out.push({ x, y, z });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/world/streaming/__tests__/tiles.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/world/streaming/tiles.js src/world/streaming/__tests__/tiles.test.js
git commit -m "feat(stream): add tile-ring selection"
```

---

### Task 4: Expose tiles from the elevation source

**Files:**
- Modify: `src/data/elevation/elevationSource.js`
- Test: `src/data/elevation/__tests__/elevationSource.test.js` (add a case)

**Interfaces:**
- Produces (new): `getTile(z, x, y): Promise<{ size: number, heightmap: Float32Array }>` on the elevation source — the decoded tile, cached, for meshing.

- [ ] **Step 1: Add a failing test**

Append to `src/data/elevation/__tests__/elevationSource.test.js` (inside the `describe`):

```js
  it('exposes a decoded tile via getTile', async () => {
    const src = createElevationSource({ loadTile: async () => makeTile(8, 42) });
    const tile = await src.getTile(5, 1, 1);
    expect(tile.size).toBe(8);
    expect(tile.heightmap).toBeInstanceOf(Float32Array);
    expect(tile.heightmap.length).toBe(64);
    expect(tile.heightmap[0]).toBeCloseTo(42, 3);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/elevation/__tests__/elevationSource.test.js`
Expected: FAIL — `src.getTile is not a function`.

- [ ] **Step 3: Add `getTile` to the returned object**

In `src/data/elevation/elevationSource.js`, add this property to the returned object (next to `prefetch`):

```js
    getTile(z, x, y) {
      return ensureTile(z, x, y);
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/elevation/__tests__/elevationSource.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/elevation/elevationSource.js src/data/elevation/__tests__/elevationSource.test.js
git commit -m "feat(data): expose decoded tiles via getTile"
```

---

### Task 5: Three.js scene + terrain mesh (browser glue)

**Files:**
- Create: `src/render/scene.js`
- Create: `src/world/terrain/terrainMesh.js`

**Interfaces:**
- Consumes: `three`.
- Produces:
  - `createScene({ canvas }): { renderer, scene, camera, resize }`
  - `createTerrainMesh({ positions, colors, indices }): THREE.Mesh` and `disposeTerrainMesh(mesh)`.

> **No Node unit test (by design):** both touch WebGL/canvas. Verified at the Task 7 browser gate.

- [ ] **Step 1: Install Three.js**

Run: `npm install three`
Expected: adds `three` to dependencies.

- [ ] **Step 2: Create `src/render/scene.js`**

```js
// src/render/scene.js
import * as THREE from 'three';

/** Build the renderer, scene, camera, lights, and fog. */
export function createScene({ canvas }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

  const scene = new THREE.Scene();
  const sky = new THREE.Color(0x9fc9ff);
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 2000, 11000);

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
```

- [ ] **Step 3: Create `src/world/terrain/terrainMesh.js`**

```js
// src/world/terrain/terrainMesh.js
import * as THREE from 'three';

// One shared material: flat-shaded (face normals derived in-shader), vertex-colored.
const TERRAIN_MATERIAL = new THREE.MeshLambertMaterial({
  vertexColors: true,
  flatShading: true,
  side: THREE.DoubleSide,
});

/** Turn tile-local geometry buffers into a positioned-by-caller mesh. */
export function createTerrainMesh({ positions, colors, indices }) {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));
  geom.computeBoundingSphere();
  return new THREE.Mesh(geom, TERRAIN_MATERIAL);
}

export function disposeTerrainMesh(mesh) {
  mesh.geometry.dispose();
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/render/scene.js src/world/terrain/terrainMesh.js
git commit -m "feat(render): add three scene and terrain mesh"
```

---

### Task 6: Tile manager (browser, synchronous build)

**Files:**
- Create: `src/world/streaming/tileManager.js`

**Interfaces:**
- Consumes: `three`; `tileForLonLat`, `lonLatForTile` from `../../core/geo/tile.js`; `buildTerrainGeometry` from `../terrain/buildTerrainGeometry.js`; `createTerrainMesh`, `disposeTerrainMesh` from `../terrain/terrainMesh.js`; `tilesAround` from `./tiles.js`.
- Produces:
  - `createTileManager({ scene, elevation, worldFrame, zoom, radius, grid }): { update(playerLatLon), applyRebase(shift), count }`

> **No Node unit test (by design):** depends on Three.js meshes/scene. Verified at the Task 7 browser gate. (Its pure inputs — geometry, rings — are already tested in Tasks 2–3.)

- [ ] **Step 1: Create `src/world/streaming/tileManager.js`**

```js
// src/world/streaming/tileManager.js
import { tileForLonLat, lonLatForTile } from '../../core/geo/tile.js';
import { buildTerrainGeometry } from '../terrain/buildTerrainGeometry.js';
import { createTerrainMesh, disposeTerrainMesh } from '../terrain/terrainMesh.js';
import { tilesAround } from './tiles.js';

/** Streams terrain tiles around the player; evicts the rest; rebases on demand. */
export function createTileManager({ scene, elevation, worldFrame, zoom, radius, grid }) {
  const loaded = new Map(); // key -> mesh
  const inflight = new Set();
  const keyFor = (t) => `${t.z}/${t.x}/${t.y}`;

  async function load(t) {
    const key = keyFor(t);
    if (loaded.has(key) || inflight.has(key)) return;
    inflight.add(key);
    try {
      const { size, heightmap } = await elevation.getTile(t.z, t.x, t.y);
      const nw = lonLatForTile(t.x, t.y, t.z);
      const se = lonLatForTile(t.x + 1, t.y + 1, t.z);
      const geo = buildTerrainGeometry(heightmap, size, { nw, se }, grid);
      const mesh = createTerrainMesh(geo);
      const wp = worldFrame.toWorld(nw);
      mesh.position.set(wp.x, wp.y, wp.z);
      if (loaded.has(key)) {
        disposeTerrainMesh(mesh); // raced; keep the existing one
      } else {
        scene.add(mesh);
        loaded.set(key, mesh);
      }
    } catch (err) {
      console.error('tile load failed', key, err);
    } finally {
      inflight.delete(key);
    }
  }

  return {
    update(playerLatLon) {
      const center = tileForLonLat(playerLatLon.lat, playerLatLon.lon, zoom);
      const needed = tilesAround(center, radius, zoom);
      const neededKeys = new Set(needed.map(keyFor));
      needed.forEach(load);
      for (const [key, mesh] of loaded) {
        if (!neededKeys.has(key)) {
          scene.remove(mesh);
          disposeTerrainMesh(mesh);
          loaded.delete(key);
        }
      }
    },
    applyRebase(shift) {
      for (const mesh of loaded.values()) {
        mesh.position.x += shift.x;
        mesh.position.z += shift.z;
      }
    },
    get count() {
      return loaded.size;
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/world/streaming/tileManager.js
git commit -m "feat(stream): add streaming tile manager"
```

---

### Task 7: App bootstrap + fly camera — BROWSER GATE

**Files:**
- Create: `src/app/main.js`
- Modify: `index.html` (load the module, full-viewport canvas)

**Interfaces:**
- Consumes: everything above; `createElevationSource`, `loadTerrariumTile`; `createWorldFrame`; `makeProjection`.
- Produces: a running app — real terrain of Lomé streaming under a movable fly camera.

- [ ] **Step 1: Create `src/app/main.js`**

```js
// src/app/main.js
import * as THREE from 'three';
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
```

- [ ] **Step 2: Wire `index.html`**

Replace the body of `index.html` with:

```html
  <body style="margin:0;overflow:hidden;background:#9fc9ff">
    <div id="app"></div>
    <script type="module" src="/src/app/main.js"></script>
  </body>
```

- [ ] **Step 3: Start the dev server**

Run: `npm run dev`
Expected: Vite serves on `http://localhost:5173`.

- [ ] **Step 4: BROWSER GATE — verify in Chrome**

Using the browser automation tools (respect the 2–3 attempt limit):
1. `tabs_context_mcp`, then open `http://localhost:5173` in a new tab.
2. `read_console_messages` — expect **no** WebGL init errors and **no** tile fetch/CORS errors. A black canvas with clean console ≠ success; investigate any error before screenshotting.
3. Wait ~2 s for tiles to stream, then screenshot — expect visible stylized terrain (greens/blues, fog horizon).
4. Send `KeyW` (and drag to turn) and screenshot again — expect the view to move and new terrain to appear ahead (`window.__we.tiles.count` stays bounded as far tiles unload).

**Gate passes when:** terrain renders, console is clean, and moving the camera streams new tiles. If it fails, debug before Task 8 — do not build the worker on a broken foundation.

- [ ] **Step 5: Commit**

```bash
git add src/app/main.js index.html
git commit -m "feat(app): stream real terrain under a fly camera"
```

---

### Task 8: Offload geometry to a Web Worker

**Files:**
- Create: `src/world/terrain/terrainWorker.js`
- Modify: `src/world/streaming/tileManager.js` (build via worker, fall back to sync)

**Interfaces:**
- Produces: terrain geometry built off the main thread; `tileManager` unchanged externally (same `update`/`applyRebase`/`count`).

> Worker built last because `buildTerrainGeometry` is pure and runs identically on either thread — this task is pure plumbing with no logic change, satisfying the §4 "main thread never blocks" clause.

- [ ] **Step 1: Create `src/world/terrain/terrainWorker.js`**

```js
// src/world/terrain/terrainWorker.js
import { buildTerrainGeometry } from './buildTerrainGeometry.js';

self.onmessage = (e) => {
  const { id, heightmap, size, box, grid } = e.data;
  const geo = buildTerrainGeometry(heightmap, size, box, grid);
  self.postMessage({ id, ...geo }, [geo.positions.buffer, geo.colors.buffer, geo.indices.buffer]);
};
```

- [ ] **Step 2: Use the worker from `tileManager.js`**

Add a module-level worker pool helper at the top of `tileManager.js` (after imports), replacing the direct `buildTerrainGeometry` call:

```js
// One worker, promise-keyed by id. Falls back to sync build if Worker is absent.
let worker = null;
let seq = 0;
const waiting = new Map();
function getWorker() {
  if (worker === null && typeof Worker !== 'undefined') {
    worker = new Worker(new URL('../terrain/terrainWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, positions, colors, indices } = e.data;
      const resolve = waiting.get(id);
      if (resolve) {
        waiting.delete(id);
        resolve({ positions, colors, indices });
      }
    };
  }
  return worker;
}
function buildGeometryAsync(heightmap, size, box, grid) {
  const w = getWorker();
  if (!w) return Promise.resolve(buildTerrainGeometry(heightmap, size, box, grid));
  const id = ++seq;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    // Copy the heightmap so the transfer doesn't neuter the cached tile.
    const hm = heightmap.slice();
    w.postMessage({ id, heightmap: hm, size, box, grid }, [hm.buffer]);
  });
}
```

Then in `load`, replace:

```js
      const geo = buildTerrainGeometry(heightmap, size, { nw, se }, grid);
```

with:

```js
      const geo = await buildGeometryAsync(heightmap, size, { nw, se }, grid);
```

- [ ] **Step 3: Re-run the full unit suite (no regressions in pure code)**

Run: `npm test`
Expected: PASS — all Lot 1–3 unit tests green.

- [ ] **Step 4: BROWSER GATE — re-verify with the worker**

Restart `npm run dev`, reload `http://localhost:5173`:
1. `read_console_messages` — no worker/module errors.
2. Screenshot — terrain still renders identically.
3. Move (KeyW + drag) — streaming still smooth; the main thread is no longer doing mesh builds.

- [ ] **Step 5: Commit**

```bash
git add src/world/terrain/terrainWorker.js src/world/streaming/tileManager.js
git commit -m "perf(terrain): build geometry in a web worker"
```

---

## Self-Review

**Spec coverage (against `V1-SPEC.md` §4):**
- `createTileManager({ scene, elevation, worldFrame, getPlayer })` streaming + eviction → Task 6 (player passed per-frame to `update`). ✅
- LOD rings (single-zoom block for this milestone) → Task 3 `tilesAround`; multi-zoom rings deferred and noted. ✅
- Worker mesh build, transferables → Task 8. ✅
- Flat-shaded low-poly, biome by elevation×slope×latitude → Tasks 1, 2, 5. ✅
- Fog horizon → Task 5. ✅
- §4 acceptance (stream ahead / free behind, bounded memory, no main-thread block, no cracks) → Task 7 gate (movement) + Task 8 (worker) + DoubleSide material (no backface gaps). ✅
- Floating-origin composition (geometry rebuild-free on rebase) → Tasks 2 + 6 (`applyRebase`). ✅

**Placeholder scan:** none — every step has complete code or an exact command.

**Type consistency:** geometry `{positions, colors, indices}` identical across Tasks 2, 5, 6, 8; `getTile` returns `{size, heightmap}` (Task 4) consumed in Task 6; `tilesAround(center,radius,z)` signature matches Tasks 3 and 6; `worldFrame.toWorld`/`maybeRebase` per Lot 1 used in Tasks 6–7. ✅

**Out of scope (later lots):** locomotion modes & vehicles (Lot 4), water rendering (Lot 5/Layer 2), start-point map UI (Layer 3), multi-zoom LOD refinement. This lot delivers visible, streaming, movable real terrain.
