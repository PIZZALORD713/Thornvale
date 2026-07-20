# ADR 0007: Pizza Lab World Stage authority

- Status: Accepted for World Stage v1
- Date: 2026-07-20

## Context

The placement pilot proved Blender-to-runtime coordinate conversion for one
root, but it did not give an artist the spatial context needed to compose the
whole village. ThornVale's static map was also assembled as executable values in
`src/config/town.js`, while real GLBs, the Bell hill mesh, path splines, Rapier
colliders, interaction stations, and story routes consumed overlapping pieces of
that contract.

A hand-maintained `.blend` cannot become a second source of truth. It would drift
from browser physics and gameplay, and `.blend` byte equality is not a useful
release gate.

## Decision

Adopt a versioned JSON World Stage manifest as the static composition contract.
The browser imports its generated copy, while the prior JavaScript construction
remains a temporary rollback and untouched-equivalence oracle. Day One anchors
are rebound to the authoritative `DAY_ONE_V01.anchors` object at assembly time so
presentation, interaction, and recovery retain their shared identity.

A deterministic Node resolver validates the manifest and all three source GLB
hashes, samples paths with the runtime Three.js centripetal Catmull-Rom
implementation, and emits an ignored Blender input. Blender generates a
disposable World Stage containing:

- the ten real cottage, village-dressing, and landmark roots at runtime placement;
- the exact Bell-hill render/physics mesh and resolved path ribbons;
- the meadow, plaza, pond, decorative-hill, and path-apron context;
- building and prop collision volumes, physics bounds, interaction radii, Day
  One anchors, story routes, grass exclusions, and Bell-precinct guides.

Runtime `(x, y, z)` maps to Blender `(x, -z, y)`. Runtime dimensions `(x, y, z)`
map to Blender `(x, z, y)`, and runtime yaw maps to Blender Z rotation with the
same sign.

Blender owns only reviewed static-composition candidates. Gameplay state,
progression, interaction IDs, procedural behavior, animation, and story logic
remain runtime-authoritative. World Stage v1 keeps all context locked except the
already gated Wayfinder root; generic MCP transforms enforce the
`pizza_lab_editable` policy rather than trusting Blender selection locks.
Publication remains two phase: Blender writes a candidate, and the repository
promotion validator updates the browser artifact. Terrain and source-GLB geometry
publication remain closed until each receives its own atomic output, provenance,
physics, rollback, and browser gates.

## Consequences

- Artists and Codex can inspect one spatially complete scene without making the
  `.blend` authoritative.
- Untouched World Stage generation must be observationally equivalent to the
  prior browser layout before any authoring set is expanded.
- Asset-hash drift fails generation instead of silently loading different art.
- Each future editable set must enumerate every visual, collider, interaction,
  navigation, story, and ambient consumer affected by promotion.
- Procedural ambient dressing is represented by its authoritative contract and
  guides in v1; it is not baked into a publishable Blender asset.
