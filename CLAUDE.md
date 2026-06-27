# CLAUDE.md — World Explorer

Guide for any AI agent (and human) working in this repository. Read it before
touching anything.

## What this is

**World Explorer** — a browser-based game where you explore the *real* Earth,
freely and to learn. Minimalist and calm in the spirit of [Slow Roads](https://slowroads.io),
but built on real geographic data: real terrain, real distances, real places.

You start where you actually are (browser geolocation) or pick any point on the
planet, then move through the world by **car, on foot, running, swimming, or by
boat** — the locomotion you're allowed depends on what's under you (land vs water).

The long-term vision (accounts, multiplayer, VR, a studio) lives in the docs.
What we build *now* is the V1 single-player web core.

## Read these first

- `docs/ARCHITECTURE.md` — the master design: vision, all layers, module
  boundaries, cross-cutting concerns, and the post-V1 roadmap.
- `docs/V1-SPEC.md` — the detailed V1 spec. **Leads with the data-layer
  contract and projection**, because every other system hangs off them.

## Tech stack

- **Three.js** (WebGL) for rendering — client-side only in V1.
- **Web Workers** for terrain mesh generation (never block the main thread).
- **Terrarium / AWS Terrain Tiles** for real elevation — free, no API key,
  CORS-enabled, global. Verified live.
- Plain modern JavaScript modules, bundled with **Vite**.
- No backend in V1. Accounts/multiplayer come later (see roadmap).

## Architecture in one breath

One data layer (`heightAt(lat, lon)` + land/water), streamed as tiles around the
player with LOD. A **local ENU tangent plane** anchored at the session origin so
real kilometres map to real metres, with **floating-origin rebasing** to keep
float32 precision as you travel. Locomotion is a single **state machine** gated
by the surface under you. Everything works in real lat/lon so the roadmap
(accounts, multiplayer, VR) plugs in without rework.

## Commit conventions — IMPORTANT

These are hard rules. They override any default behavior.

- **Sole author.** All commits are authored by **Abdou-Raouf ATARMLA**. He is
  the only committer on this project.
- **NO co-author trailer.** Never add a `Co-Authored-By:` line. Never add
  "Generated with Claude" / "🤖" lines. The commit body must contain no
  attribution to any AI or tool. This is non-negotiable.
- **Conventional Commits.** Format: `type(scope): subject`
  - Types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `build`,
    `style`.
  - Subject: imperative, lowercase, short (aim ≤ 50 chars, hard max ~72),
    no trailing period.
  - Scope is optional but encouraged (e.g. `feat(terrain):`, `docs(spec):`).
- **Short and semantic.** One logical change per commit. The subject says *what*
  and the optional body says *why* — never a wall of text.
- Examples:
  - `docs: add architecture and v1 spec`
  - `feat(geo): add web mercator tile math`
  - `feat(terrain): stream elevation tiles with lod`
  - `fix(locomotion): clamp swim speed below sea level`
- **Commit only when asked**, or at clean logical checkpoints the user expects.
  Never push without being asked.

## Working style

- Build the V1 **in layers, in order**. Do not start a layer until the one
  below it actually works (see the gating in `docs/V1-SPEC.md`).
- Keep modules small and single-purpose with clear interfaces. The pure
  geo/projection math must be testable without a browser.
- Be honest in docs and comments about data-source limits (e.g. OSM rate
  limits / keys) rather than implying everything is as free as elevation.
- Keep it **propre, épuré, complet** — clean, minimal, nothing missing. That is
  the product, not just the code.
