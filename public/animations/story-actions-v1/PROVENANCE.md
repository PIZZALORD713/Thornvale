# Story Actions v1 runtime provenance

## Permission status

- Manifest family ID: `friendsies-story-actions-v1`
- Creator: Adobe Mixamo motion on the fRiENDSiES `8448` rig; converted by the Thornvale/fRiENEMiES pilot pipeline
- Status: `project-use-recorded`
- Authorization: integrated Thornvale pilot requested by the project owner on 2026-07-13; exact bundled-release authorization for these six new derivatives remains to be recorded
- Release blocked: yes
- Block reason: current `friendsies-animations` publication permission names only the three earlier derivatives
- Raw-source redistribution: prohibited by this record
- Standalone derived-motion redistribution: not granted

## Runtime contract

| Runtime file | Source member | Runtime duration | Bytes | SHA-256 |
| --- | --- | ---: | ---: | --- |
| `lumen-acknowledging.glb` | `acknowledging.fbx` | 1.933 s | 33,052 | `e74157124a69e1ed4534c5b99308e2a414a9b60a38a69e8ca65782f43bcff82f` |
| `lumen-happy-hand-gesture.glb` | `happy hand gesture.fbx` | 2.933 s | 39,868 | `f05dd225d6d425517ee8a52b89d0c4b604cefce1caaeecf257b57f276b8da6a4` |
| `lumen-thoughtful-head-shake.glb` | `thoughtful head shake.fbx` | 3.067 s | 41,028 | `4e0b1baddc1bcd62b3417771ad84f0880945875820f2fedac581fbcd08247a9b` |
| `lumen-relieved-sigh.glb` | `relieved sigh.fbx` | 3.000 s | 40,252 | `a4a8a9f27d89de2d3acf74dcfb348c690ce8167389cb01536b820e34879bb35e` |
| `day-one-plant-seed.glb` | `dig and plant seeds.fbx` | 5.500 s | 57,532 | `6d84a8572dda3d9eae698e0f6f5528cac02eba7fad27359652dfdd786d2cb82a` |
| `day-one-water-seed.glb` | `watering.fbx` | 5.600 s | 58,500 | `493f4f22070f5316acf3398fd4a764bfdf12863103f058f6f342c7df773451d9` |

- Runtime payload: six animation-only GLBs totaling 270,232 bytes
- Runtime URLs: `/animations/story-actions-v1/<filename>`
- Runtime catalog: `/animations/story-actions-v1/pack.json`
- Format: glTF 2.0 binary, animation nodes and tracks only
- Skeleton: `friendsies-humanoid-v1`; 20 canonical targets, 60 channels per clip
- Sample rate: 30 Hz runtime outputs from 60 Hz FBX sources; odd terminal source frames are preserved with one constant hold sample on the 30 Hz grid rather than dropped
- Loop policy: `LoopOnce`, then resume the prior idle/walk role
- Root policy: wrapper translation is stripped; bounded wrapper rotation is baked onto the canonical `Root`, must stay within 75 degrees, and must return by the final frame; Root position and scale remain constant
- Loader owner: `src/visuals/loadFriendsiesAnimationPack.js`
- Story selection: `src/content/story-actions-v1.js`
- Gameplay authority: `DayOneActionController` supplies transient timing; `DayOneDirector` commits one `GameSession` transaction at the authored contact cue
- Normal motion: Lumen requests the four semantic one-shots at their authored
  story beats. Plant and water time-scale their source clips to the authoritative
  3.1/3.2 second action windows, cancel the one-shot at every terminal event,
  and return to idle; mixer completion never commits gameplay.
- Reduced motion: Lumen's low-displacement gestures remain available. Plant and
  water preserve the same duration, movement lock, and 2.30/2.35 second commit
  cues without playing a skeletal action; the saved garden-state projection is
  the visible result.
- Failure fallback: the story-action catalog and each file are optional. A
  missing catalog retains the three established locomotion/joy/dance sources; a
  missing individual file is skipped independently. Lumen falls back to the
  authored idle/joy role, while Day One keeps its code-native/world presentation
  and the same authoritative transaction.

## Verification

- Two factory-clean Blender 4.5.9 LTS conversions per clip produced identical SHA-256 values. The build report pins the catalog, rig profile, orchestrator, converter, Node version, and Blender version.
- The build report records wrapper translation/rotation/scale spans for visual-fidelity review; translation is discarded while bounded returning rotation is baked, with the farming clips carrying the largest lean.
- `npm run animations:verify` binds catalog, report, pack, manifest, and all six runtime hashes.
- `tests/story-actions-assets.test.js` parses every GLB with Three.js, verifies the canonical 20-by-TRS target set, 30 Hz sample grid, finite values, constant Root tracks, and absence of geometry, materials, textures, skins, cameras, and lights.
- Frame-rate, slow-frame, cancellation, fallback, movement-lock, cue-time revalidation, and exact commit behavior are covered by focused Node tests.
- `npm run animations:verify` passed for six clips; the focused story-action,
  action-clock, presenter, Core Hook, and Day One suites passed 29/29 on
  2026-07-13. The development asset audit passed with 27 managed runtime files,
  4,482,517 total runtime bytes, and this 270,232-byte family reported as the
  only release blocker in that run.
- The strict release-mode audit exits nonzero for
  `friendsies-story-actions-v1` as designed until the exact bundled-release
  grant is recorded.
- Story-actions-specific browser observations have not yet been recorded. The
  Lumen gesture reads, Day One crouch/lean, ground contact, 2.30/2.35 second
  commit cues, reduced-motion projection, and failed-catalog/file fallbacks all
  remain pending in `docs/qa/2026-07-13-story-actions-v1.md`.
