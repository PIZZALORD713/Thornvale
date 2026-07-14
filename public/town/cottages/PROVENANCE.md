# Thornvale cottage runtime asset provenance

## Runtime contract

- File: `thornvale-cottages.glb`
- Format: binary glTF 2.0 (`.glb`)
- Generator: Blender 4.5.9 LTS via `scripts/build-town-cottages.py`
- Editable source: `assets-src/town-cottages/thornvale-cottages.blend`
- Scale: 1 unit = 1 meter
- Runtime up axis: `+Y`
- Runtime front axis: `+Z`
- Textures: none; all materials use named PBR factors and solid colors
- Compression: uncompressed glTF geometry; ready for a later measured Draco pass
- Export size: 564,844 bytes
- Deterministic SHA-256: `af5afde73586fb7d4d72f6dff6b1d456e113cee1e4bda5e1c45f82497029326c`

The GLB has exactly four top-level roots, all exported at `(0, 0, 0)` with unit
scale:

- `Cottage_berry_bakery`
- `Cottage_lavender_library`
- `Cottage_mint_tea_house`
- `Cottage_rose_post_office`

Each root contains static geometry merged by material. Runtime code should keep
the top-level root name, set its world transform from town placement data, and
remap `MAT_WindowGlow` if Thornvale's shared animated window material is used.
The `MAT_WindowGlow` source material includes emissive glTF data and runtime-role
metadata.

## Authored identity

- Bakery: broad berry awning, scalloped valance, oversized oven chimney, hanging
  bread crest, window boxes.
- Library: taller body, full front dormer, tall windows, hanging open-book sign.
- Tea house: layered curled-eave roofs, veranda, pavilion posts, climbing trellis.
- Post office: covered porch, mail slot, envelope crest, parcel bench and parcels.

## Validation record

Clean Blender glTF re-import on 2026-07-14 confirmed:

| Root | Meshes | Triangles | Vertices |
| --- | ---: | ---: | ---: |
| `Cottage_berry_bakery` | 12 | 8,780 | 4,568 |
| `Cottage_lavender_library` | 9 | 6,760 | 3,506 |
| `Cottage_mint_tea_house` | 12 | 7,700 | 3,978 |
| `Cottage_rose_post_office` | 9 | 7,212 | 3,730 |

All roots passed the 15-mesh-per-cottage budget and re-imported at origin with
unit scale. Geometry extends beyond nominal wall footprints for authored porches,
roof overhangs, signs, and landscaping details; gameplay collision should remain
simple authored boxes rather than derive from these render bounds.

## Rebuild integrity

The asset contains only project-authored procedural geometry and materials. If
the source or exporter changes, regenerate the GLB, rerun the clean import
validation, and update the counts above when they differ.

The build script canonicalizes triangle insertion before Blender derives smooth
normals and canonicalizes exported index ordering afterward. Four clean,
parallel Blender 4.5.9 LTS builds produced byte-identical GLBs with the SHA-256
recorded above.

The 2026-07-14 rebuild also verifies that both curled tea-house roofs use simple
closed cross-sections and that every triangle on their four end-cap planes has
consistent outward winding. The main roof and veranda canopy do not intersect,
and the modeled canopy remains seated on its posts without entering the door
lintel. The stable runtime URL and procedural cottage fallback remain unchanged.
