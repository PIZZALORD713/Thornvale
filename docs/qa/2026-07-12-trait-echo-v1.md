# Trait Echo v1 QA — 2026-07-12

> Permission update, 2026-07-12: `friendsies-animations` and the exact
> manifested local `friendsies-0001`, `friendsies-6602`, and
> `friendsies-8914` files and documented uses are now
> `project-release-authorized` for bundled Thornvale builds. Historical blocker
> rows below preserve the output captured before those scoped grants. The
> separate arbitrary-token remote-streaming family is now authorized only for
> bounded integrated player-avatar use; it does not grant Trait Echo or
> environmental rights.

## Candidate status

**Second Witness implementation, deterministic contracts, and current local
browser comparison are complete; fresh-player, reference-device, and final
release-sign-off gates remain open.** This record separates checks run on the
current candidate from the initial proof and the external validation that still
must happen.

### Revision history

The first local proof on 2026-07-12 used nine placements—four Flower White,
four Torch, and one Crown Up—and displayed 34,720 trait triangles. It proved
the three local GLBs could be baked, instanced, projected from story state, and
rolled back independently. The same-day **Second Witness** refinement removed
the duplicate arrival flower and freestanding arrival Torch. All current
contract and open-checklist language below refers to the refined seven-placement
candidate unless a row is explicitly labeled as initial-proof evidence.

| Surface | Candidate contract |
| --- | --- |
| Development default | `?assets=pilot&traits=v1` (also selected with no query) |
| Exact Trait Echo rollback | `?traits=off` |
| Full presentation rollback | `?assets=baseline&traits=off` |
| Landmark selector | Independent `?assets=baseline|pilot` |
| Runtime traits | Three `#0001` Flower White, three `#8914` Torch, one `#8914` Crown Up |
| New asset payload | Zero bytes; existing local GLBs are reused |
| Rendering footprint | Three trait `InstancedMesh` draws plus one shared code-native civic-mount draw; seven placements; 26,544 displayed trait triangles |
| Gameplay footprint | Decorative/render-only; no new anchors, colliders, interactions, or save fields |
| Permission state | Exact local runtime hashes and documented Trait Echo v1 uses are project-release-authorized for bundled Thornvale builds; raw/standalone and outside-project redistribution remain prohibited |
| Release state | Local character and Trait Echo families cleared; bounded remote player streaming separately authorized without granting environmental reuse |

The displayed-trait-triangle total is the static placement calculation: three
Flower instances at 4,812 triangles each (14,436), three Torch instances at
3,364 each (10,092), and one Crown instance at 2,016 (2,016). The shared
civic-mount geometry is code-native and is not included in the trait total.

## Semantic contract

- Flower White has one semantic job: offered and witnessed kindness. One
  private instance marks arrival; a paired set frames the Community Ledger.
- Torch has one semantic job: civic guidance becoming ritual and authority.
  Paired Gate sconces establish the shared account; one Bell sconce carries the
  dusk ritual.
- Crown Up has one semantic job: identity or office as the Ledger crest.
- Sprouts communicate identity/status; hand items communicate action/intent;
  paired objects express the town's shared account while singles remain private.

Expected story reactions:

1. **Arrival:** one private offering is visible; Ledger witnesses begin
   restrained, Gate sconces flicker independently, and the Crown is upright.
2. **Dusk guidance:** after signing the Ledger, the Bell Torch and its night
   light strengthen while the paired motifs settle into shared rhythm.
3. **Post-bell:** after the player's first ring, the Bell guidance settles.
4. **Anomaly:** the impossible second bell breaks agreement in the Ledger
   witness pair, tilts the Crown, holds the Torches still, and removes Bell
   guidance.
5. **Intervention:** the false record closes the Ledger witnesses toward the
   record, tilts the Crown farther, and nearly extinguishes the Torches.
6. **Comply:** the witness pair and Crown return upright; the Gate treatment
   becomes warmly synchronized.
7. **Alter:** one witness remains dissenting, the Crown reaches its strongest
   tilt, and the Gate treatment remains cold and asymmetric.
8. **Reduced motion:** the same semantic states apply immediately, without
   ambient flower sway or Torch flicker.

## Excluded backlog

Trait Echo v1 must not load, bundle, or imply runtime approval for:

- `Book Of Ocean` and `Friends Key` from token `#431`, cataloged and probed but
  pending decoded-rig, visual, permission, provenance, and budget review; or
- `All Seeing` and `Orb`, cataloged as anomaly-only holds pending exact variant
  selection, permission, provenance, and budget review.

These candidates may appear in the source-only collection index, atlas,
curation sidecar, and technical probes. They still have no runtime asset URL
and are not part of the game bundle.

