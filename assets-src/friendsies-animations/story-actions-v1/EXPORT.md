# Story Actions v1 export contract

## Inputs

`clips.json` is the source-pack lock. It identifies every ZIP and member by
exact byte count and SHA-256. `rig-profile.json` is the target skeleton
contract. Raw ZIPs and FBXs stay outside the repository.

## Build

```bash
FRIENDSIES_MIXAMO_SOURCE_DIR="$HOME/Downloads" npm run animations:build
```

Override Blender only when intentionally validating another pinned build:

```bash
BLENDER_BIN=/path/to/Blender \
FRIENDSIES_MIXAMO_SOURCE_DIR=/path/to/mixamo-archives \
npm run animations:build
```

The batch builder starts two factory-clean Blender processes per clip and
refuses to publish an output unless their hashes match. It extracts members to
temporary storage, validates the whole staged catalog/report/pack generation,
then swaps the complete runtime directory and report together with rollback.
No partial generation is copied into the live runtime directory.

## Conversion invariants

1. Select the exact `Character_Rig` 20-bone armature.
2. Require the full `friendsies-humanoid-v1` hierarchy in canonical order.
3. Measure every non-pose and wrapper curve before removing it from the runtime
   derivative.
4. Require source canonical `Root` location, rotation, and scale to remain
   constant within `1e-5`.
5. Strip wrapper translation. Bake wrapper rotation onto canonical `Root` only
   when it stays within 75 degrees and returns by the final frame; Root position
   and scale remain constant.
6. Preserve odd terminal source frames with one constant endpoint sample, then
   export only the armature action at 30 Hz with one stable clip name.
7. Reject geometry, skins, materials, images, textures, cameras, lights,
   missing bones, anything other than one TRS channel per canonical bone,
   non-finite samples, off-grid dynamic keys, failed clean re-import, or
   nondeterministic output.

## Verify existing outputs

```bash
npm run animations:verify
node --test tests/story-actions-assets.test.js
npm run assets:audit
```

`animations:verify` binds the current catalog, rig, converter, orchestrator,
build report, runtime pack, manifest records, and binary hashes. The Day One
action clock owns the authored 3.1/3.2 second presentation windows and
2.30/2.35 second commit cues. Mixer completion never commits gameplay.
