# Village Dressing Source

The Village Dressing kit is original project artwork authored procedurally from
Blender primitives. It does not incorporate downloaded models, image textures,
fonts, scans, or third-party geometry.

## Source of truth

- Generator: `scripts/build-village-dressing.py`
- Blender source: `thornvale-village-dressing.blend`
- Reference render: `thornvale-village-dressing-preview.png`
- Runtime export: `public/village/thornvale-village-dressing.glb`
- Authoring version: Blender 4.5.9 LTS
- Authored: 2026-07-12

The generator is deterministic: it clears the factory scene and recreates all
geometry, materials, hierarchy, staging, lighting, and export settings from
fixed values. Re-run it instead of hand-editing the generated `.blend` when the
kit changes.

## Asset roots

| Root | Staged Blender position | Local origin | Approximate footprint |
| --- | --- | --- | --- |
| `VillageWayfinder` | `(-5.2, 0, 0)` | Ground center beneath post | 2.25 x 0.85 m |
| `GardenArch` | `(0, 0, 0)` | Ground center of opening | 2.65 x 0.90 m |
| `StoneWell` | `(5.2, 0, 0)` | Ground center of well | 2.55 x 2.15 m |

Only each root carries its showcase translation. Its children are consolidated
in root-local space, so a runtime can reset the root to `(0, 0, 0)` and place it
without compensating for baked stage offsets.

## Coordinate convention

- One Blender unit is one meter.
- Blender source is Z-up.
- Blender `-Y` is the authored front so the exported Y-up glTF faces `+Z`.
- Runtime pivots sit at ground level, centered on each prop footprint.

## Rebuild

```bash
/Applications/Blender-4.5-LTS.app/Contents/MacOS/Blender \
  --background --factory-startup \
  --python scripts/build-village-dressing.py
```
