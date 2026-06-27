# Lot 2 — data/elevation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the elevation data layer — fetch + decode Terrarium tiles, cache them, and answer `heightAt(lat, lon)` / `isWater(lat, lon)` — the single foundation every other system calls.

**Architecture:** Pure, browser-free core (Terrarium RGB→metres decode, bilinear sampling, LRU tile cache, URL templating) plus a thin browser-only tile loader (`fetch` → `createImageBitmap` → `OffscreenCanvas` → RGBA). `createElevationSource` wires them together and takes an **injectable `loadTile`** so the whole resolution/cache/water logic is unit-tested in Node with synthetic tiles — no network, no canvas. Implements `docs/V1-SPEC.md` §3.

**Tech Stack:** Plain ES modules, Vitest (`node` env). Depends on Lot 1 `core/geo` (`tileFraction`).

## Global Constraints

- **Sole author, no AI trailer.** Every commit authored by Abdou-Raouf ATARMLA; never add `Co-Authored-By:` or any AI/tool attribution. (See `CLAUDE.md`.)
- **Conventional Commits.** `type(scope): subject`, imperative, lowercase, ≤ 50 chars, no trailing period. Scope here is `data`.
- **Plain JS modules.** Signatures are documentation; implement in `.js`.
- **Terrarium decode formula:** `elevation = R·256 + G + B/256 − 32768` (metres). Defined once in `terrarium.js`.
- **SEA_LEVEL_M = 0.** Water is `elevation ≤ SEA_LEVEL_M`.
- **Source (verified live 2026-06-27):** `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` — 200, no key, `Access-Control-Allow-Origin: *`, 256×256 PNG.
- **No network/canvas in unit tests.** Browser-only code is isolated in `tileLoader.js` and excluded from Node tests by design.

---

### Task 1: Terrarium decode

**Files:**
- Create: `src/data/elevation/terrarium.js`
- Test: `src/data/elevation/__tests__/terrarium.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `SEA_LEVEL_M: number` — `0`.
  - `decodeElevation(r, g, b): number` — metres from one Terrarium pixel.
  - `decodeHeightmap(rgba: Uint8ClampedArray|Uint8Array, size: number): Float32Array` — `size·size` heights.

- [ ] **Step 1: Write the failing test**

```js
// src/data/elevation/__tests__/terrarium.test.js
import { describe, it, expect } from 'vitest';
import { decodeElevation, decodeHeightmap, SEA_LEVEL_M } from '../terrarium.js';

