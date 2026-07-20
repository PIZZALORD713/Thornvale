# ADR 0008: Pizza Lab Wayfinder asset promotion

- Status: Accepted for Wayfinder v1
- Date: 2026-07-20

## Context

World Stage v1 provided full spatial context but could publish only the
Wayfinder root placement. The generated baseline GLB consolidates the sign
boards by material, so it cannot preserve named child edits. Treating an
arbitrary edited scene as the new runtime asset would also admit accidental
changes to the post, materials, topology, placement, colliders, and interactions.

## Decision

Create a project-authored `thornvale-wayfinder-pizza-lab-v1` asset family from
the deterministic village-dressing generator. Its editable `.blend` exposes
three named board assemblies. Candidate export records only their transforms,
then a clean headless Blender process rebuilds the canonical Wayfinder and
applies those transforms before material consolidation and Draco GLB export.

Candidate and promotion validators require the exact family, root, source and
generator hashes, World Stage layout hash, three assembly IDs, transform
envelopes, ten material names, ten Draco primitives, 1,488 triangles, grounded
bounds, clean re-import, and a 31,000-byte cap. Promotion writes a standalone
versioned runtime GLB and generated descriptor. The existing `?assets=baseline`
path skips it; pilot load failure falls back only the Wayfinder to the combined
baseline village GLB.

`TOWN_LAYOUT` and `TownBuilder` remain authoritative for placement, physics,
camera collision, grass clearance, and interaction. The source `.blend` is the
editable visual source, not the game-map authority.

## Consequences

- Sign size and height can complete a Blender-to-browser round trip without
  giving Blender authority over gameplay contracts.
- Earlier edits made against material-consolidated meshes cannot be migrated
  reliably and must be reapplied to the named assemblies.
- A candidate can fail independently without removing Garden Arch or Stone Well.
- Any future editable object or material needs its own bounded source,
  validation, provenance, runtime selection, and fallback contract.
