# World Explorer — V1 Specification

> Status: design locked · Last updated: 2026-06-27
> Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) first for the why. This document
> is the build-ready *what*: contracts, interfaces, and gated milestones.

V1 is the single-player, fully client-side web core: layers 0 → 5. It is
"very complete" by **finishing each layer in order, each shippable and gated** —
not by speccing one giant blob. The spec leads with the data-layer contract and
projection because every other system hangs off them.

---

## 0. Conventions used here

- Interfaces are written as TypeScript-style signatures for precision. The
  implementation language is plain JS modules (Vite); types are documentation.
- `LatLon = { lat: number, lon: number }` (WGS84 degrees).
- `World = { x: number, y: number, z: number }` (local ENU metres; y = up).
- Distances in metres, angles in radians unless suffixed `Deg`.

---

## 1. Projection & coordinate contract (`core/geo`)

Pure functions. No browser, no network. Fully unit-testable. **This module is
written and tested first; nothing else is correct until it is.**

```ts
// Tile space (Web Mercator XYZ)
tileForLonLat(lat, lon, z): { x: number, y: number }      // floored tile index
tileFraction(lat, lon, z): { x, y, fx, fy }               // + in-tile fraction [0,1)
lonLatForTile(x, y, z): LatLon                             // NW corner of tile

// World space (local ENU tangent plane anchored at an origin)
makeProjection(origin: LatLon): {
  toWorld(p: LatLon): { east: number, north: number }     // metres from origin
  toLatLon(east: number, north: number): LatLon           // inverse
  origin: LatLon
}

// Geodesy
haversine(a: LatLon, b: LatLon): number                   // great-circle metres
EARTH_RADIUS = 6378137                                     // metres
```

**Acceptance:** round-trip `toLatLon(toWorld(p)) ≈ p` within < 0.5 m over a
50 km box; `haversine` matches a reference value for known city pairs within
0.1%. Tests live in `core/geo/__tests__`.

---

## 2. Floating origin (`core/state`)

Keeps float32 rendering precise across real-world distances.

```ts
createWorldFrame(initialOrigin: LatLon): {
  origin: LatLon                       // current render origin (lat/lon)
  toWorld(p: LatLon): World            // uses current origin
  // Called each frame with the player's lat/lon. If the player is farther than
  // REBASE_THRESHOLD_M from origin, moves origin to the player and returns the
  // world-space shift to apply to every loaded object. Otherwise returns null.
  maybeRebase(player: LatLon): World | null
}
REBASE_THRESHOLD_M = 8000
```

**Acceptance:** after travelling 100 km the player's world-space coordinates stay
bounded (≤ ~`REBASE_THRESHOLD_M`), and no visible vertex jitter appears. Every
system that holds world-space objects subscribes to the rebase shift.

---

## 3. Data layer (`data/elevation`)

The single foundation. Every other system calls `heightAt`.

```ts
createElevationSource(opts?: {
  urlTemplate?: string   // default terrarium endpoint, see below
  maxZoom?: number       // default 12
  cacheTiles?: number    // LRU cap, default 256
}): {
  // Async: ensures the covering tile is fetched+decoded, then bilinear-samples.
  heightAt(lat: number, lon: number, z?: number): Promise<number>   // metres
  // Sync: returns cached height or null if the tile isn't loaded yet.
  heightAtCached(lat, lon, z?): number | null
  prefetch(tiles: Array<{x,y,z}>): Promise<void>
  isWater(lat, lon): boolean | null    // elevation ≤ SEA_LEVEL_M
}
SEA_LEVEL_M = 0
```

**Source (verified live 2026-06-27):**
`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`
- 200, **no API key**, `Access-Control-Allow-Origin: *`, `image/png`, 256×256.
- Decode: `h = (R·256 + G + B/256) − 32768` metres.
- Decoding happens off the main thread (OffscreenCanvas in a Worker, or a
  pooled canvas). Tiles cached as `Float32Array(256·256)` keyed by `z/x/y`.

**Acceptance:** `heightAt` for a known summit returns the right elevation within
one tile's vertical resolution; `isWater` returns true mid-ocean and false on
land; cache eviction holds the configured tile count.

---

## 4. Streaming & LOD (`world/streaming`, `world/terrain`)

```ts
createTileManager(deps: {
  elevation, scene, worldFrame, getPlayer: () => LatLon
}): {
  update(dt: number): void   // each frame: diff needed vs loaded tiles
  dispose(): void
}
```

- **LOD rings:** highest zoom in the ring nearest the player, decreasing zoom
  outward. Tile coverage radius and per-ring zoom are config constants.
- **Async pipeline:** needed tile → fetch elevation → build mesh in Worker
  (transferable `position`/`color`/`normal` buffers) → add to scene. Far tiles
  beyond the radius are removed and their GPU buffers disposed.
- **Memory budget:** a hard cap on resident tiles; LRU eviction. Logged when the
  cap forces a drop (no silent truncation).
- **Seams:** vertical skirts on tile edges hide cracks between LOD levels.

**Terrain mesh (`world/terrain`):** a tile → an `N×N` grid plane (N config,
e.g. 64) displaced by the height field, **flat-shaded low-poly**, vertex-coloured
by biome: a palette over elevation × slope × latitude (water edge → sand → grass
→ forest → rock → snow), with small per-vertex variation to avoid banding.

