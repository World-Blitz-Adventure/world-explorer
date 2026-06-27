# World Explorer — Roadmap to "GTA-feel, Slow-Roads-style"

> Living checklist. We do these **one at a time, done exceptionally well**, and
> tick them off. Honest north star: not literal AAA (that's hundreds of people /
> years), but the most polished, smooth, beautiful real-Earth explorer a browser
> can run — Slow-Roads craft on the real planet.

Status: ✅ done · 🔄 in progress · ⬜ to do

---

## Foundation (engine) — done
- ✅ Real-Earth elevation streaming (Terrarium tiles, LOD-ready, Web Worker)
- ✅ Floating-origin world frame (real km without precision loss)
- ✅ Locomotion core: drive / walk / run, leave & recall the car

## Phase A — Feel & core look (make it *feel* and *look* good)
- ✅ A1 — Smooth chase camera + vertical look (pitch)
- ✅ A2 — Movement inertia (acceleration, coasting)
- ✅ A3 — Tiled ground detail texture (grain × biome)
- ⬜ A4 — **Sky & atmosphere**: gradient sky, sun disc, tuned fog, daylight color ← *next*
- ⬜ A5 — Real texture packs (grass / rock / snow / sand) blended by elevation & slope
- ⬜ A6 — Water surface: shaded oceans, lakes, rivers
- ⬜ A7 — Vegetation done right: grass detail + nicer trees (no cones)
- ⬜ A8 — Vehicle & character pass: real-looking car (wheels turn, lean), better avatar
- ⬜ A9 — HUD + world map/globe: speed, km, mode, compass, place name, **your position on a globe**

## Phase B — The living world (educational, open-world content)
- ⬜ B1 — Roads & paths from OpenStreetMap — actually drive real roads
- ⬜ B2 — Cities & buildings (OSM extrusions)
- ⬜ B3 — Place names, country borders, POI cards, **real-kilometre odometer**, "X km from <capital>"
- ⬜ B4 — Start anywhere: geolocation ("start where I am") or click any point on Earth

## Phase C — Senses & robustness
- ⬜ C1 — Audio: engine (pitch with speed), wind, ambience
- ⬜ C2 — Day/night cycle + light weather
- ⬜ C3 — Tile robustness (retry failed tiles, fill holes), draw distance & LOD, performance budget

---

## Roadmap (beyond this game) — engraved, later
Accounts via Gmail + your unique position on Earth → multiplayer (cross paths) →
VR (WebXR) → studio. The all-lat/lon design keeps these doors open.

## How we work
One task at a time. Pure logic is unit-tested; the *feel/look* is judged live in
the browser — Raouf is the eyes (the dev tab's render loop is throttled when not
focused). Each task: build → push → look → tune → next.
