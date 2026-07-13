# Village Dressing Export Settings

The generator exports two independent files directly with Blender 4.5.9 LTS's
built-in glTF 2.0 exporter:

- `public/village/thornvale-village-dressing.glb` (known-good baseline props)
- `public/village/pilot/v1/thornvale-arrival-plaza.glb` (pilot v1 landmarks)

## Geometry and material policy

- Metric scale: 1 unit = 1 meter
- Runtime axis conversion: glTF Y-up
- Runtime front: +Z
- Bevel modifiers are applied before export
- Meshes are joined per root and material to reduce runtime nodes and draw calls
- Principled materials use colors and scalar PBR values only
- No UVs, image textures, morphs, skins, cameras, lights, or animation
- Normals and object extras are retained
- Draco compression is disabled so the asset has no decoder requirement

## glTF operator settings

```text
format                 GLB
selection only         true
Y up                    true
apply transforms        false
cameras / lights        false
custom properties       true
texcoords / tangents    false
normals                 true
materials               export
animations / skins      false
Draco                   false
shared accessors         true
```

Each GLB scene has exactly three top-level nodes. The baseline contains
`VillageWayfinder`, `GardenArch`, and `StoneWell`; pilot v1 contains
`WelcomeGate`, `CommunityLedger`, and `TownBell`. Their staged translations are
intentional and live only on the roots. Reset a selected root's position before
placing it in a runtime scene.

Pilot v1 retains one transform node, `TownBellSwing`, so the runtime can apply
the existing idle and interaction-driven ringing motion. Meshes beneath that
pivot are still consolidated by material.

The verified export contains 32 nodes, 29 meshes, 13 materials, 5,284 source
vertices, 9,996 triangles, and no images, textures, or animations. Its size is
407,240 bytes.

Pilot v1 contains 34 nodes, 30 meshes, 11 materials, 3,732 source vertices,
7,016 triangles, and no images, textures, or animation clips. Its size is
326,584 bytes, below the pilot limits of 800 KiB, 22,000 triangles, and 50
primitives.
