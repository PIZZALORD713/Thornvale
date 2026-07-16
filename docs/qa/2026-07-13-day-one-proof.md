# Day One Proof QA

**Status:** implementation complete; fresh-player validation pending  
**Player-facing beat:** arrive as an uncertain newcomer, enter the town’s shared record, then make the provisional forest-edge camp livable while each action is truthfully recorded
**Exit criterion:** a clean run and an intentional pass-out run both reach the existing dusk Bell sequence without developer help, lost progress, or a resource soft lock

## Experience hypothesis

The player should leave the first afternoon feeling fed, capable, and newly attached to a small place they improved themselves. That sincere comfort gives the later Ledger and Bell routine something worth risking. The first wrongness remains social: Thornvale is generous about the plot, the recovery, and the rules, but every kindness is recorded.

## Included loop

1. Read the arrival letter and meet Steward Lumen.
2. Enter a name in the Community Ledger.
3. Follow the west path to the provisional camp.
4. Gather six wood from the woodlot.
5. Catch one fish at the pond.
6. Light the campfire, cook the fish, and eat it.
7. Plant and water the seed bed.
8. Spend wood to patch the shelter.
9. Ring the Bell once at dusk and return toward Lumen until the impossible second ring interrupts the journey.

The gathering, fishing, gardening, and shelter steps may be completed in different safe orders. The fire, meal, and resource costs remain authored and deterministic for this proof.

## Implementation evidence — updated 2026-07-16

- `npm run check` passed with 255/255 deterministic tests, a production Vite
  build, the asset audit, and an 8,379,189 / 8,388,608 byte production bundle.
- Focused coverage proves the clean resource loop, zero-energy fire/cook/eat recovery, pass-out fee and debt branches, retained progress, save migration, Day One world projection, survival HUD accessibility, and the Day One-to-Ledger gate.
- An independent code review found no progression, recovery, migration, or Ledger-unlock blockers.
- Browser smoke at 1280×720 confirmed the welcome screen, arrival letter, first objective, pointer-lock handoff, town presentation, and an error-free console. The pilot and `?assets=baseline&traits=off` variants both booted cleanly after the camp relocation.
- The camp-spacing regression now enforces separate cottage clearance, authored-footprint breathing room, non-competing interaction radii, meadow-edge margin, a narrow approach that reaches the recovery point, local grass exclusions instead of a rendered clearing pad, and an altered-story trail that joins the approach.
- The town path regression rejects the former universal dirt ribbon, requires five authored route profiles and four batched walked-meadow layers, and enforces non-competing depth tiers plus polygon offset for flat ground projection. Pilot and baseline grass both consume the same route/camp mask.
- The release-authorized `story-actions-v1` family adds six deterministic
  animation-only GLBs totaling 270,232 bytes: four semantic Lumen gestures plus
  dedicated plant and water performances. Focused Story Actions, action-clock,
  presenter, Core Hook, and Day One suites pass 33/33; both development and
  strict release asset audits pass under ADR 0005's standing animation
  authorization and the family's separately verified Mixamo source chain. Exact
  action-quality browser observations are recorded separately in
  [`2026-07-13-story-actions-v1.md`](2026-07-13-story-actions-v1.md).
- All eight successful chores now run through the same authoritative 3.0–3.6
  second action clock, keep state unchanged until their contact cue, lock
  movement for the bounded timeline, and commit exactly once. A desktop
  Chromium pass completed all eight through actual `E` interactions and reached
  the Community Ledger objective; detailed plant, water, reduced-motion,
  missing-catalog, failed-file, and save-boundary evidence is recorded in the
  Story Actions QA record.
- A targeted Chromium cooking pass used an actual `E` interaction and confirmed
  that the fish and center rod roll around their horizontal axis while the rack
  root and both support stakes remain fixed. The rotor restored on completion,
  reduced motion committed without transient rotation, and the console remained
  free of warnings and errors.
