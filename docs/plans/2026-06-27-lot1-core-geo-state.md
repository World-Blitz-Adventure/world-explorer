# Lot 1 — core/geo + core/state Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, browser-free foundation of World Explorer — coordinate projection, tile math, geodesy, and the floating-origin world frame — fully unit-tested.

**Architecture:** Three coordinate spaces (geographic lat/lon ↔ Web Mercator tiles ↔ local ENU world metres) with pure conversion functions, plus a world frame that rebases its origin as the player travels to keep float32 precision. No rendering, no network — just deterministic math with tests. This is build step 1 of `docs/V1-SPEC.md` §9 and must pass its gates (§1, §2) before any other lot starts.

**Tech Stack:** Plain ES modules, Vite (bundler/dev server, used later), Vitest (test runner, `node` environment for pure math).

## Global Constraints

- **Sole author, no AI trailer.** Every commit authored by Abdou-Raouf ATARMLA; never add `Co-Authored-By:` or any AI/tool attribution. (See `CLAUDE.md`.)
- **Conventional Commits.** `type(scope): subject`, imperative, lowercase, ≤ 50 chars, no trailing period.
- **Plain JS modules.** TypeScript-style signatures in this plan are documentation only; implement in `.js`.
- **lat/lon is truth.** Geographic coordinates are the canonical representation everywhere; world space is a disposable render frame.
- **EARTH_RADIUS = 6378137** metres (WGS84 semi-major axis), defined once in `core/geo/geodesy.js` and imported elsewhere — never re-declared.
- **Units:** metres for distance, degrees for the public lat/lon API, radians only inside functions.

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `index.html`

**Interfaces:**
- Consumes: nothing.
- Produces: working `npm test` (Vitest) and `npm run dev` (Vite) toolchain for all later tasks.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "world-explorer",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Create `index.html` (stub for the dev server, used in later lots)**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>World Explorer</title>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
```

- [ ] **Step 3: Install the toolchain**

Run: `npm install -D vite vitest`
Expected: installs without error; creates `node_modules/` (gitignored) and `package-lock.json`.

- [ ] **Step 4: Verify the test runner works with no tests yet**

Run: `npx vitest run --passWithNoTests`
Expected: exit code 0, message indicating no test files were found (passes).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json index.html
git commit -m "build: scaffold vite and vitest toolchain"
```

---

### Task 2: Geodesy — EARTH_RADIUS + haversine

**Files:**
- Create: `src/core/geo/geodesy.js`
- Test: `src/core/geo/__tests__/geodesy.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `EARTH_RADIUS: number` — `6378137` (metres).
  - `haversine(a: {lat,lon}, b: {lat,lon}): number` — great-circle distance in metres.

- [ ] **Step 1: Write the failing test**

```js
// src/core/geo/__tests__/geodesy.test.js
import { describe, it, expect } from 'vitest';
import { haversine, EARTH_RADIUS } from '../geodesy.js';

