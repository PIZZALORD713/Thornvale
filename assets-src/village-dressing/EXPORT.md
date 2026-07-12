# Village Dressing Export Settings

The generator exports `public/village/thornvale-village-dressing.glb` directly
with Blender 4.5.9 LTS's built-in glTF 2.0 exporter.

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

The GLB scene has exactly three top-level nodes: `VillageWayfinder`,
`GardenArch`, and `StoneWell`. Their staged translations are intentional and
live only on the roots. Reset a selected root's position before placing it in a
runtime scene.

The verified export contains 32 nodes, 29 meshes, 13 materials, 5,284 source
vertices, 9,996 triangles, and no images, textures, or animations. Its size is
407,240 bytes.
