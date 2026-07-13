# Arrival/Plaza Pilot v1 Provenance

`thornvale-arrival-plaza.glb` contains three original Thornvale storybook
landmarks: `WelcomeGate`, `CommunityLedger`, and `TownBell`.

- Status: `project-authored`
- Source generator: `scripts/build-village-dressing.py`
- Editable generated source: `assets-src/village-dressing/thornvale-village-dressing.blend`
- Blender version: 4.5.9 LTS
- Asset version: 1.0.0
- Export format: binary glTF 2.0 (`.glb`)
- Geometry source: project-authored Blender primitives and curves
- Materials: project-authored scalar/color PBR materials
- External textures, fonts, scans, or model inputs: none
- Runtime unit: meter
- Runtime up/front axes: +Y / +Z
- Authored/exported: 2026-07-12

The source `.blend` stages the roots apart for review. Runtime resets each root
translation before placing it at the existing gate, Ledger, or Bell coordinate.
`TownBellSwing` is intentionally preserved as the bell's animation pivot. The
pilot changes presentation only; gameplay positions, colliders, interaction
radii, and interactable IDs remain owned by `src/config/town.js` and
`src/game/TownBuilder.js`.

## Verified build

- GLB size: 326,584 bytes
- Scene nodes: 34
- Meshes / primitives: 30
- Materials: 11
- Source vertices / triangles: 3,732 / 7,016
- Images / textures / animation clips: 0 / 0 / 0
- GLB SHA-256: `45725c402431f00a65082a27e6db0ad04d03cfdd3cf8f104907372639b52549b`

The asset is below the pilot caps of 800 KiB, 22,000 triangles, and 50
primitives. Blender 4.5.9 LTS generated the file successfully, and automated
tests validate all three root names plus the `TownBellSwing` runtime pivot.
