# World Explorer — Architecture & Vision

> Status: design locked for V1 · Last updated: 2026-06-27
> Companion document: [`V1-SPEC.md`](./V1-SPEC.md) (detailed V1 contracts)

This is the master design document. It describes the product vision, the full
layered architecture, the module boundaries, the cross-cutting concerns that
shape every layer, and the post-V1 roadmap. The detailed, build-ready contracts
for V1 live in `V1-SPEC.md`.

---

## 1. Vision

Explore the **real Earth** in your browser — freely, calmly, and to learn.

Minimalist and meditative like [Slow Roads](https://slowroads.io), but where
Slow Roads invents an infinite procedural world, World Explorer renders the
*actual* planet: real elevation, real coastlines, real distances, real places.

You open the app and start **where you actually are** (browser geolocation), or
pick any point on the globe. Then you move through the world however the terrain
allows:

- On **land**: drive, walk, or run. Leave your car anywhere; recall it from your
  inventory when you want it back.
- On **water**: swim (slow) or deploy a boat (fast). Oceans, seas and lakes are
  real, derived from the same elevation data.

As you travel you **learn**: real place names, borders, the feel of real
terrain, and a true odometer counting real kilometres.

### The honest scope boundary

The real Earth is enormous. At walking speed, crossing a country takes *weeks*
of real time. Slow Roads works because it is an endless cruise, not a journey
from A to B. World Explorer makes the same peace with scale:

> We never preload "the world." We make **any region instantly explorable at
> true scale**, streamed around you as you move. Long-haul travel uses a start
> point chosen on a world map (plus time/▶ fast-forward); fine exploration —
> on foot, swimming, by boat — happens locally.

This single reframe is what makes the whole thing possible in a browser.

---

## 2. Layered build plan

The product is built in layers. **Each layer is independently playable, and we
do not start a layer until the one below it actually works.** This gating is
not a suggestion — it is how we keep a very ambitious V1 from collapsing into a
half-finished monolith.

| # | Layer | What it unlocks | Risk |
|---|-------|-----------------|------|
| 0 | **Foundation** | Real terrain of a real place streaming under you. Tile streaming + LOD + local projection + floating origin. | ★★★ the real engineering |
| 1 | **Locomotion** | Car ↔ walk ↔ run. Exit / leave / recall the vehicle. Ground-clamped movement, follow camera. | ★★ |
| 2 | **Water** | Land/water classification, swimming, boats. Real oceans, seas, lakes. | ★★ |
| 3 | **Start anywhere** | A minimal world map: "Start here" (geolocation) or click any point on Earth; the engine loads that region. | ★★ |
| 4 | **Education** | Real place names, borders, POI cards, true-kilometre odometer, distance-to-capital. | ★★ (data limits — see §6) |
| 5 | **Senses** | Engine / wind / water sound, day–night cycle, light weather. Atmosphere, kept minimal. | ★ polish |

V1 = layers 0 → 5, single-player, fully client-side. "V1 très très complète"
means **all six layers shipped and gated**, not a sprawling spec built at once.

---

## 3. Coordinate systems & projection (the spine)

Three coordinate spaces, with explicit conversions between them. This is the
spine of the whole engine; everything else assumes it is correct.

1. **Geographic** — WGS84 latitude/longitude. The canonical, persistent
   representation. Vehicles, the player, POIs, the start point: all stored as
   lat/lon. The roadmap (accounts, multiplayer) depends on this being the
   source of truth everywhere.

2. **Tile space** — Web Mercator XYZ ("slippy map"). Terrarium elevation tiles
   are addressed as `z/x/y`. Standard conversions:
   - `x = floor((lon + 180) / 360 * 2^z)`
   - `y = floor((1 - ln(tan(lat) + sec(lat)) / π) / 2 * 2^z)`

3. **World space** — a local **ENU (East-North-Up) tangent plane** anchored at a
   session origin `(lat0, lon0)`. Three.js renders here, in metres:
   - `east  = (lon - lon0) · cos(lat0) · R · π/180`
   - `north = (lat - lat0) · R · π/180`   (R = 6 378 137 m)
   - Up = elevation in metres from the height field.

   Accurate at regional scale, which is all a tangent plane is ever asked to
   cover before the origin rebases.

### Floating origin (non-negotiable)

WebGL vertices are float32. "Travel real kilometres" + a fixed world origin =
visible vertex jitter once you are tens of km out. So the world origin
**rebases**: when the player passes a threshold distance from the current origin
(e.g. ~8 km), we move the world origin to the player and translate every loaded
object by the same offset. The geographic truth (lat/lon) never changes; only
the local rendering frame shifts. Designed in from day one because retrofitting
it is painful.

---

## 4. Module boundaries

Small, single-purpose modules with clear interfaces. The pure math modules
(`core/geo`) are testable with no browser and no network.

```
src/
  core/
    geo/          Projection, tile math, lat/lon↔world, distance. Pure, tested.
    state/        Session origin, floating-origin rebasing, game clock.
  data/
    elevation/    TileSource: fetch terrarium PNG, decode, cache. heightAt().
    landcover/    Land/water classification (sea level from elevation; OSM later).
  world/
    streaming/    TileManager: which tiles at which LOD, load/evict, memory cap.
    terrain/      Terrain mesh generation (in a Worker), biome vertex coloring.
    water/        Water surfaces and shading.
  entities/
    locomotion/   Locomotion state machine; player + vehicle entities; inventory.
    camera/       Follow / orbit camera per locomotion state.
  render/         Three.js scene, lighting, fog, day–night, render loop.
  education/      Place labels, borders, POI cards, odometer, distances.
  audio/          WebAudio: engine, wind, water ambience.
  app/            Start screen, geolocation, world-map picker, HUD, bootstrap.
```

Dependency direction points inward: `app` → `world`/`entities` → `data` →
`core`. `core/geo` depends on nothing.

---

## 5. Key runtime systems

- **Data layer.** `TileSource` fetches a terrarium PNG (`z/x/y`), decodes RGB to
  a Float32 height field via the Terrarium formula
  `h = (R·256 + G + B/256) − 32768`, and caches it. `heightAt(lat, lon)` resolves
  the right tile and bilinearly samples it. This single function is what every
  other system stands on — see `V1-SPEC.md` for its exact contract.

- **Streaming + LOD.** `TileManager` computes the set of tiles needed around the
  player: high zoom near, lower zoom far (concentric LOD rings). Tiles load
  asynchronously, meshes are built in a Worker (transferable buffers), and an
  LRU cap evicts far tiles to hold a fixed memory budget. LOD seams are hidden
  with skirts.

- **Terrain rendering.** Each tile becomes a flat-shaded, low-poly mesh,
  vertex-coloured by a biome palette (elevation × slope × latitude). Distance
  fog blends the LOD horizon. Deliberately stylized — clean, not photoreal.

- **Locomotion state machine.** States: `DRIVING`, `WALKING`, `RUNNING`,
  `SWIMMING`, `BOATING`. The surface under the player (land vs water, from the
  data layer) gates which states are valid. Vehicles persist in the world at
  their lat/lon when left behind, and can be recalled from the inventory. Each
  state owns its speed, simple physics, ground-clamping, and camera.

- **Education layer.** Real names/borders from OpenStreetMap, POI cards from
  Wikidata/Wikipedia, a true-kilometre odometer accumulating real-metre deltas,
  and "X km from <capital>". See §6 for the honest data caveats.

- **Senses.** Procedural WebAudio (engine pitch with speed, wind, water), a
  day–night sun cycle, and light weather. Minimal by design.

---

## 6. Data sources — honestly

- **Elevation — Terrarium / AWS Terrain Tiles.** Free, **no API key**,
  `Access-Control-Allow-Origin: *` (browser-fetchable), global coverage,
  including bathymetry (negative elevations below sea level). Verified live on
  2026-06-27. This is the one foundational dependency, and it is solid. Provide
  attribution per the dataset's terms.

- **Land/water (V1).** Derived directly from elevation: sea where
  `elevation ≤ 0`. Inland lakes/rivers need vector data and are refined in the
  education layer, not assumed in the foundation.

- **Place names / borders / POIs — OpenStreetMap & Wikidata. Not as free as
  elevation, and the docs must not pretend otherwise.** Overpass API has strict
  rate limits and is *not* meant for live per-frame streaming; most vector-tile
  providers require an API key. The education layer is therefore designed to
  fetch sparingly (named places near the player, cached aggressively), and we
  will choose a concrete provider/strategy when we reach Layer 4 — not bake an
  unrealistic "no key, unlimited" assumption into the foundation.

---

## 7. Post-V1 roadmap

Gravée — engraved — but explicitly *not now*. V1's all-lat/lon design keeps
every one of these doors open:

1. **Accounts (Gmail / OAuth) + persistent position.** A backend stores your
   unique position on Earth as lat/lon. Pure addition above the world; the world
   engine doesn't change.
2. **Multiplayer.** A realtime server syncs player positions/state. You cross
   paths with real people on the real map.
3. **VR (WebXR).** Three.js already supports WebXR; once the world runs well,
   VR is mostly camera/control adaptation, not a rewrite.
4. **Studio.** If it grows, it grows — on top of a core that was built clean.

---

## 8. Principles

- **Layer by layer, gated.** Never build on a floor that isn't solid.
- **lat/lon everywhere.** Geographic truth is the source of truth; world space is
  a disposable render frame.
- **Honest about limits.** Especially data sources. No magical-thinking specs.
- **Propre, épuré, complet.** Clean, minimal, complete. That *is* the product.
