# Village Dressing Provenance

`thornvale-village-dressing.glb` contains three original Thornvale storybook
props: `VillageWayfinder`, `GardenArch`, and `StoneWell`.

- Source generator: `scripts/build-village-dressing.py`
- Editable generated source: `assets-src/village-dressing/thornvale-village-dressing.blend`
- Blender version: 4.5.9 LTS
- Export format: binary glTF 2.0 (`.glb`)
- Geometry source: project-authored Blender primitives and curves
- Materials: project-authored scalar/color PBR materials
- External textures or model inputs: none
- Runtime unit: meter
- Runtime up/front axes: +Y / +Z
- Authored/exported: 2026-07-12

The source `.blend` stages the roots apart for review. All component geometry is
stored relative to its named root, allowing runtime code to zero the root
translation and place each prop independently.

## Verified build

- GLB size: 407,240 bytes
- Scene nodes: 32 (3 named roots + 29 material-consolidated mesh nodes)
- Meshes: 29
- Materials: 13
- Source vertices / triangles: 5,284 / 9,996
- Images / textures / animations: 0 / 0 / 0
- GLB SHA-256: `bf5540deb62a3b14317350d0e04207a311a49c0e0fe068691e18203a930a22be`

Blender 4.5.9 LTS successfully re-imported the GLB and recovered all three
named roots with their expected child meshes.
