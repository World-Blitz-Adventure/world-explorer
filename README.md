# World Explorer

Explore the **real Earth** in your browser — freely, calmly, and to learn.

Minimalist and meditative in the spirit of [Slow Roads](https://slowroads.io),
but built on real geographic data: real terrain, real coastlines, real
distances, real places. Start where you are (or anywhere on the planet) and move
through the world by **car, on foot, running, swimming, or by boat** — what you
can do depends on what's under you.

> Status: design phase. The architecture and the V1 specification are locked.
> Implementation begins layer by layer.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — vision, layered architecture,
  module boundaries, data sources, and the post-V1 roadmap.
- [`docs/V1-SPEC.md`](docs/V1-SPEC.md) — build-ready V1 contracts and gated
  milestones.
- [`CLAUDE.md`](CLAUDE.md) — contributor & agent guide, commit conventions.

## Tech

Three.js (WebGL), Web Workers, real elevation from free global terrain tiles —
all client-side for V1, no backend.

## Roadmap (post-V1)

Accounts & your unique position on Earth → multiplayer → VR (WebXR) → studio.