- A targeted Chromium recovery pass used actual `E` inputs for both branches:
  unrepaired exhaustion settled at the front-gate spawn `(0, ~0.91, 14)`,
  repairing the shelter swapped the collapsed and erected silhouettes and
  announced the new wake point, and repaired exhaustion settled beside camp at
  `(-29.3, ~0.91, 3.8)`. Reload preserved the repaired shelter; the console had
  no warnings or errors. The wake cover stayed opaque if pointer lock was lost,
  held movement through the reveal, and retained a painted cover frame with
  reduced motion enabled.
- A final 1280×720 Chromium pass used actual `E` interactions for Lumen,
  Ledger enrollment, one wood action, live Ledger review, and the first Bell.
  It confirmed the account changed from `WOOD GATHERED · 0 / 6` to `2 / 6`,
  the Bell remained locked during the recorded afternoon, and waiting four
  seconds beside it after the first ring did not produce a timer-only anomaly.
  A restored first-Bell save resumed 0.0008 m from the authored Bell-side
  return anchor and remained quiet there for another four seconds.
- The return-to-Lumen reveal locked control, framed the Bell with a measured
  camera-to-Bell alignment above 0.9999, committed the anomaly on the reveal
  frame before its single ring, restored player-relative framing within
  floating-point precision, and released the action lock. A reduced-motion
  Chromium session produced one durable ring with no focus shot, camera change,
  or lingering lock. Both sessions reported zero console warnings or errors.

## Production qualification — 2026-07-16

The exact cohort candidate is recorded in
[`../playtests/2026-07-16-m1-day-one-cohort.md`](../playtests/2026-07-16-m1-day-one-cohort.md):
runtime commit `1e58739c9fe6ae9c1a218f7eaa8c98dabb4827ea`, GitHub
deployment `5457588533`, public bundle `assets/index-CNX6_PYE.js`, and SHA-256
`827e9dbcde47f92559ee19cc159cba4c7aa5b0d17d178faf44dd43e854a255df`.

- A clean operator-guided production lap dispatched keyboard events through the
  production InputManager, motor, collision, and interaction paths to walk the
  full arrival, camp, pond, Bell, return, and ending routes. It signed the
  Ledger before chores, completed all Day One work, verified the truthful
  finished account, observed the erected shelter, reached the second Bell
  camera reveal, and completed the Alter ending. Console: zero warnings and
  zero errors.
- An intentional production pass-out lap cooked but did not eat the fish, then
  spent its remaining energy in the garden. The failed shelter attempt returned
  to the front gate at `(0, ~0.91, 14)`, restored needs to `70 / 55`, charged
  four coins, and retained five wood, one cooked fish, the fire, and garden.
  The shelter stayed collapsed and the Ledger showed supper prepared but not
  taken and shelter awaiting.
- Reload restored the exact recovery state and gate spawn. Eating and repairing
  then produced `82 / 93` energy/nourishment, one wood, an erected shelter, a
  complete account, and access to the first Bell. Console: zero warnings and
  zero errors.
- A representative 8.965-second walked segment on the qualification machine at
  1280×720 sampled 1,070 frames: 8.33 ms median, 8.36 ms p95, 8.80 ms p99,
  and 9.28 ms maximum.

Both operator routes therefore satisfy the route and recovery technical
preflight. Their waypoint guidance does not prove unaided human completion, so
they do not count toward the five fresh-player records or the
four-without-coaching threshold.

## Clean-run checks

- Start with `?story=reset` or use the in-game reset path.
- Confirm Day One nourishment, energy, and Wood/Fish/Seeds are readable without opening debug UI.
- Confirm camp interactions are unavailable before meeting Lumen and remain unavailable until the Ledger is signed.
- Confirm the Ledger unlocks immediately after Lumen’s welcome and signing it unlocks the Day One chores without advancing time to dusk.
- Reopen the Ledger during the afternoon and confirm wood, fish, fire, meal, seed-bed, and shelter entries match authoritative progress after reload and pass-out.
- Confirm the objective always names one achievable next action.
- Complete the full loop without deliberately repeating resource actions.
- Confirm nourishment and energy fall on labor and rise after eating.
- Confirm the garden visibly changes after planting and watering.
- Confirm the fire and patched shelter visibly persist after leaving and returning.
- Confirm the tent begins as a low collapsed bundle, becomes a standing shelter
  only after the repair contact, and announces that camp is the new wake point.
