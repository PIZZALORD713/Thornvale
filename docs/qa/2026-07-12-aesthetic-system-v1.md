# Aesthetic System v1 QA — 2026-07-12

> Historical authorization note: ADR 0004 superseded the narrow fRiENDSiES
> permission scopes in this record on 2026-07-13. Preserve the QA evidence
> below; canonical fRiENDSiES assets now share one standing Thornvale-wide grant.

## Candidate status

**The coordinated local aesthetic slice is implementation- and browser-ready
for review.** The bounded fRiENDSiES release authorization is recorded; a
fresh-player comparison and the normalized reference-device performance gate
remain open and must not be inferred from this development pass.

This record covers the Courtesy/Correction shell, pure story presentation
projection, Second Witness trait grammar, consequence routes, breathing grass,
and the local trait-casting atlas. Generated screenshots remain ignored under
`output/playwright/` and are not part of the release payload.

## Runtime contracts

| System | Current contract |
| --- | --- |
| Welcome/HUD | Project-authored CSS and existing seal only; no new font, icon pack, image, save field, or network request |
| Story presentation | Pure projection from `GameSession`; arrival, day, dusk, post-bell, anomaly, intervention, comply, and alter |
| Trait Echo | Seven placements; three trait instanced draws plus one colored code-native mount draw; 26,544 displayed trait triangles |
| Breathing grass | One static `InstancedMesh`; 192 low, 432 medium, 800 high; nine triangles per tuft |
| Grass animation | One bounded shared time uniform; tip-only vertex displacement; no per-instance JavaScript updates |
| Dragonflies | Two instanced draws and one callback; two low, three medium/high; 48 triangles per insect and 144 displayed triangles at medium/high |
| Dragonfly motion | Pond/garden-only absolute-time hover–dart stations; no orbit, spin, flap, shadow, emissive, asset, or network request |
| Reduced motion | Grass motion and time are zero; no grass animator callback; semantic story posture remains |
| Teardown | Ambient life, Trait Echo, and grass dispose before the shared world animator clears; released references are nulled |
| Collection intelligence | 10,000 tokens, 1,077 named traits, 1,447 variants, 27 individual schema-v2 casting profiles; the environmental atlas is source-only and local |
| Rollback | `?assets=baseline` restores the v0.3 procedural landmarks, 64 static grass tufts, and six legacy butterflies; `?traits=off`, `?post=off`, and `?story=reset` remain independent |
| Release | Asset authorization cleared under the exact local-family and bounded remote-player manifest contracts; fresh-player and performance gates remain |

The direct-render diagnostic measured the final high-tier grass delta at
exactly one draw and 7,200 triangles. Low and medium totals are 1,728 and 3,888
triangles. Instance matrices remained `STATIC_DRAW` at version 1 throughout
long-session and state checks.

The final direct-render dragonfly hide-diff measured exactly two calls and 144
triangles at high quality. The translucent double-sided wings use a single
material pass, preventing the renderer from silently doubling that budget.

Final grass generation retains the exact tier counts while arranging roughly
78% of instances into deterministic 4–7 tuft meadow patches and 22% as solitary
scatter. Every origin independently passes the path, plaza, building, pond,
landmark, authored-prop, story-route, and gate clearance mask.

## Browser evidence

Playable comparisons intentionally closed the welcome overlay and any story
card before judging the world. The welcome itself was evaluated separately as
a composition surface.

| Check | Result | Notes |
| --- | --- | --- |
| Wide welcome | PASS | 1488×644 keeps the left civic paper compact and leaves well over 60% of the world visible |
| Standard desktop | PASS | 1200×900 arrival, day, anomaly, comply, and alter captures have clear objective/time hierarchy |
| Short viewport | PASS | 800×600 comply and alter routes remain distinct and the two-line objective stays within bounds |
| Mobile welcome | PASS | 390×844 centers the card without clipping; the world remains visible above and below |
| Keyboard focus | PASS | Tab focuses the arrival surface and gives the card a 4 px visible focus outline |
| Story modal focus | PASS | Keyboard gate entry lands on the story action after pointer-lock settlement at 1200×900 and 390×844; mobile retains 12 px bottom clearance, Enter closes, and background inert state restores |
| Restored state | PASS | Dusk, anomaly, intervention, comply, alter, and completed alter reproject the correct root datasets, standing, Ledger mood, route, and trait posture |
| Comply grammar | PASS | Two normal-side honey stitches remain separately legible at 1200×900 and 800×600 |
| Alter grammar | PASS | Sparse violet ink-thorns remain visible at both tested playable viewports without changing route samples or destination |
| Trait roles | PASS | Exact Ledger and Bell views show paired Flower offerings, Crown crest, mounted Torch, and socket-colored mounts as distinct civic roles |
| Quality tiers | PASS | Browser counts were exactly 192/432/800 and each tier owned one grass mesh |
| Reduced motion | PASS | Browser emulation produced 432 static tufts with motion/time `0`, instance matrix version `1`, and no open story card |
| Dragonfly replacement | PASS | Real renderer replaced 18 pastel rectangle/cylinder meshes and six callbacks with two instanced moss/celadon draws and one callback; pond-wide and close silhouette review passed |
| Dragonfly quality/motion | PASS | High rendered three localized insects; the combined low-quality/reduced-motion case rendered two with unchanged instance matrices; night mix `.65` set both opacities to zero and removed route competition |
| Near-camera grass | PASS | Owner-isolation confirmed the former lower-right shards belonged to `particle_grass_tufts`; the final 3–7 m shader envelope reduces them to a natural foreground fringe with the mesh still visible |
| Night particle hierarchy | PASS | Legacy 58-point square petal drift reaches opacity zero, leaves the render list by night, and no longer competes with consequence routes; shaped pooled particles remain |
| Objective controls | PASS | With an active objective the controls keep low-opacity key hints but render no paper, border, blur, or shadow; the full paper treatment returns on hover |
| Failure isolation | PASS | Forced Torch-family failure left Flower, Crown, the town, story shell, and grass live |
| Selector matrix | PASS | baseline/off, baseline/v1, pilot/off, and pilot/v1 booted independently; pilot/high created 800 grass instances and three dragonflies, while baseline made no pilot request and restored 64 tufts plus six legacy butterflies; off created no Trait Echo root |
| Pilot request failure | PASS | Forced arrival-plaza GLB 404 restored the procedural Welcome Gate, Ledger, and Bell while story state and three-dragonfly ambient life remained live |
| Console | PASS | Clean final session: zero application warnings and zero errors |

