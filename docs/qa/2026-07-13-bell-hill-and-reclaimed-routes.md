# Bell Hill and Reclaimed Routes QA — 2026-07-13

## Player-facing beat

The second courtesy now asks the player to leave the civic center, follow a
warm reclaimed-paver procession, climb the rear hill, and ring the Bell from a
distinct summit. The return trip creates the physical separation needed for the
second, impossible ring.

## Runtime contract

- Bell interaction: `(3, 2.9, -36.5)` on a `2.4 m` summit.
- Plaza-to-Bell separation: more than `30 m`.
- One shared sampled surface owns the visible hill and its Rapier trimesh.
- The Bell model, authored pilot, collider, camera proxy, interaction anchor,
  anomaly VFX, ritual torch, and guidance light derive from the same landmark.
- Maintained routes use one `reclaimed_warm_pavers` instanced draw. Pond,
  forest, and meadow routes remain soft tracks.

## Deterministic evidence

- Reclaimed pavers: `443` instances, including `304` warm-brick and `42`
  repair-stone pieces, under the `900`-instance ceiling.
- Hill-bound ritual pavers: `112` placements with a `0.014 m` nominal bottom
  clearance from the sampled surface.
- Maximum authored approach grade: below `0.26` (`15 degrees`).
- Fixed `60 Hz` physics / `120 Hz` render round trips:
  - Walk: zero false contact transitions, `2.159 cm` maximum physical foot
    error, `4.536 cm` maximum render-foot error.
  - Sprint: zero false contact transitions, `2.216 cm` maximum physical foot
    error, `4.559 cm` maximum render-foot error.
- Camera remains above the visible hill at minimum and maximum pitch; the
  lowest tested clearance is greater than `0.08 m`.

Focused suites passed for CharacterMotor, town physics, town paths, camera,
town assets, Trait Echo, and Core Hook story behavior.

## Browser smoke

Checked `http://127.0.0.1:3000/?story=off&quality=high` in the in-app browser.

- Warm reclaimed pavers render as solid, non-coplanar geometry at entry.
- Day and night presentations both retain readable route contrast.
- Debug overlay reports grounded contact and `0.010 m` hover at entry.
- No browser warnings or errors were recorded.

## Repository gates

- `npm run build`: passed.
- `npm run assets:audit`: passed for development; the pre-existing
  `friendsies-story-actions-v1` family remains intentionally release-blocked.
- Full test run: `196/198` passed. The two failures are the existing stale
  runtime-media count and the intentional story-action publication blocker.
- Dist audit: blocked at `8,414,028 B`, which is `25,420 B` above the current
  `8 MiB` limit in the combined dirty worktree.

Do not remove the story-action authorization blocker or raise the dist ceiling
as part of the Bell-hill change.