- Reload before completion and confirm inventory, needs, garden, camp, and objective restore.
- Complete the chores and confirm dusk and Bell guidance begin only after the Ledger account is complete.
- Ring the Bell once, wait beside it, and confirm no timer-only second ring occurs.
- Reload after the first Bell and confirm the player resumes on the Bell-side
  return route rather than at the front gate beside Lumen.
- Return toward Lumen; confirm control pauses, the camera flies to frame the Bell, the second ring occurs at the reveal, and the exact player view and control return afterward.
- Confirm reduced motion plays the second ring without a forced camera move.
- Inspect the false Ledger correction and confirm the existing choice sequence still completes.

## Pass-out recovery checks

- Repeat labor until there is not enough energy for the next paid action.
- Before shelter repair, confirm the pass-out is a recovery, not death: the
  player returns to the front gate with safe nourishment and energy.
- After shelter repair, confirm a later pass-out returns beside the camp
  shelter instead, with the erected state still visible.
- Confirm gathered wood, fish, planted/watered state, shelter state, and other completed work are retained.
- Confirm the clinic fee reduces coins when possible and otherwise becomes doctor debt; neither case blocks the day.
- Confirm lighting, cooking, and eating remain possible at zero working energy so the player cannot be trapped.
- Reload immediately after recovery and confirm the fee/debt, pass-out count, restored needs, and retained progress persist.
- Finish the Day One loop and reach the Bell.

## Browser and accessibility pass

- Check 1440×900 and 1280×720 for overlap among the objective, day/time badge, survival panel, interaction prompt, and story cards.
- Check reduced motion and increased contrast.
- Confirm Nourishment and Energy progress bars expose current values and qualitative labels to assistive technology.
- Confirm only discrete state or threshold changes use live announcements; routine meter projection must not spam them.
- Confirm keyboard-only play can reach every required interaction.
- Confirm the camp, pond, woodlot, seed bed, and town return path remain camera- and collision-readable.
- Confirm the relocated camp reads as a separate western clearing rather than part of the Rose Post Office yard, with open approach space around the fire, seed bed, and shelter.
- Orbit and walk across the arrival, cottage, pond, and forest routes by day and night. Confirm the worn clover, patch cadence, and stone density read differently; the civic plaza remains distinct; no peach dirt ribbon or camp pad returns; and no flat layer flickers or z-fights against the meadow.
- Time every successful action against
  [`wiki/Day-One-Action-Weight.md`](../../wiki/Day-One-Action-Weight.md); verify
  one commit at the visible contact cue, no overlap under input spam, and no
  stuck movement lock after completion, cancellation, error, pass-out, or
  reload. For the plant/water skeletal pilot, record the exact observations in
  [`2026-07-13-story-actions-v1.md`](2026-07-13-story-actions-v1.md). The
  automated actual-interaction route proves wiring and state progression; it
  does not replace the still-open fresh-player walk and action-feel gate.

## Fresh-player record

Use `docs/playtests/FRESH-PLAYER-TEMPLATE.md` for each comparable session. Add these Day One observations:

- Time to first self-directed resource action
- Help requests or missed wayfinding cues
- Whether the player understood why eating mattered
- Whether they attempted an optional extra resource action
- Whether they understood the pass-out consequence, if encountered
- Whether the comfort of improving camp made the Bell conflict feel more consequential

Do not claim the Day One Proof validated until at least five comparable fresh-player records exist and four complete without coaching.

## Deferred on purpose

Multi-day crop growth, seasons, recipes, shops, a simulated doctor visit, freeform construction, home decorating, tool durability, broad economy, procedural resources, and forbidden-forest exploration are outside this proof.
