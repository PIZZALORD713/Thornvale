# Story Actions v1 source

## Ownership and permission

- Manifest family ID: `friendsies-story-actions-v1`
- Creator or owning project: Adobe Mixamo motion exported for the fRiENDSiES `8448` rig; Thornvale/fRiENEMiES conversion tooling
- Intended status: `project-use-recorded`
- Authorization family or license: the project owner requested this integrated Thornvale pilot on 2026-07-13; [Adobe's Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) permits royalty-free use of Mixamo characters and animations in video games
- Source item page: <https://www.mixamo.com/>
- Retrieved: 2026-07-12
- Acquisition evidence: Chrome download metadata records signed Mixamo S3 export `export_f999de8b-0212-4186-ace4-c6dba43f8a64` for `Gestures Pack Basic.zip` and `export_1cdfdecf-9b05-49ff-844b-6aa3778995d7` for `Farming Pack.zip`
- Raw-source redistribution allowed: false; ZIPs and FBXs remain in the owner's external archive and are never copied into `public/`
- Release blocker: the existing exact-file Thornvale animation authorization covers the three earlier runtime GLBs, not these six new derivatives; record an explicit exact-file bundled-release grant before release

This record supports an integrated development pilot. It does not claim that
the raw Mixamo exports or derived GLBs form a standalone open asset pack. The
converter, rig profile, catalog format, hashes, and tests are separable from
binary distribution.

## Canonical inputs

| Input | Original filename | Bytes | SHA-256 | Storage | Role |
| --- | --- | ---: | --- | --- | --- |
| External archive | `Gestures Pack Basic.zip` | 1,363,387 | `a02a546a2a5dae2eb0c68acafd6c77161f729aea58a3f8270f2ce03c6fef2a63` | User-controlled external archive | Four Lumen gestures |
| External archive | `Farming Pack.zip` | 2,635,723 | `14acbae8b09c9034c35639f458c08de06ef7dc4ba9e0aec29f9dfae8c63461b3` | User-controlled external archive | Plant and water performances |

| Archive member | Bytes | SHA-256 | Semantic ID |
| --- | ---: | --- | --- |
| `acknowledging.fbx` | 228,241 | `ffc5c47a44565cb5796a2875d60ab468dab56b4687d0d1b925d2cbd06f1c8149` | `lumen.acknowledging` |
| `happy hand gesture.fbx` | 253,873 | `b4a200bdf82cdc614bf866203da0a8b7d0982f4abc2c1e4c96b824fb9b0bed49` | `lumen.happy-hand-gesture` |
| `thoughtful head shake.fbx` | 259,649 | `145c7d2304eda466ddf0e490cfca1e69f3140cb85a7bb08daec502c7edb94107` | `lumen.thoughtful-head-shake` |
| `relieved sigh.fbx` | 257,425 | `6b32d8d1714833d8564a38b1179e8441f8c18917812efdab79172cc6c1d0327c` | `lumen.relieved-sigh` |
| `dig and plant seeds.fbx` | 363,761 | `c5f7ba37645c69eb0e5a7535ba264127f7a201782b3e94ccf8dc4b2c64c0d46e` | `day-one.plant-seed` |
| `watering.fbx` | 368,993 | `6bce580e09d4fd580e3f2a2fe309d99546f46146cbe3d62bf2d46662a896afc4` | `day-one.water-seed` |

- Intake batch: `story-actions-v1`
- External meshes, textures, fonts, HDRIs, scans, recordings, or samples: none admitted; the converter selects only the canonical armature action
- Rig reference: `friendsies-humanoid-v1`, the exact normalized 20-bone hierarchy shared by the six sources and bundled fRiENDSiES bodies

## Rebuild or transform

- Canonical source of truth: the two externally retained ZIPs plus `clips.json` and `rig-profile.json`
- Tools: Blender 4.5.9 LTS, Node.js orchestration in `scripts/build-story-actions-v1.mjs`
- Units and axes: FBX import uses Blender's native FBX conversion; GLB exports Y-up; runtime movement and placement remain outside animation
- Root policy: reject motion authored directly on the source canonical `Root`; strip wrapper translation so Thornvale physics remains authoritative; bake wrapper rotation onto the canonical Root only when it stays within 75 degrees and returns by the final frame
- Transform summary: verify archive/member hashes; import from a clean Blender process; assert exact hierarchy; measure every discarded wrapper/object curve; bake bounded returning wrapper rotation while fixing Root position/scale; remove wrapper objects, other actions, meshes, camera, and light; preserve an odd terminal frame with a constant 30 Hz hold; export one animation-only GLB; clean re-import; repeat from another cold process and require an identical SHA-256
- Reproducibility pins: `build-report.json` records SHA-256 values for `clips.json`, `rig-profile.json`, the Node orchestrator, and the Blender converter, plus the exact Node and Blender versions used
- Exact command:

  ```bash
  FRIENDSIES_MIXAMO_SOURCE_DIR="$HOME/Downloads" npm run animations:build
  ```

- Expected outputs: six GLBs and `pack.json` under `public/animations/story-actions-v1/`, plus `build-report.json` beside this record
- Clean validation: each output re-imports in Blender, exposes one named animation with 60 channels over the canonical 20 bones, contains no mesh/material/texture/image/skin/camera/light payload, keeps Root position/scale constant, bounds Root rotation to 75 degrees with a final return, stays on the 30 Hz sample grid, and reproduces byte-for-byte across two clean builds