## Same-device performance probe

Headed Chromium 150 on Apple M4/ANGLE Metal at 1200×900 DPR 1 collected 280
`requestAnimationFrame` deltas per cell after a three-second settle, discarded
the first 40, and analyzed 240. Story was off and the welcome was closed.

| Candidate cell | Median | p95 | Aggregate calls | Aggregate triangles |
| --- | ---: | ---: | ---: | ---: |
| High, post on, pilot/v1 | 36.60 ms | 54.80 ms | 842 | 227,030 |
| High, post on, baseline/off | 36.20 ms | 54.20 ms | 845 | 170,970 |
| Medium, post on, pilot/v1 | 36.40 ms | 54.70 ms | 841 | 223,466 |
| High, post off, pilot/v1 | 24.40 ms | 42.40 ms | 826 | 226,763 |

The authored pilot plus Trait Echo changed median frame time by about 0.4 ms
versus the rollback composition in this run. The post stack was the dominant
measured cost, adding about 12.2 ms median and 12.4 ms p95. Grass remained one
call/7,200 triangles; the new asset slice is not the current frame-time
bottleneck.

This probe does **not** pass the release p95 target of 25 ms. A direct candidate
versus clean-`HEAD` regression percentage is not claimed because `HEAD`
auto-orbits its unlocked camera while the candidate does not, producing
different frustum contents unless camera state is normalized. The performance
gate remains open for normalized baseline capture and deliberate post/shadow
optimization with pixel-parity review.

The baseline cell above predates the corrected full-scene rollback and included
the new breathing grass and dragonfly owners. It is retained as historical
evidence only and must be replaced by a normalized `?assets=baseline` capture
before any candidate delta is claimed.

## Trait-casting atlas

The atlas now treats curation as shot and gameplay intelligence rather than a
preview gallery. Every one of the 27 curated traits records:

- an individual surface meaning and Thornvale counter-meaning;
- silhouette class, mount type, read distance, and palette family;
- reveal phase, affordance risk, shot role, and maximum per shot;
- technical readiness and rights coverage.

Mount, reveal-phase, and affordance-risk filters compose. All profile fields
participate in search, cards expose the key casting badges, and detail view
shows the full paired meaning and decision record. A real-browser filter of
`sconce + arrival + medium` returned only Torch; profile-only search and narrow
layout checks also passed with no console diagnostics. Atlas data and UI stay
outside `public/` and production `dist/`.

## Automated verification

Final coordinated check:

- `npm run check`: **153 tests passed** on the `origin/main` integration,
  production build passed, and the development `dist` asset audit passed at
  8,066,610 / 8,388,608 bytes;
- focused route, Trait Echo, atlas, and breathing-grass suites passed;
- `git diff --check`: passed;
- historical strict `npm run assets:release`: was non-zero before the scoped
  fRiENDSiES grants; the current authorization refresh is recorded separately
  below rather than rewriting that earlier command output.

Authorization refresh: the two focused asset/policy suites passed 12/12 and
`npm run assets:release` passed with 21 runtime files / 4,212,285 bytes, one
authorized external dependency, and production `dist` at
8,066,610 / 8,388,608 bytes. This clears the asset-permission gate only; it does
not close the fresh-player or reference-device gates below.

## Open validation gates

- Run the declared fresh-player baseline/candidate comparison; require at least
  four of five players to complete without required help and recall one
  meaningful environmental change.
- Repeat the baseline/candidate profile with normalized camera state, then tune
  the post/shadow stack until median regression is no more than 10% and p95 is
  no greater than 25 ms on the declared reference device.
- Complete a fresh manual input/collision playthrough through both endings
  before release sign-off, even though deterministic and restored-state paths
  are passing.