## Automated checklist

- [x] Run `npm test` and record the final count and any failures.
- [x] Run `npm run build` and record the production result.
- [x] Run `npm run assets:audit -- --dist` and confirm the development audit adds no new
      runtime asset family or payload for Trait Echo v1.
- [x] Run `npm run check` as the combined project gate.
- [x] Run `git diff --check`.
- [x] Verify a missing `traits` selector defaults to `v1`, while explicit `off`
      and unknown values use the safe rollback independently of `assets`.
- [x] Verify the v1 config has exactly 3 Flower, 3 Torch, and 1 Crown placement;
      exactly 3 trait draw families; one shared code-native civic-mount draw;
      and exactly 26,544 displayed trait triangles.
- [x] Verify a successfully loaded fRiENDSiES flower removes the 56 central
      procedural placeholders, while load failure retains all 108.
- [x] Verify `traits=off` creates no Trait Echo runtime root.
- [x] Verify each source is resolved only through the curated local cast and a
      failed family does not prevent the other families or the town from loading.
- [x] Verify the story projection covers arrival, dusk guidance, post-bell,
      anomaly, intervention, comply, and alter.
- [x] Verify dispose removes the root and releases cloned geometry, materials,
      textures, and its world-animation callback.
- [x] Run `npm run assets:release` and confirm the exact local families and the
      separately bounded remote-player family pass without broadening Trait
      Echo, bundling, or raw-redistribution rights.

## Browser matrix

Boot each route with DevTools console and network capture visible:

```text
?story=off&quality=low&assets=baseline&traits=off
?story=off&quality=low&assets=baseline&traits=v1
?story=off&quality=low&assets=pilot&traits=off
?story=off&quality=low&assets=pilot&traits=v1
?story=reset&quality=low&assets=pilot&traits=v1
```

- [x] All four `assets`/`traits` presentation combinations reach the playable
      scene without console errors or failed requests.
- [x] The `assets` selector changes only landmarks; the `traits` selector
      changes only environmental trait echoes.
- [x] Recheck the three flowers, three mounted Torches, Crown crest, and civic
      mounts against walkable routes, interaction prompts, camera framing, and
      landmark silhouettes after the Second Witness refinement.
- [x] Recheck that day, dusk, and night preserve the Flower, Torch, and Crown meanings; the
      Bell light appears only when night mix and story state call for it.
- [x] Restore valid **comply** and **alter** saves and compare the final
      Flower/Crown/Torch and route treatments. A fresh manual dual-ending
      playthrough remains part of the player-validation gate below.
- [x] Save and reload at anomaly, intervention, and one ending; the visual state
      must project from restored durable story data.
- [x] Re-emulate reduced motion and verify that ambient sway/flicker stops while
      state changes remain legible.
- [x] Confirm the game runtime makes no request for Book Of Ocean, Friends Key,
      All Seeing, Orb, or the source-only collection index.
- [x] Simulate one trait-family load failure and confirm the remaining families
      and the complete story route continue to work.

## Performance and visual checklist

- [ ] Compare identical spawn-to-Ledger-to-Bell camera routes with `traits=off`
      and `traits=v1` on the same reference device.
- [x] Confirm the layer owns three trait `InstancedMesh` draw families plus one
      shared code-native civic-mount draw and the placement calculation is
      26,544 displayed trait triangles.
- [ ] Record median and p95 frame time; require no more than 10% median
      regression and p95 no greater than 25 ms.
- [x] Inspect high and low quality, day and night, and reduced motion.
- [x] Confirm the private offering and Ledger witness pair read as authored
      story signals rather than interactables, and that the mounted Torch/Crown
      changes remain legible without obscuring the Gate, Ledger, or Bell.
- [x] Retain only intentionally selected evidence; do not commit generated
      `dist/`, screenshots, traces, or `output/` by default.

## Release checklist

- [x] Adjacent provenance names every reused source trait and environmental
      adaptation.
- [x] No new or modified fRiENDSiES binary is present solely for Trait Echo v1.
- [x] The exact manifested `friendsies-0001` and `friendsies-8914` files and
      documented Trait Echo v1 arrangement are project-release-authorized for
      bundled Thornvale builds with raw/standalone redistribution prohibited.
- [x] Backlog traits stay absent until they independently pass permission,
      provenance, catalog, and budget review.
- [x] `?traits=off` remains the exact Trait Echo rollback;
      `?assets=baseline&traits=off` remains the full-presentation rollback; and
      `pilot + v1` is the local development default while the remaining player-
      validation and performance gates stay open.

## Collection-intelligence checks

- [x] The pinned index validates 10,000 contiguous token IDs and records 1,077
      named traits, 1,447 distinct asset/preview variants, and 62,655 uses.
