# fRiENDSiES stewardship tools v1 runtime provenance

## Permission status

- Manifest family ID: `friendsies-project`
- Creator: fRiENDSiES
- Authorization: ADR 0004 standing project-wide fRiENDSiES authorization
- Manifest status: `project-release-authorized`
- Release blocked: no for source identity or authorization
- Raw-source and standalone asset-pack redistribution: prohibited
- Runtime distribution: integrated Thornvale builds, tools, documentation,
  testing, and Thornvale promotion

## Runtime contract

| Runtime file | Source input | Transform | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| `axe-v1.glb` | Canonical `2e7d86ace19eafc64df6be34dbd82483.glb` | Bundled unchanged | 146,792 | `866cef9aec2a8817983e150f38e8634990c9038864d6a69fad67c5c26c4c98ba` |
| `fishing-pole-v1.glb` | Canonical `a7c18d32c3575842b53793691ab74e55.glb` | Bundled unchanged | 368,156 | `f7fd184057ea34c3a2a0b3ee0c0f5f5a2acfa978182ecd73758eb2b65b91b1b1` |

### Axe runtime presentation

- Runtime URL: `/friendsies/tools/axe-v1.glb`
- Exact trait: `hand:Axe`, single canonical variant represented by 19 tokens
- Format: glTF 2.0 binary with required `KHR_draco_mesh_compression`
- Geometry: one mesh, one primitive, 1,504 triangles, 1,149 uploaded vertices
- Materials: one opaque, double-sided material with base-color, normal, and
  metallic-roughness textures
- Embedded textures: three 512x512 PNG images
- Rig: one skin with the canonical 20-joint fRiENDSiES hierarchy
- Required roots and names: scene `Scene`, root `Character Rig`, mesh node `X`,
  mesh `Mesh.339`, animation `Idle Float`
- Axes and placement: glTF Y-up; runtime code owns visual normalization, grip
  pivot, scale, and swing orientation while gameplay owns the tool and tree state
- Runtime contexts: in-world Axe discovery and equipped woodcutting tool

The file remains unchanged from the canonical source. Axe v1 preserves its
skinned hierarchy and applies only a Thornvale-authored parent transform for
normalization, grip, and swing placement. Any future static frame-zero bake
must first prove the decoded mesh is rigidly weighted. Either arrangement is
presentation, not a new canonical fRiENDSiES trait or binary derivative.

## Default and failure fallback

The canonical Axe is an optional visual enhancement. Loading, Draco decoding,
renderable-geometry validation, finite-bounds validation, or material setup must fail locally and retain the
code-native procedural Axe. Asset failure must not block startup, discovery,
woodcutting, tree persistence, inventory rewards, save/load, or the complete
story route. The stable action anchor—not the loaded mesh—owns chop motion so
canonical and fallback visuals share the same gameplay timing.

### Fishing pole runtime presentation

- Runtime URL: `/friendsies/tools/fishing-pole-v1.glb`
- Exact trait: `hand:Guess`, one canonical variant represented by 120 tokens
- ThornVale role: simple fishing pole at the authored pond
- Format: glTF 2.0 binary with required `KHR_draco_mesh_compression`
- Geometry: one mesh, one primitive, 2,464 triangles
- Rigid-weight proof: all 1,523 decoded vertices carry one unit weight to
  `Attachment.R`
- Materials and textures: one material and three embedded images
- Rig: one skin with the canonical 20-joint fRiENDSiES hierarchy
- Required roots and names: scene `Scene`, root `Character Rig`, mesh node `X`,
  mesh `Mesh.108`, animation `Idle Float`
- Axes and placement: decoded storage vertices have a local `+Z` long axis;
  the canonical frame-zero skin projection presents the equipment along `+Y`.
  `FishingWorld` bakes that rigid pose into a static in-memory mesh, normalizes
  it, and places it under the unchanged procedural rod anchor
- Runtime contexts: pond fishing presentation and equipped fishing tool

The canonical pole replaces only the visual rod. `FishingController`, the
stable `day-one-fishing-spot` anchor, bobber, hook, tension state, inventory,
and save data remain independent of the loaded mesh. Missing-file, Draco,
decoded-geometry, or material failure must not block startup or fishing; the
existing procedural rod remains the local fallback.

## Verification

- Source identity and metadata structure:
  `npm run friendsies:probe -- --type hand --value Axe --dry-run`
- Offline manifest/file contract:
  `node --test tests/friendsies-axe-asset.test.js`
- Fishing-pole source/runtime contract:
  `node --test tests/friendsies-fishing-pole-asset.test.js`
- Success and forced-failure projection:
  `node --test tests/stewardship-world.test.js`
- Development asset policy: `npm run assets:audit`
- Completed fishing-pole runtime gate: decoded rigid-weight proof, success and
  forced-failure loader tests, centered frame-zero equipment regression, and a
  headed browser comparison of canonical and forced-fallback active fishing.
- Completed Axe runtime gate: rig-preserving success and forced-failure loader
  tests, mesh/bounds validation, and headed-browser canonical plus forced-
  fallback startup and woodcutting availability.
- Remaining release-candidate breadth: the full day/night, high/low quality,
  reduced-motion, offline startup, save/reset, and complete-story matrix.
