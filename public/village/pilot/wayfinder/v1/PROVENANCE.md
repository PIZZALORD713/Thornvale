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
- Asset version: 1.1.0
- Export: binary glTF 2.0, Y-up, Draco level 6
- External textures, fonts, scans, or model inputs: none
- Runtime placement/collider authority: `src/config/town.js` and `src/game/TownBuilder.js`
- Baseline fallback: `public/village/thornvale-village-dressing.glb#VillageWayfinder`

## Verified candidate

- GLB size: 29,408 bytes
- Scene nodes / meshes / primitives / materials: 11 / 10 / 10 / 10
- Vertices / triangles: 2,947 / 1,488
- Runtime bounds min: -1.213606, -0.739104, -0.0392
- Runtime bounds max: 1.14962, 1.204219, 2.76
- GLB SHA-256: `ff671fe0bbf5fc41431d778eccb01fc94c53def419050975a353b0031557f0bc`
- Authoring source SHA-256: `0e78c994f428706d832995eb7ccc91e49287a0e9d0ca607a6abefb346cbb91fb`

The pilot changes presentation only. The browser keeps the existing Wayfinder
placement, physics collider, camera proxy, grass clearance, and interaction
contracts. Explicit `?assets=baseline` skips this asset, and a pilot load
failure falls back to the baseline Wayfinder without affecting other props.
