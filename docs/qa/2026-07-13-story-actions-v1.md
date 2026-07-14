# 2026-07-13 Story Actions v1 pilot QA

## Scope and decision gate

- Worktree: `codex/first-day-loop`, dirty with the broader Day One and asset
  work preserved in place
- Family: `friendsies-story-actions-v1`
- Player-facing beat: Lumen responds with authored social gestures; planting and
  watering become grounded physical investments with one visible commit cue
- Candidate: four Lumen one-shots plus player plant and water performances
- Payload: six animation-only GLBs, 270,232 bytes total
- Baseline and fallback: the established locomotion/joy/dance pack, Lumen
  idle/joy responses, and Day One's code-native/world presentation
- Gate: prove the converted clips read correctly on the actual characters, the
  authored commit occurs at visible contact, reduced motion and failed assets
  remain safe, and strict release stays blocked until authorization is recorded

This is currently a **development-evaluable pilot**. Deterministic conversion
and focused runtime contracts pass. Browser visual acceptance, complete-route
smoke evidence, reference-device performance, fresh-player learning, and
bundled-release authorization remain open.

## Asset and transform contract

| Role | Runtime files | Contract |
| --- | ---: | --- |
| Lumen | 4 / 154,200 B | Acknowledging, happy hand gesture, thoughtful head shake, relieved sigh |
| Day One | 2 / 116,032 B | Dig/plant and watering, time-scaled to the authored action windows |
| Total | 6 / 270,232 B | Animation nodes and tracks only; no geometry, skin, material, texture, image, camera, or light payload |

- Source FBXs use the exact `fRiENDSiES_8448` 20-bone hierarchy at 60 Hz.
- The converter emits one stable 30 Hz clip over the canonical
  `friendsies-humanoid-v1` targets and preserves an odd terminal source frame
  with one constant grid-aligned hold when required.
- Wrapper translation is deliberately stripped so Thornvale movement and
  placement remain authoritative.
- Wrapper rotation is baked onto canonical `Root` only when it remains within
  75 degrees and returns by the final frame. Root position and scale remain
  constant.
- Each output is built twice from factory-clean Blender 4.5.9 LTS processes,
  cleanly re-imported, and required to reproduce the same SHA-256.

Exact source, toolchain, output hashes, durations, and per-clip wrapper spans
are recorded in `assets-src/friendsies-animations/story-actions-v1/` and
`public/animations/story-actions-v1/PROVENANCE.md`.

## Runtime behavior

### Normal motion

- Lumen requests the four semantic clips at the authored welcome, correction,
  Ledger, and Bell beats. If a clip cannot play, the existing idle/joy role is
  used without blocking story state.
- Plant and water play their skeletal clips at a time scale that fits the
  authoritative 3.1 and 3.2 second action windows. The presenter cancels the
  clip on completion, cancellation, error, or disposal and returns to idle.
- The frame-driven action controller, not the animation mixer, commits the
  `GameSession` transaction exactly once at 2.30 or 2.35 seconds.

### Reduced motion

- Lumen's low-displacement story gestures remain available.
- Plant and water retain the same action duration, movement lock, and commit
  time but play no skeletal action. Their saved garden-state projection remains
  the visible cue.

### Missing or failed assets

- A missing or malformed story-action catalog yields no story-action URLs and
  leaves the established animation pack available.
- Individual GLB failures are isolated with `Promise.allSettled`; successful
  base and story clips remain available.
- A missing Lumen clip falls back to its authored idle/joy role.
- A missing player clip leaves the Day One action clock, code-native/world
  presentation, exact-once transaction, and progression contract intact.

## Automated evidence

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run animations:verify` | PASS | Six catalog, report, manifest, runtime, and toolchain contracts verified |
| Focused Story Actions and story-state suites | PASS | 29/29 across Story Actions assets, action clock/presenter, Core Hook, and Day One |
| `npm run assets:audit` | PASS for development | 27 runtime files / 4,482,517 B; Story Actions is six files / 270,232 B and remains release-blocked |
| `node scripts/check-asset-budgets.mjs --release` | BLOCKED as designed | Exit 1 only for the current `friendsies-story-actions-v1` exact-file publication blocker in this run |
| `npm run check` | PENDING for final candidate | Record the final test count, build result, and dist bytes after the implementation stops changing |

## Browser matrix — observations pending

Do not mark a row complete from deterministic tests alone. Record the browser,
OS/device/GPU, viewport, DPR, quality, reduced-motion state, console/network
result, and exact visible observation when the pass occurs.

| Route or condition | Required observation | Current result |
| --- | --- | --- |
| `?story=reset&quality=high&assets=pilot&traits=v1` | Lumen's welcome, correction, Ledger, and Bell gestures each bind, read cleanly, and return to the correct role | PENDING |
| Normal-motion planting | Character faces the seed bed; kneel/dig/contact/recovery read without sliding, sinking, or a grounding jump; state changes once at visible contact | PENDING |
| Normal-motion watering | Lift/pour/contact/recovery read without sliding, sinking, or a grounding jump; soil darkens once when the pour reaches it | PENDING |
| Reduced-motion emulation | No plant/water skeletal clip plays; duration, movement lock, commit timing, garden cue, and unlock remain legible | PENDING |
| Missing catalog | Base locomotion remains available; Lumen and Day One fallbacks preserve the full route; warning is isolated | PENDING |
| One failed Story Actions GLB | Other clips remain available; affected beat falls back locally; no progression failure | PENDING |
| Day, dusk, and night | Gesture silhouettes and garden contact remain readable under each lighting state | PENDING |
| Save/reload and complete route | Reload before/after contact preserves the exact state boundary; Day One reaches Ledger, Bell, choice, and ending | PENDING |
| Console and network | No unexpected errors or requests; only deliberately forced failures appear in fallback cases | PENDING |

## Performance and player-learning gates

- [ ] Record final production `dist/` bytes and the Story Actions payload delta.
- [ ] Compare median and p95 frame time on the same reference device before and
      after loading the six-clip family.
- [ ] Confirm no startup-blocking request and no visible fallback flash.
- [ ] Record fresh-player observations with
      `docs/playtests/FRESH-PLAYER-TEMPLATE.md`; do not infer aggregate learning
      before comparable records exist.

## Permission and release status

- Manifest status: `project-use-recorded`
- Release blocked: yes
- Current blocker: the existing `friendsies-animations` publication grant names
  only the three earlier runtime derivatives; these six exact outputs still need
  a bundled-Thornvale publication grant
- Raw Mixamo ZIP/FBX redistribution: prohibited by this record
- Standalone derived-motion or outside-project redistribution: not granted
- Safest next gate: complete and record the browser matrix, then obtain the
  exact bundled-release grant before changing the manifest status or running a
  release candidate
