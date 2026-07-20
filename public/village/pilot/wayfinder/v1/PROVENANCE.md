# Pizza Lab Wayfinder v1 Provenance

`thornvale-wayfinder.glb` is the first bounded Blender-to-browser geometry
candidate from the Pizza Lab World Stage. It contains the project-authored
`VillageWayfinder` root; only the three sign-board assemblies may differ from
the deterministic baseline generator.

- Status: `project-authored`
- Family: `thornvale-wayfinder-pizza-lab-v1`
- Canonical generator: `scripts/build-village-dressing.py`
- Editable source: `assets-src/pizza-lab/wayfinder-v1/thornvale-wayfinder-authoring.blend`
- Blender version: 4.5.9 LTS
- Asset version: 1.0.0
- Export: binary glTF 2.0, Y-up, Draco level 6
- External textures, fonts, scans, or model inputs: none
- Runtime placement/collider authority: `src/config/town.js` and `src/game/TownBuilder.js`
- Baseline fallback: `public/village/thornvale-village-dressing.glb#VillageWayfinder`

## Verified candidate

- GLB size: 28,164 bytes
- Scene nodes / meshes / primitives / materials: 11 / 10 / 10 / 10
- Vertices / triangles: 2,848 / 1,488
- Runtime bounds min: -1.150152, -0.343007, -0.0392
- Runtime bounds max: 1.149798, 0.260265, 2.76
- GLB SHA-256: `a8c0f393bf598bdf82f9e9e517ce441df6e248b23af77eb300e375257d7d5d42`
- Authoring source SHA-256: `7622200d4ebd1eb4ccdf04b976030a1e61daed0e76c8877f478f12a8fdf1ba02`

The pilot changes presentation only. The browser keeps the existing Wayfinder
placement, physics collider, camera proxy, grass clearance, and interaction
contracts. Explicit `?assets=baseline` skips this asset, and a pilot load
failure falls back to the baseline Wayfinder without affecting other props.
