# 2026-07-13 Story Actions v1 pilot QA

## Scope and decision gate

- Candidate branch: `codex/first-day-loop`, validated together with the complete
  Day One action-weight and release-gate changes
- Family: `friendsies-story-actions-v1`
- Player-facing beat: Lumen responds with authored social gestures; planting and
  watering become grounded physical investments with one visible commit cue
- Candidate: four Lumen one-shots plus player plant and water performances
- Payload: six animation-only GLBs, 270,232 bytes total
- Baseline and fallback: the established locomotion/joy/dance pack, Lumen
  idle/joy responses, and Day One's code-native/world presentation
- Gate: prove the converted clips read correctly on the actual characters, the
  authored commit occurs at visible contact, reduced motion and failed assets
  remain safe, and strict release continues to enforce source rights,
  provenance, transforms, fallbacks, budgets, and QA

This family is **release authorized and has passed its integrated asset-family
gate**. ADR 0005 supplies standing project-owner authorization while the family
retains independent Mixamo source and product-use evidence. Deterministic
conversion, focused runtime contracts, development and strict release audits,
normal and reduced-motion garden reads, forced catalog/file fallbacks,
save-boundary behavior, and an actual-interaction Day One route all pass.

The remaining full walked route, intentional pass-out route, additional
lighting/reference-device profiling, and fresh-player learning are Milestone 1
playfeel gates. They do not reopen animation permission or negate the bounded
asset-family release evidence recorded here.

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
| Focused Story Actions and story-state suites | PASS | 33/33 across Story Actions assets, action clock/presenter, Core Hook, and Day One |
| `npm run assets:audit` | PASS | 27 runtime files / 4,482,517 B; Story Actions is six files / 270,232 B; no release-blocked family remains |
| `npm run assets:release` | PASS | Standing animation authorization, upstream rights, provenance, fallbacks, QA evidence, hashes, budgets, and production dist all pass; `dist/` is 8,383,699 / 8,388,608 B |
| `npm run check` | PASS | 212/212 tests, production Vite build, development asset audit, and the same 8,383,699-byte dist candidate |

## Browser matrix — 2026-07-14 observations

Do not mark a row complete from deterministic tests alone. Record the browser,
OS/device/GPU, viewport, DPR, quality, reduced-motion state, console/network
result, and exact visible observation when the pass occurs.

The candidate route ran at 1280×720 in desktop Chromium with `quality=high`,
`assets=pilot`, and `traits=v1`. The welcome screen, arrival letter, HUD, town,
six Story Actions clips, and established base animations loaded with no
unexpected console warning or error. Position changes used by the automation
prove interaction wiring and state boundaries, not genuine walked-route
playfeel.

| Route or condition | Required observation | Current result |
| --- | --- | --- |
| `?story=reset&quality=high&assets=pilot&traits=v1` | Story Action clips load; Lumen's welcome gesture binds and returns to the locomotion role | PASS for welcome; later narrative gestures are tracked below as a remaining milestone observation |
| Normal-motion planting | The player faces the bed; the grounded kneel/dig pose has no visible slide, sink, or grounding jump; seed mounds appear once at the 2.30 s contact cue; idle and movement control return | PASS |
| Normal-motion watering | The lean/pour pose remains grounded; the soil and glints change once at the 2.35 s contact cue; idle and movement control return | PASS |
| Reduced-motion emulation | No plant/water skeletal one-shot plays; the same duration, movement lock, contact-time commit, garden state cue, and unlock remain | PASS |
| Missing catalog | The request is forced to 404; walk-low, walk-high, Joy-Jumper, rumba, jump, fall, and land remain; plant uses its world fallback, commits once, restores the prop, and unlocks | PASS with the expected forced 404 and isolated catalog warning |
| One failed Story Actions GLB | Plant is forced to 404 while the other five Story Action clips, including water, remain; plant falls back locally, commits once, restores, and unlocks | PASS with the expected forced 404 and isolated file warning |
| Save/reload boundary | Reload before the plant cue restores `planted=false` with no transient action or lock; reload after contact restores `planted=true` with no transient action or lock | PASS |
| Actual-interaction Day One route | Actual `E` interactions complete three chops, fish, fire, cook, eat, plant, water, and shelter repair; the saved state reaches `dayOne.complete=true` and the Community Ledger objective with no resource soft lock | PASS; automation repositioned the player and therefore does not prove route walking |
| Rollback selectors | `story=off&quality=low` boots all `assets=baseline/pilot` × `traits=off/v1` combinations; baseline resolves the three `cozy_*` landmark roots, pilot resolves the three `authored_pilot_*` roots, and `friendsies_trait_echo_v1` appears only for `traits=v1` | PASS; HTML datasets, runtime selectors, and town-root metadata agree, with zero console errors or warnings in all four sessions |
| Console and network | The normal route and four selector routes have no unexpected errors or warnings; only deliberately forced requests and their isolated warnings appear in fallback cases | PASS for recorded routes; reduced-motion console was not separately recaptured |

The Lumen correction, Ledger, and Bell gesture silhouettes under the complete
day/dusk/night story route remain a manual narrative-presentation observation.
The clips are structurally verified, requested in authored order by the passing
Core Hook suite, isolated by the same fallback contract, and do not own story
progression. This remaining presentation note is not an asset publication or
permission blocker.

## Performance and player-learning gates

- [x] Record final production `dist/` bytes and the Story Actions payload delta:
      8,383,699 / 8,388,608 B total; 270,232 B for the six-clip family.
- [ ] Compare median and p95 frame time on the same reference device before and
      after loading the six-clip family.
- [x] Confirm the optional catalog and individual-file failures do not block
      startup or progression; deliberately forced failures remain local.
- [ ] Record fresh-player observations with
      `docs/playtests/FRESH-PLAYER-TEMPLATE.md`; do not infer aggregate learning
      before comparable records exist.

## Permission and release status

- Manifest status: `project-release-authorized`
- Authorization family: `thornvale-animation-project` under ADR 0005
- Release blocked: no
- Upstream rights: Adobe Mixamo game-use terms plus the exact signed exports,
  source hashes, conversion record, and derivative hashes recorded for this
  family
- Raw Mixamo ZIP/FBX redistribution: prohibited by this record
- Standalone derived-motion or outside-project redistribution: not granted
- Asset-family release gate: pass; `releaseBlocked: false`
- Safest next gate: complete the genuine walked clean/pass-out playtests, the
  three remaining Lumen story-gesture observations, and reference-device frame
  profiling as Milestone 1 playfeel evidence