- [x] The 2.7 MB index, curation, probes, and atlas stay outside `public/` and
      are absent from the game runtime and production `dist/`.
- [x] The local atlas searches all seven trait types, distinguishes same-name
      variants, shows exact token evidence, and joins 27 manually curated
      hand/sprout candidates.
- [x] Every curated candidate has a schema-v2 casting profile with individual
      surface/counter meanings, silhouette and mount class, read distance,
      palette, reveal phase, affordance risk, shot role/budget, technical
      readiness, and rights coverage. The atlas composes mount, phase, and risk
      filters and includes all profile fields in search.
- [x] Five selected GLBs are metadata-probed without retaining their binaries:
      Flower White, Torch, Crown Up, Book Of Ocean, and Friends Key.
- [x] `Book Of Ocean` is a 117,440-byte / 396-triangle rigid candidate and the
      selected `Friends Key` is a 383,936-byte / 1,768-triangle rigid candidate;
      decoded weight and rendered-fit checks remain required before intake.

## Verification results

### Current Second Witness deterministic refresh

| Check | Result | Evidence/notes |
| --- | --- | --- |
| Trait Echo and breathing-grass focused tests | PASS | `node --test tests/trait-echoes.test.js tests/breathing-grass.test.js`: 25 tests passed, 0 failed |
| Development asset audit | PASS | 21 runtime files / 4,212,285 B; exact local fRiENDSiES families and the bounded remote-player dependency are approved under separate scopes |
| Scoped asset release check | PASS | `npm run assets:release`: 21 runtime files / 4,212,285 B, one authorized external dependency, and production `dist` 8,061,208 / 8,388,608 B; no release-blocked family remains |
| Current placement browser comparison | PASS | Clean Chromium/WebGL pass at 1200×900 and 800×600; exact Ledger and Bell close views confirmed three Flowers, three mounted Torches, Crown crest, seven colored civic mounts, clear prompts/routes, and no blackened instance colors |
| Story-state reconstruction | PASS | Valid dusk, anomaly, intervention, comply, alter, and completed-alter saves restored the expected DOM datasets, Ledger mood, route, qualitative standing, and trait posture; story cards were closed for playable comparisons |
| Reduced motion | PASS | Medium tier rendered 432 grass instances with motion/time at zero and static matrix version 1; semantic trait and route states remained applied |
| Failure isolation | PASS | Forced Torch GLB abort recorded only `civic-torch` as failed; Flower, Crown, town, story shell, and breathing grass stayed live |
| Console | PASS | Final clean session reported zero application warnings and zero errors |

### Initial nine-placement browser proof

The rows below record the initial nine-placement browser proof. They establish
the loader, selector, story-projection, reduced-motion, failure-isolation, and
rights behavior that the refined and separately verified current candidate
preserves.

| Check | Result | Evidence/notes |
| --- | --- | --- |
| Automated tests | PASS | `npm run check`: 84 tests passed, 0 failed |
| Production build | PASS with advisory | Vite built 56 modules; existing large Three.js/Rapier chunk warning remains non-fatal |
| Development asset audit | PASS | 18 runtime files / 3,963,895 B; production `dist` 7,742,363 / 8,388,608 B; source-only research artifacts absent |
| Strict release audit | BLOCKED as designed | Exit 1 for `friendsies-0001`, `friendsies-8914`, and `friendsies-animations`; formal terms remain missing |
| Browser selector matrix | PASS | Baseline/off, baseline/v1, pilot/off, pilot/v1, and story-reset/pilot/v1 booted without console errors; off created no Trait Echo root |
| Runtime trait loading — initial proof | PASS | All three local Draco GLBs loaded; four Flower, four Torch, and one Crown instances were present; no family failures |
| Story reactions | PASS with manual walkthrough remaining | Automated arrival through both choices passed; browser checked dusk light, intervention, and an `alter` save restore. A manual dual-ending playthrough remains open |
| Reduced motion | PASS | Browser emulation applied final posture/light targets immediately with ambient motion disabled |
| Failure isolation and teardown | PASS | Automated per-family failure, URL cache, material/texture cleanup, callback unregister, and malformed-geometry checks passed |
| Backlog runtime exclusion | PASS | No Book, Friends Key, All Seeing, Orb, or source-index request observed in the game smoke route |
| Reference-device frame profile | PENDING | Headless rendering is not accepted as device evidence; median and p95 capture remain required |
| Fresh-player comparison | PENDING | Five-player baseline/v1 comparison remains required before release sign-off |
| Visual review | PASS for local low-quality matrix | Day/dusk/night spawn, Gate, Ledger, and Bell framing inspected; high-quality/reference-device review remains open |