**Acceptance:** driving a straight line streams new terrain ahead and frees
terrain behind with a stable frame time and bounded memory; no holes/cracks at
LOD boundaries; the main thread never blocks on mesh build.

---

## 5. Locomotion (`entities/locomotion`, `entities/camera`)

One state machine, gated by the surface under the player.

```ts
type Mode = 'DRIVING' | 'WALKING' | 'RUNNING' | 'SWIMMING' | 'BOATING'

createLocomotion(deps: { elevation, worldFrame, input }): {
  mode: Mode
  position: LatLon          // player truth, persisted as lat/lon
  update(dt: number): void  // applies physics, ground-clamps, gates by surface
  // Inventory / vehicles
  vehicles: { car: LatLon | null, boat: LatLon | null }  // where each was left
  enterVehicle(): void      // F near a vehicle
  exitVehicle(): void       // leaves it in the world at current lat/lon
  recall(kind: 'car' | 'boat'): void   // bring it to the player (inventory)
}
```

- **Surface gating:** on land → `DRIVING | WALKING | RUNNING`; on water →
  `SWIMMING` (on foot) or `BOATING` (boat deployed). Walking into the sea
  auto-transitions to swimming; deploying a boat switches to boating.
- **Per-mode:** distinct max speed, acceleration, turn rate, and camera. All
  modes ground-clamp via `elevation.heightAtCached` (fallback to last known
  height until the tile loads).
- **Vehicles persist** at their lat/lon when left; `recall` teleports them to
  the player — the "inventory" the product describes.
- **Camera:** third-person follow with mouse-drag orbit; parameters per mode
  (closer/lower on foot, higher/wider when driving).

**Acceptance:** leave the car, walk away 200 m, turn around — the car is exactly
where you left it; recall brings it to you; entering water on foot starts
swimming; deploying the boat starts boating; no mode lets you drive on the sea
or boat on dry land.

---

## 6. Start anywhere (`app`)

- **Landing screen:** a minimal world map (low-detail, 2D or a simple globe).
  Two ways in:
  - **"Commencer ici"** → `navigator.geolocation` → start at your real lat/lon.
  - **Click any point** on the map → start there.
- On selection: set the session origin, initialise the world frame, prefetch the
  covering tiles, and drop the player in once terrain is ready (brief loading
  state, no hard freeze).
- Graceful fallback if geolocation is denied/unavailable: prompt to pick a point
  (sensible default offered).

**Acceptance:** from a cold load you can geolocate or click a point and be
standing on real terrain of that place within a few seconds.

---

## 7. Education (`education`)

Honest about data limits (see `ARCHITECTURE.md` §6). Designed to fetch sparingly
and cache hard.

- **True odometer:** accumulate real-metre deltas (`haversine` between successive
  lat/lon) into a per-mode and total kilometre count. Always correct, no network.
- **Place labels & borders:** named places near the player from OpenStreetMap;
  fetched on region change, not per frame; cached. Provider/strategy chosen when
  this layer is built (not assumed unlimited/keyless).
- **POI cards:** a small card on approaching a notable place (name, a fact or
  two) from Wikidata/Wikipedia, cached.
- **Distance-to-capital:** "X km from <capital>" using `haversine`.

**Acceptance:** the odometer matches `haversine`-integrated real distance within
rounding; approaching a named city shows its real name; no per-frame network
calls.

---

## 8. Senses (`audio`, `render`)

Minimal, atmospheric, never noisy.

- **Audio (WebAudio):** engine tone whose pitch tracks speed (driving), wind
  ambience, water lapping when swimming/boating. Initialised on first user
  gesture (autoplay policy); mute toggle.
- **Day–night:** a sun that arcs; sky/fog colour and light intensity lerp with
  time of day; a key to fast-forward time.
- **Weather:** light, optional (e.g. drifting clouds / occasional rain), kept
  subtle.

**Acceptance:** sound starts only after a gesture and tracks state; the
day–night cycle visibly changes lighting; nothing here costs noticeable frame
time.

---

## 9. Build order & gates (the contract)

Strict order. A layer's gate must pass before the next starts.

1. **`core/geo` + `core/state`** — projection, geodesy, floating origin. Unit
   tests green. *(Gate: §1 + §2 acceptance.)*
2. **`data/elevation`** — tile fetch, decode, `heightAt`, cache, `isWater`.
   *(Gate: §3 acceptance, incl. a real summit + mid-ocean check.)*
3. **Foundation visible** — `world/streaming` + `world/terrain` + minimal
   `render` loop: real terrain of a chosen point streaming with LOD.
   *(Gate: §4 acceptance — **this is the make-or-break milestone**.)*
4. **Locomotion (land)** — car / walk / run, exit / leave / recall.
   *(Gate: §5 land clauses.)*
5. **Water** — classification, swim, boat. *(Gate: §5 water clauses.)*
6. **Start anywhere** — world-map picker + geolocation. *(Gate: §6.)*
7. **Education** — odometer, labels, POIs, distances. *(Gate: §7.)*
8. **Senses** — audio, day–night, weather. *(Gate: §8.)*

Each gate is demonstrable in the running app, not just asserted.

---

## 10. Out of scope for V1 (roadmap)

Accounts/Gmail auth, persistent server-side position, multiplayer, VR/WebXR, any
backend. The all-lat/lon design keeps these doors open; we do not build them now.
See `ARCHITECTURE.md` §7.
