# Village Dressing Source

The Village Dressing kit is original project artwork authored procedurally from
Blender primitives. It does not incorporate downloaded models, image textures,
fonts, scans, or third-party geometry.

## Source of truth

- Generator: `scripts/build-village-dressing.py`
- Blender source: `thornvale-village-dressing.blend`
- Reference render: `thornvale-village-dressing-preview.png`
- Baseline runtime export: `public/village/thornvale-village-dressing.glb`
- Pilot runtime export: `public/village/pilot/v1/thornvale-arrival-plaza.glb`
- Authoring version: Blender 4.5.9 LTS
- Authored: 2026-07-12

The generator is deterministic: it clears the factory scene and recreates all
geometry, materials, hierarchy, staging, lighting, and export settings from
fixed values. Re-run it instead of hand-editing the generated `.blend` when the
kit changes.

The asset manifest hashes the generator as the canonical source. The `.blend`
and preview PNG are generated review artifacts, so a no-op rebuild may replace
them without creating false source-integrity failures in the asset audit.

## Asset roots

| Root | Staged Blender position | Local origin | Approximate footprint |
| --- | --- | --- | --- |
| `VillageWayfinder` | `(-5.2, 0, 0)` | Ground center beneath post | 2.25 x 0.85 m |
| `GardenArch` | `(0, 0, 0)` | Ground center of opening | 2.65 x 0.90 m |
| `StoneWell` | `(5.2, 0, 0)` | Ground center of well | 2.55 x 2.15 m |
| `WelcomeGate` | `(-5.2, 4.2, 0)` | Ground center of threshold | 4.75 x 0.95 m |
| `CommunityLedger` | `(0, 4.2, 0)` | Ground center beneath board | 2.05 x 0.55 m |
| `TownBell` | `(5.2, 4.2, 0)` | Ground center of plinth | 1.65 x 1.35 m |

Only each root carries its showcase translation. Its children are consolidated
in root-local space, so a runtime can reset the root to `(0, 0, 0)` and place it
without compensating for baked stage offsets.

The first three roots remain the known-good baseline dressing export. The
arrival/plaza roots are exported separately as pilot v1 so `?assets=baseline`
never depends on pilot geometry. `TownBellSwing` is retained beneath
`TownBell` as a named runtime pivot; all other mesh transforms are baked.

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