describe('terrarium decode', () => {
  it('defines sea level at 0 m', () => {
    expect(SEA_LEVEL_M).toBe(0);
  });

  it('decodes the sea-level reference pixel (128,0,0) to 0 m', () => {
    expect(decodeElevation(128, 0, 0)).toBeCloseTo(0, 6);
  });

  it('decodes the real verified pixel (130,192,0) to 704 m', () => {
    // Same pixel measured live from terrarium 10/535/400.
    expect(decodeElevation(130, 192, 0)).toBeCloseTo(704, 6);
  });

  it('decodes negative elevations (bathymetry)', () => {
    // 127,246,0 -> 127*256 + 246 - 32768 = -10 m
    expect(decodeElevation(127, 246, 0)).toBeCloseTo(-10, 6);
  });

  it('decodes a full RGBA buffer into a heightmap', () => {
    // 2x2 tile, all pixels at sea level (128,0,0,255).
    const size = 2;
    const rgba = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      rgba[i * 4] = 128;
      rgba[i * 4 + 3] = 255;
    }
    const hm = decodeHeightmap(rgba, size);
    expect(hm).toBeInstanceOf(Float32Array);
    expect(hm.length).toBe(4);
    expect(Array.from(hm)).toEqual([0, 0, 0, 0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/elevation/__tests__/terrarium.test.js`
Expected: FAIL — cannot resolve `../terrarium.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/data/elevation/terrarium.js

/** Elevation at or below this (metres) counts as water. */
export const SEA_LEVEL_M = 0;

/**
 * Decode one Terrarium-encoded RGB pixel to elevation in metres.
 * @returns {number}
 */
export function decodeElevation(r, g, b) {
  return r * 256 + g + b / 256 - 32768;
}

/**
 * Decode an RGBA pixel buffer (row-major, `size`×`size`) into a height field.
 * @param {Uint8ClampedArray|Uint8Array} rgba
 * @param {number} size
 * @returns {Float32Array} length size·size
 */
export function decodeHeightmap(rgba, size) {
  const out = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const p = i * 4;
    out[i] = decodeElevation(rgba[p], rgba[p + 1], rgba[p + 2]);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/elevation/__tests__/terrarium.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/elevation/terrarium.js src/data/elevation/__tests__/terrarium.test.js
git commit -m "feat(data): add terrarium elevation decode"
```

---

### Task 2: Bilinear sampling

**Files:**
- Create: `src/data/elevation/sample.js`
- Test: `src/data/elevation/__tests__/sample.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `bilinearSample(heightmap: Float32Array, size: number, gx: number, gy: number): number`
    — `gx`/`gy` are continuous grid coordinates in `[0, size-1]`; out-of-range is clamped.

- [ ] **Step 1: Write the failing test**

```js
// src/data/elevation/__tests__/sample.test.js
import { describe, it, expect } from 'vitest';
import { bilinearSample } from '../sample.js';

// 2x2 grid:  row-major [ (0,0)=0, (1,0)=10, (0,1)=20, (1,1)=30 ]
const HM = Float32Array.from([0, 10, 20, 30]);

describe('bilinear sampling', () => {
  it('returns exact values at the corners', () => {
    expect(bilinearSample(HM, 2, 0, 0)).toBeCloseTo(0, 6);
    expect(bilinearSample(HM, 2, 1, 0)).toBeCloseTo(10, 6);
    expect(bilinearSample(HM, 2, 0, 1)).toBeCloseTo(20, 6);
    expect(bilinearSample(HM, 2, 1, 1)).toBeCloseTo(30, 6);
  });

  it('interpolates along x', () => {
    expect(bilinearSample(HM, 2, 0.5, 0)).toBeCloseTo(5, 6);
  });

  it('interpolates along y', () => {
    expect(bilinearSample(HM, 2, 0, 0.5)).toBeCloseTo(10, 6);
  });

  it('interpolates the centre', () => {
    expect(bilinearSample(HM, 2, 0.5, 0.5)).toBeCloseTo(15, 6);
  });

  it('clamps out-of-range coordinates', () => {
    expect(bilinearSample(HM, 2, -5, -5)).toBeCloseTo(0, 6);
    expect(bilinearSample(HM, 2, 99, 99)).toBeCloseTo(30, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/elevation/__tests__/sample.test.js`
Expected: FAIL — cannot resolve `../sample.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/data/elevation/sample.js

/**
 * Bilinearly sample a row-major height field at continuous grid coords.
 * @param {Float32Array} heightmap length size·size
 * @param {number} size grid width/height
 * @param {number} gx column in [0, size-1] (clamped)
 * @param {number} gy row in [0, size-1] (clamped)
 * @returns {number}
 */
export function bilinearSample(heightmap, size, gx, gy) {
  const cx = Math.max(0, Math.min(size - 1, gx));
  const cy = Math.max(0, Math.min(size - 1, gy));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(size - 1, x0 + 1);
  const y1 = Math.min(size - 1, y0 + 1);
  const tx = cx - x0;
  const ty = cy - y0;
  const h00 = heightmap[y0 * size + x0];
  const h10 = heightmap[y0 * size + x1];
  const h01 = heightmap[y1 * size + x0];
  const h11 = heightmap[y1 * size + x1];
  const top = h00 + (h10 - h00) * tx;
  const bot = h01 + (h11 - h01) * tx;
  return top + (bot - top) * ty;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/elevation/__tests__/sample.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/elevation/sample.js src/data/elevation/__tests__/sample.test.js
git commit -m "feat(data): add bilinear heightmap sampling"
```

---

### Task 3: LRU tile cache

**Files:**
- Create: `src/data/elevation/tileCache.js`
- Test: `src/data/elevation/__tests__/tileCache.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `createTileCache(capacity: number): { capacity, size, has(key), get(key), set(key, value), keys() }`
    — Map-backed LRU; `get` bumps recency; `set` evicts the least-recently-used past capacity.

- [ ] **Step 1: Write the failing test**

```js
// src/data/elevation/__tests__/tileCache.test.js
import { describe, it, expect } from 'vitest';
import { createTileCache } from '../tileCache.js';

describe('LRU tile cache', () => {
  it('stores and retrieves values', () => {
    const c = createTileCache(2);
    c.set('a', 1);
    expect(c.has('a')).toBe(true);
    expect(c.get('a')).toBe(1);
    expect(c.size).toBe(1);
  });

  it('evicts the least-recently-used entry past capacity', () => {
    const c = createTileCache(2);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3); // evicts 'a'
    expect(c.has('a')).toBe(false);
    expect(c.has('b')).toBe(true);
    expect(c.has('c')).toBe(true);
    expect(c.size).toBe(2);
  });

  it('get() bumps recency so the entry survives eviction', () => {
    const c = createTileCache(2);
    c.set('a', 1);
    c.set('b', 2);
    c.get('a'); // 'a' is now most recent
    c.set('c', 3); // evicts 'b', not 'a'
    expect(c.has('a')).toBe(true);
    expect(c.has('b')).toBe(false);
  });

  it('re-setting an existing key updates value and recency', () => {
    const c = createTileCache(2);
    c.set('a', 1);
    c.set('b', 2);
    c.set('a', 9); // 'a' most recent, value updated
    c.set('c', 3); // evicts 'b'
    expect(c.get('a')).toBe(9);
    expect(c.has('b')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/elevation/__tests__/tileCache.test.js`
Expected: FAIL — cannot resolve `../tileCache.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/data/elevation/tileCache.js

/**
 * A small Map-backed LRU cache. Insertion order in a Map tracks recency:
 * deleting then re-setting a key moves it to the most-recent position.
 * @param {number} capacity max resident entries
 */
export function createTileCache(capacity) {
  const map = new Map();
  return {
    get capacity() {
      return capacity;
    },
    get size() {
      return map.size;
    },
    has(key) {
      return map.has(key);
    },
    get(key) {
      if (!map.has(key)) return undefined;
      const value = map.get(key);
      map.delete(key);
      map.set(key, value); // bump to most-recent
      return value;
    },
    set(key, value) {
      if (map.has(key)) map.delete(key);
      map.set(key, value);
      while (map.size > capacity) {
        map.delete(map.keys().next().value); // drop least-recent
      }
    },
    keys() {
      return [...map.keys()];
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/elevation/__tests__/tileCache.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/elevation/tileCache.js src/data/elevation/__tests__/tileCache.test.js
git commit -m "feat(data): add lru tile cache"
```

---

### Task 4: Tile URL templating

**Files:**
- Create: `src/data/elevation/tileUrl.js`
- Test: `src/data/elevation/__tests__/tileUrl.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `DEFAULT_URL_TEMPLATE: string` — the verified terrarium endpoint.
  - `tileUrl(template: string, z: number, x: number, y: number): string`

- [ ] **Step 1: Write the failing test**

```js
// src/data/elevation/__tests__/tileUrl.test.js
import { describe, it, expect } from 'vitest';
import { tileUrl, DEFAULT_URL_TEMPLATE } from '../tileUrl.js';

describe('tile url', () => {
  it('points at the verified terrarium endpoint', () => {
    expect(DEFAULT_URL_TEMPLATE).toContain('elevation-tiles-prod/terrarium');
    expect(DEFAULT_URL_TEMPLATE).toContain('{z}/{x}/{y}');
  });

  it('substitutes z/x/y', () => {
    expect(tileUrl(DEFAULT_URL_TEMPLATE, 10, 535, 400)).toBe(
      'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/10/535/400.png'
    );
  });

  it('works with a custom template', () => {
    expect(tileUrl('/tiles/{z}-{x}-{y}', 3, 1, 2)).toBe('/tiles/3-1-2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/elevation/__tests__/tileUrl.test.js`
Expected: FAIL — cannot resolve `../tileUrl.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/data/elevation/tileUrl.js

/** Verified free, keyless, CORS-enabled global elevation source. */
export const DEFAULT_URL_TEMPLATE =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

/**
 * Fill a `{z}/{x}/{y}` URL template.
 * @returns {string}
 */
export function tileUrl(template, z, x, y) {
  return template
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/elevation/__tests__/tileUrl.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/elevation/tileUrl.js src/data/elevation/__tests__/tileUrl.test.js
git commit -m "feat(data): add tile url templating"
```

---

### Task 5: Elevation source (wiring)

**Files:**
- Create: `src/data/elevation/elevationSource.js`
- Test: `src/data/elevation/__tests__/elevationSource.test.js`

**Interfaces:**
- Consumes: `tileFraction` from `../../core/geo/tile.js`; `decodeHeightmap`, `SEA_LEVEL_M` from `./terrarium.js`; `bilinearSample` from `./sample.js`; `createTileCache` from `./tileCache.js`; `tileUrl`, `DEFAULT_URL_TEMPLATE` from `./tileUrl.js`.
- Produces:
  - `DEFAULT_MAX_ZOOM = 12`, `DEFAULT_CACHE_TILES = 256`.
  - `createElevationSource(opts?: { urlTemplate?, maxZoom?, cacheTiles?, loadTile? }): {`
    - `heightAt(lat, lon, z?): Promise<number>`
    - `heightAtCached(lat, lon, z?): number | null`
    - `isWater(lat, lon, z?): boolean | null`
    - `prefetch(tiles: Array<{x,y,z}>): Promise<void>`
    - `get cacheSize(): number`
    - `}`
  - `loadTile(url): Promise<{ size, rgba }>` is injected; in the browser it defaults to `loadTerrariumTile` (Task 6). Tests inject a fake.

- [ ] **Step 1: Write the failing test**

```js
// src/data/elevation/__tests__/elevationSource.test.js
import { describe, it, expect } from 'vitest';
import { createElevationSource } from '../elevationSource.js';

// Build a synthetic terrarium RGBA tile of one constant elevation (integer m).
function makeTile(size, elevation) {
  const v = elevation + 32768;
  const r = Math.floor(v / 256) & 255;
  const g = ((v % 256) + 256) % 256;
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = 0;
    rgba[i * 4 + 3] = 255;
  }
  return { size, rgba };
}

const PARIS = { lat: 48.8566, lon: 2.3522 };

describe('elevation source', () => {
  it('resolves heightAt through an injected loader', async () => {
    const src = createElevationSource({ loadTile: async () => makeTile(4, 100) });
    const h = await src.heightAt(PARIS.lat, PARIS.lon);
    expect(h).toBeCloseTo(100, 3);
  });

  it('returns null from heightAtCached before the tile loads, value after', async () => {
    const src = createElevationSource({ loadTile: async () => makeTile(4, 100) });
    expect(src.heightAtCached(PARIS.lat, PARIS.lon)).toBeNull();
    await src.heightAt(PARIS.lat, PARIS.lon);
    expect(src.heightAtCached(PARIS.lat, PARIS.lon)).toBeCloseTo(100, 3);
  });

  it('classifies water from cached elevation', async () => {
    const land = createElevationSource({ loadTile: async () => makeTile(4, 100) });
    expect(land.isWater(PARIS.lat, PARIS.lon)).toBeNull(); // not loaded yet
    await land.heightAt(PARIS.lat, PARIS.lon);
    expect(land.isWater(PARIS.lat, PARIS.lon)).toBe(false);

    const sea = createElevationSource({ loadTile: async () => makeTile(4, -10) });
    await sea.heightAt(PARIS.lat, PARIS.lon);
    expect(sea.isWater(PARIS.lat, PARIS.lon)).toBe(true);
  });

  it('fetches each tile only once (dedupes concurrent + repeat calls)', async () => {
    let calls = 0;
    const src = createElevationSource({
      loadTile: async () => {
        calls++;
        return makeTile(4, 50);
      },
    });
    await Promise.all([
      src.heightAt(PARIS.lat, PARIS.lon),
      src.heightAt(PARIS.lat, PARIS.lon),
    ]);
    await src.heightAt(PARIS.lat, PARIS.lon);
    expect(calls).toBe(1);
  });

  it('prefetch warms the cache', async () => {
    const src = createElevationSource({ loadTile: async () => makeTile(4, 0) });
    expect(src.cacheSize).toBe(0);
    await src.prefetch([{ x: 1, y: 1, z: 5 }, { x: 2, y: 1, z: 5 }]);
    expect(src.cacheSize).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/elevation/__tests__/elevationSource.test.js`
Expected: FAIL — cannot resolve `../elevationSource.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/data/elevation/elevationSource.js
import { tileFraction } from '../../core/geo/tile.js';
import { decodeHeightmap, SEA_LEVEL_M } from './terrarium.js';
import { bilinearSample } from './sample.js';
import { createTileCache } from './tileCache.js';
import { tileUrl, DEFAULT_URL_TEMPLATE } from './tileUrl.js';

export const DEFAULT_MAX_ZOOM = 12;
export const DEFAULT_CACHE_TILES = 256;

/**
 * Elevation lookup over streamed Terrarium tiles.
 * `loadTile(url) => Promise<{size, rgba}>` is injected (browser default in Task 6).
 */
export function createElevationSource(opts = {}) {
  const urlTemplate = opts.urlTemplate ?? DEFAULT_URL_TEMPLATE;
  const maxZoom = opts.maxZoom ?? DEFAULT_MAX_ZOOM;
  const loadTile = opts.loadTile;
  const cache = createTileCache(opts.cacheTiles ?? DEFAULT_CACHE_TILES);
  const pending = new Map();

  const keyFor = (z, x, y) => `${z}/${x}/${y}`;

  function ensureTile(z, x, y) {
    const key = keyFor(z, x, y);
    const cached = cache.get(key);
    if (cached) return Promise.resolve(cached);
    if (pending.has(key)) return pending.get(key);
    const promise = Promise.resolve(loadTile(tileUrl(urlTemplate, z, x, y))).then(
      ({ size, rgba }) => {
        const tile = { size, heightmap: decodeHeightmap(rgba, size) };
        cache.set(key, tile);
        pending.delete(key);
        return tile;
      }
    );
    pending.set(key, promise);
    return promise;
  }

  const sampleTile = (tile, fx, fy) =>
    bilinearSample(tile.heightmap, tile.size, fx * (tile.size - 1), fy * (tile.size - 1));

  function heightAtCached(lat, lon, z = maxZoom) {
    const { x, y, fx, fy } = tileFraction(lat, lon, z);
    const tile = cache.get(keyFor(z, x, y));
    return tile ? sampleTile(tile, fx, fy) : null;
  }

  function isWater(lat, lon, z = maxZoom) {
    const h = heightAtCached(lat, lon, z);
    return h === null ? null : h <= SEA_LEVEL_M;
  }

  return {
    async heightAt(lat, lon, z = maxZoom) {
      const { x, y, fx, fy } = tileFraction(lat, lon, z);
      const tile = await ensureTile(z, x, y);
      return sampleTile(tile, fx, fy);
    },
    heightAtCached,
    isWater,
    async prefetch(tiles) {
      await Promise.all(tiles.map(({ x, y, z }) => ensureTile(z, x, y)));
    },
    get cacheSize() {
      return cache.size;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/elevation/__tests__/elevationSource.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/elevation/elevationSource.js src/data/elevation/__tests__/elevationSource.test.js
git commit -m "feat(data): add elevation source over streamed tiles"
```

---

### Task 6: Browser tile loader + barrel export

**Files:**
- Create: `src/data/elevation/tileLoader.js`
- Create: `src/data/elevation/index.js`

**Interfaces:**
- Consumes: browser globals `fetch`, `createImageBitmap`, `OffscreenCanvas` (only at call time).
- Produces:
  - `loadTerrariumTile(url): Promise<{ size, rgba: Uint8ClampedArray }>` — the default `loadTile` for `createElevationSource` in the browser.
  - `src/data/elevation/index.js` re-exports the whole module.

> **No Node unit test (by design).** This is an irreducible browser wrapper around
> canvas APIs absent in Node. The pure decode it feeds is covered in Task 1; the
> real fetch+decode was verified live on 2026-06-27 (terrarium 10/535/400 →
> 704 m) and is re-verified end-to-end at the Lot 3 "foundation visible" gate in
> a real browser. The module imports cleanly in Node (globals touched only inside
> the function), so it does not break `npm test`.

- [ ] **Step 1: Write the browser loader**

```js
// src/data/elevation/tileLoader.js

/**
 * Browser-only: fetch a Terrarium PNG and decode it to RGBA bytes.
 * @param {string} url
 * @returns {Promise<{size:number, rgba:Uint8ClampedArray}>}
 */
export async function loadTerrariumTile(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`elevation tile ${url} -> HTTP ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob());
  const size = bitmap.width;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, size, size);
  bitmap.close();
  return { size, rgba: data };
}
```

- [ ] **Step 2: Create the barrel export**

```js
// src/data/elevation/index.js
export * from './terrarium.js';
export * from './sample.js';
export * from './tileCache.js';
export * from './tileUrl.js';
export * from './tileLoader.js';
export * from './elevationSource.js';
```

- [ ] **Step 3: Verify the module imports cleanly in Node and the full suite is green**

Run: `node --input-type=module -e "import('./src/data/elevation/index.js').then(m => console.log('exports:', Object.keys(m).sort().join(',')))"`
Expected: prints an exports list including `createElevationSource`, `loadTerrariumTile`, `decodeElevation`, `bilinearSample`, `createTileCache`, `tileUrl` — no error.

Run: `npm test`
Expected: PASS — all Lot 1 + Lot 2 tests green.

- [ ] **Step 4: Commit**

```bash
git add src/data/elevation/tileLoader.js src/data/elevation/index.js
git commit -m "feat(data): add browser tile loader and barrel"
```

---

## Self-Review

**Spec coverage (against `V1-SPEC.md` §3):**
- `createElevationSource({urlTemplate, maxZoom, cacheTiles})` → Task 5. ✅
- `heightAt` (async, bilinear) → Task 5 + Tasks 1–2. ✅
- `heightAtCached` (sync, null if unloaded) → Task 5. ✅
- `prefetch(tiles)` → Task 5. ✅
- `isWater` (`elevation ≤ SEA_LEVEL_M`) → Task 5 + Task 1. ✅
- Source URL / decode formula / 256×256 → Tasks 1, 4; loader Task 6. ✅
- Decode off the main thread / cache as Float32Array keyed by z/x/y → Task 5 cache + Task 6 loader (worker integration lands in Lot 3 streaming). ✅
- §3 acceptance (known summit; mid-ocean water; cache eviction) → Task 1 (704 m real pixel), Task 5 (water classification), Task 3 (LRU eviction). Live end-to-end summit check deferred to Lot 3 browser gate, noted honestly. ✅

**Placeholder scan:** none — every step has complete code or an exact command.

**Type consistency:** `loadTile`/`loadTerrariumTile` both return `{size, rgba}` (Tasks 5, 6); `decodeHeightmap(rgba, size)` signature identical (Tasks 1, 5); cache `get/set/has/size` used in Task 5 match Task 3; `tileFraction` returns `{x,y,fx,fy}` per Lot 1 and is consumed that way in Task 5. ✅

**Out of scope (deferred to Lot 3):** Web Worker mesh generation, LOD ring selection, terrain rendering. This lot only answers elevation queries.