describe('geodesy', () => {
  it('exports the WGS84 semi-major axis', () => {
    expect(EARTH_RADIUS).toBe(6378137);
  });

  it('measures one degree of longitude at the equator', () => {
    // Exact for a sphere: R * 1deg in radians.
    const expected = EARTH_RADIUS * (Math.PI / 180); // ~111319.49 m
    const d = haversine({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
    expect(d).toBeCloseTo(expected, 1); // within 0.05 m
  });

  it('measures one degree of latitude', () => {
    const expected = EARTH_RADIUS * (Math.PI / 180);
    const d = haversine({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(d).toBeCloseTo(expected, 1);
  });

  it('matches a known city pair within 0.1%', () => {
    // London ↔ Paris great-circle ≈ 343,556 m.
    const d = haversine({ lat: 51.5074, lon: -0.1278 }, { lat: 48.8566, lon: 2.3522 });
    expect(Math.abs(d - 343556) / 343556).toBeLessThan(0.001);
  });

  it('is zero for identical points', () => {
    expect(haversine({ lat: 10, lon: 20 }, { lat: 10, lon: 20 })).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/geo/__tests__/geodesy.test.js`
Expected: FAIL — cannot resolve `../geodesy.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/core/geo/geodesy.js

/** WGS84 semi-major axis, in metres. */
export const EARTH_RADIUS = 6378137;

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two lat/lon points, in metres.
 * @param {{lat:number, lon:number}} a
 * @param {{lat:number, lon:number}} b
 * @returns {number}
 */
export function haversine(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/geo/__tests__/geodesy.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/geo/geodesy.js src/core/geo/__tests__/geodesy.test.js
git commit -m "feat(geo): add earth radius and haversine distance"
```

---

### Task 3: Tile math — Web Mercator XYZ

**Files:**
- Create: `src/core/geo/tile.js`
- Test: `src/core/geo/__tests__/tile.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `tileFraction(lat, lon, z): { x:number, y:number, fx:number, fy:number }` — tile index (floored) plus in-tile fraction `[0,1)`.
  - `tileForLonLat(lat, lon, z): { x:number, y:number }` — floored tile index.
  - `lonLatForTile(x, y, z): { lat:number, lon:number }` — the tile's NW corner.

- [ ] **Step 1: Write the failing test**

```js
// src/core/geo/__tests__/tile.test.js
import { describe, it, expect } from 'vitest';
import { tileFraction, tileForLonLat, lonLatForTile } from '../tile.js';

describe('tile math', () => {
  it('puts the whole world in tile 0/0 at zoom 0', () => {
    expect(tileForLonLat(0, 0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('returns the NW corner of the zoom-0 tile', () => {
    const nw = lonLatForTile(0, 0, 0);
    expect(nw.lon).toBeCloseTo(-180, 6);
    expect(nw.lat).toBeCloseTo(85.0511, 3); // mercator top edge
  });

  it('round-trips a real tile (terrarium 10/535/400)', () => {
    // Center of tile 535/400 at z10 must map back to that tile.
    const nw = lonLatForTile(535, 400, 10);
    const se = lonLatForTile(536, 401, 10);
    const center = { lat: (nw.lat + se.lat) / 2, lon: (nw.lon + se.lon) / 2 };
    expect(tileForLonLat(center.lat, center.lon, 10)).toEqual({ x: 535, y: 400 });
  });

  it('reports in-tile fractions near 0.5 at a tile center', () => {
    const nw = lonLatForTile(535, 400, 10);
    const se = lonLatForTile(536, 401, 10);
    const center = { lat: (nw.lat + se.lat) / 2, lon: (nw.lon + se.lon) / 2 };
    const f = tileFraction(center.lat, center.lon, 10);
    expect(f.x).toBe(535);
    expect(f.y).toBe(400);
    expect(f.fx).toBeCloseTo(0.5, 2);
    expect(f.fy).toBeCloseTo(0.5, 2);
  });

  it('clamps latitudes beyond the mercator limit without NaN', () => {
    const t = tileForLonLat(89.9, 0, 5);
    expect(Number.isFinite(t.x)).toBe(true);
    expect(Number.isFinite(t.y)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/geo/__tests__/tile.test.js`
Expected: FAIL — cannot resolve `../tile.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/core/geo/tile.js

// Latitude limit of the Web Mercator projection.
const MAX_LAT = 85.05112878;

/**
 * Tile index plus in-tile fraction for a lat/lon at zoom z.
 * @returns {{x:number, y:number, fx:number, fy:number}}
 */
export function tileFraction(lat, lon, z) {
  const clampedLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const latRad = (clampedLat * Math.PI) / 180;
  const n = 2 ** z;
  const xf = ((lon + 180) / 360) * n;
  const yf =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const x = Math.floor(xf);
  const y = Math.floor(yf);
  return { x, y, fx: xf - x, fy: yf - y };
}

/**
 * Floored tile index for a lat/lon at zoom z.
 * @returns {{x:number, y:number}}
 */
export function tileForLonLat(lat, lon, z) {
  const { x, y } = tileFraction(lat, lon, z);
  return { x, y };
}

/**
 * The NW (top-left) corner of tile x/y at zoom z.
 * @returns {{lat:number, lon:number}}
 */
export function lonLatForTile(x, y, z) {
  const n = 2 ** z;
  const lon = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lon };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/geo/__tests__/tile.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/geo/tile.js src/core/geo/__tests__/tile.test.js
git commit -m "feat(geo): add web mercator tile math"
```

---

### Task 4: Projection — local ENU tangent plane

**Files:**
- Create: `src/core/geo/projection.js`
- Create: `src/core/geo/index.js`
- Test: `src/core/geo/__tests__/projection.test.js`

**Interfaces:**
- Consumes: `EARTH_RADIUS` from `./geodesy.js`.
- Produces:
  - `makeProjection(origin: {lat,lon}): { origin, toWorld(p) => {east,north}, toLatLon(east, north) => {lat,lon} }` — metres east/north of the origin on a tangent plane.
  - `src/core/geo/index.js` re-exports everything from `geodesy.js`, `tile.js`, `projection.js`.

- [ ] **Step 1: Write the failing test**

```js
// src/core/geo/__tests__/projection.test.js
import { describe, it, expect } from 'vitest';
import { makeProjection } from '../projection.js';
import { EARTH_RADIUS } from '../geodesy.js';

const ORIGIN = { lat: 48.8566, lon: 2.3522 }; // Paris

describe('projection', () => {
  it('maps the origin to (0,0)', () => {
    const proj = makeProjection(ORIGIN);
    const w = proj.toWorld(ORIGIN);
    expect(w.east).toBeCloseTo(0, 6);
    expect(w.north).toBeCloseTo(0, 6);
  });

  it('maps one degree north to the right number of metres', () => {
    const proj = makeProjection(ORIGIN);
    const w = proj.toWorld({ lat: ORIGIN.lat + 1, lon: ORIGIN.lon });
    expect(w.north).toBeCloseTo(EARTH_RADIUS * (Math.PI / 180), 0); // ~111319 m
    expect(w.east).toBeCloseTo(0, 6);
  });

  it('scales eastings by cos(latitude)', () => {
    const proj = makeProjection(ORIGIN);
    const w = proj.toWorld({ lat: ORIGIN.lat, lon: ORIGIN.lon + 1 });
    const expected = EARTH_RADIUS * (Math.PI / 180) * Math.cos((ORIGIN.lat * Math.PI) / 180);
    expect(w.east).toBeCloseTo(expected, 0);
  });

  it('round-trips lat/lon within 0.5 m across a 50 km box', () => {
    const proj = makeProjection(ORIGIN);
    const p = { lat: ORIGIN.lat + 0.3, lon: ORIGIN.lon + 0.4 }; // ~tens of km
    const w = proj.toWorld(p);
    const back = proj.toLatLon(w.east, w.north);
    // Convert the lat/lon error to metres to assert < 0.5 m.
    const errNorth = Math.abs(back.lat - p.lat) * (Math.PI / 180) * EARTH_RADIUS;
    const errEast =
      Math.abs(back.lon - p.lon) * (Math.PI / 180) * EARTH_RADIUS * Math.cos((p.lat * Math.PI) / 180);
    expect(errNorth).toBeLessThan(0.5);
    expect(errEast).toBeLessThan(0.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/geo/__tests__/projection.test.js`
Expected: FAIL — cannot resolve `../projection.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/core/geo/projection.js
import { EARTH_RADIUS } from './geodesy.js';

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

/**
 * Build a local ENU tangent-plane projection anchored at `origin`.
 * `toWorld` returns metres east/north of the origin; `toLatLon` inverts it.
 * @param {{lat:number, lon:number}} origin
 */
export function makeProjection(origin) {
  const cosLat0 = Math.cos(toRad(origin.lat));
  return {
    origin,
    toWorld(p) {
      return {
        east: toRad(p.lon - origin.lon) * cosLat0 * EARTH_RADIUS,
        north: toRad(p.lat - origin.lat) * EARTH_RADIUS,
      };
    },
    toLatLon(east, north) {
      return {
        lat: origin.lat + toDeg(north / EARTH_RADIUS),
        lon: origin.lon + toDeg(east / (EARTH_RADIUS * cosLat0)),
      };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/geo/__tests__/projection.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Create the geo barrel export**

```js
// src/core/geo/index.js
export * from './geodesy.js';
export * from './tile.js';
export * from './projection.js';
```

- [ ] **Step 6: Run the full geo suite**

Run: `npx vitest run src/core/geo`
Expected: PASS (all geodesy + tile + projection tests).

- [ ] **Step 7: Commit**

```bash
git add src/core/geo/projection.js src/core/geo/index.js src/core/geo/__tests__/projection.test.js
git commit -m "feat(geo): add local enu tangent-plane projection"
```

---

### Task 5: World frame — floating origin

**Files:**
- Create: `src/core/state/worldFrame.js`
- Create: `src/core/state/index.js`
- Test: `src/core/state/__tests__/worldFrame.test.js`

**Interfaces:**
- Consumes: `makeProjection` from `../geo/projection.js`, `haversine` from `../geo/geodesy.js`.
- Produces:
  - `REBASE_THRESHOLD_M: number` — `8000` (metres).
  - `createWorldFrame(initialOrigin: {lat,lon}): { origin, toWorld(p) => {x,y,z}, maybeRebase(player) => {x,y,z}|null }`
    - `toWorld` returns Three.js world metres: `x = east`, `y = 0` (up is filled by terrain elevation later), `z = -north` (north points to −z).
    - `maybeRebase(player)`: if the player is farther than `REBASE_THRESHOLD_M` from the current origin, move the origin to the player and return the world-space shift to add to every already-placed object; otherwise return `null`.

- [ ] **Step 1: Write the failing test**

```js
// src/core/state/__tests__/worldFrame.test.js
import { describe, it, expect } from 'vitest';
import { createWorldFrame, REBASE_THRESHOLD_M } from '../worldFrame.js';

const ORIGIN = { lat: 48.8566, lon: 2.3522 };

describe('world frame (floating origin)', () => {
  it('exposes the rebase threshold', () => {
    expect(REBASE_THRESHOLD_M).toBe(8000);
  });

  it('maps the origin to (0,0,0)', () => {
    const f = createWorldFrame(ORIGIN);
    expect(f.toWorld(ORIGIN)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('places north toward -z and east toward +x', () => {
    const f = createWorldFrame(ORIGIN);
    const north = f.toWorld({ lat: ORIGIN.lat + 0.01, lon: ORIGIN.lon });
    const east = f.toWorld({ lat: ORIGIN.lat, lon: ORIGIN.lon + 0.01 });
    expect(north.z).toBeLessThan(0);
    expect(east.x).toBeGreaterThan(0);
  });

  it('does not rebase below the threshold', () => {
    const f = createWorldFrame(ORIGIN);
    const near = { lat: ORIGIN.lat + 0.01, lon: ORIGIN.lon }; // ~1.1 km
    expect(f.maybeRebase(near)).toBeNull();
    expect(f.origin).toEqual(ORIGIN);
  });

  it('rebases beyond the threshold and re-centers the player', () => {
    const f = createWorldFrame(ORIGIN);
    // Due east at the same latitude (~73 km > 8 km threshold).
    const player = { lat: ORIGIN.lat, lon: ORIGIN.lon + 1 };
    const shift = f.maybeRebase(player);
    expect(shift).not.toBeNull();
    expect(f.origin).toEqual(player);
    // After rebasing, the player sits at the new origin.
    const playerWorld = f.toWorld(player);
    expect(playerWorld.x).toBeCloseTo(0, 6);
    expect(playerWorld.z).toBeCloseTo(0, 6);
  });

  it('keeps a static object consistent through a rebase (same latitude)', () => {
    const f = createWorldFrame(ORIGIN);
    const obj = { lat: ORIGIN.lat, lon: ORIGIN.lon + 0.1 };
    const before = f.toWorld(obj);
    const player = { lat: ORIGIN.lat, lon: ORIGIN.lon + 1 };
    const shift = f.maybeRebase(player);
    const after = f.toWorld(obj);
    // before + shift must equal the object's new world position.
    expect(before.x + shift.x).toBeCloseTo(after.x, 3);
    expect(before.z + shift.z).toBeCloseTo(after.z, 3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/state/__tests__/worldFrame.test.js`
Expected: FAIL — cannot resolve `../worldFrame.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/core/state/worldFrame.js
import { makeProjection } from '../geo/projection.js';
import { haversine } from '../geo/geodesy.js';

/** Distance from the current origin past which the world frame rebases. */
export const REBASE_THRESHOLD_M = 8000;

/**
 * A render frame anchored at a moving origin. Geographic truth (lat/lon) never
 * changes; only the local origin shifts, so float32 coordinates stay small.
 * @param {{lat:number, lon:number}} initialOrigin
 */
export function createWorldFrame(initialOrigin) {
  let projection = makeProjection(initialOrigin);

  function toWorld(p) {
    const { east, north } = projection.toWorld(p);
    return { x: east, y: 0, z: -north };
  }

  return {
    get origin() {
      return projection.origin;
    },
    toWorld,
    maybeRebase(player) {
      if (haversine(projection.origin, player) <= REBASE_THRESHOLD_M) {
        return null;
      }
      const playerWorld = toWorld(player); // player position in the OLD frame
      projection = makeProjection(player); // new origin = player
      // Adding this shift to any old-frame position yields its new-frame value.
      return { x: -playerWorld.x, y: 0, z: -playerWorld.z };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/state/__tests__/worldFrame.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Create the state barrel export**

```js
// src/core/state/index.js
export * from './worldFrame.js';
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS — all geo and state tests green.

- [ ] **Step 7: Commit**

```bash
git add src/core/state/worldFrame.js src/core/state/index.js src/core/state/__tests__/worldFrame.test.js
git commit -m "feat(state): add floating-origin world frame"
```

---

## Self-Review

**Spec coverage (against `V1-SPEC.md` §1, §2):**
- §1 `tileForLonLat`, `tileFraction`, `lonLatForTile` → Task 3. ✅
- §1 `makeProjection` (`toWorld`/`toLatLon`/`origin`) → Task 4. ✅
- §1 `haversine`, `EARTH_RADIUS` → Task 2. ✅
- §1 acceptance (round-trip < 0.5 m / 50 km; haversine reference) → Task 4 round-trip test + Task 2 equator/city tests. ✅
- §2 `createWorldFrame`, `maybeRebase`, `REBASE_THRESHOLD_M` → Task 5. ✅
- §2 acceptance (bounded coords after travel; consistent objects through rebase) → Task 5 rebase + static-object tests. ✅
- `core/geo` testable without browser → Vitest `node` env, no DOM imports. ✅

**Placeholder scan:** none — every step has complete code or an exact command.

**Type consistency:** `EARTH_RADIUS` declared once (Task 2), imported in Tasks 4–5; `makeProjection` signature identical in Tasks 4 and 5; `toWorld` returns `{east,north}` in projection (Task 4) and `{x,y,z}` in world frame (Task 5) — intentional and documented in the interfaces blocks. ✅

**Out of scope (correctly deferred):** elevation/tile fetching (Lot 2), rendering, locomotion. This lot is pure math only.
