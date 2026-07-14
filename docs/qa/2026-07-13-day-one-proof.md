# Day One Proof QA

**Status:** implementation complete; fresh-player validation pending  
**Player-facing beat:** arrive as an uncertain newcomer, make the provisional forest-edge camp livable, then accept the town's first courtesies  
**Exit criterion:** a clean run and an intentional pass-out run both reach the existing dusk Bell sequence without developer help, lost progress, or a resource soft lock

## Experience hypothesis

The player should leave the first afternoon feeling fed, capable, and newly attached to a small place they improved themselves. That sincere comfort gives the later Ledger and Bell routine something worth risking. The first wrongness remains social: Thornvale is generous about the plot, the recovery, and the rules, but every kindness is recorded.

## Included loop

1. Read the arrival letter and meet Steward Lumen.
2. Follow the west path to the provisional camp.
3. Gather six wood from the woodlot.
4. Catch one fish at the pond.
5. Light the campfire, cook the fish, and eat it.
6. Plant and water the seed bed.
7. Spend wood to patch the shelter.
8. Sign the Community Ledger and continue through the existing dusk Bell beat.

The gathering, fishing, gardening, and shelter steps may be completed in different safe orders. The fire, meal, and resource costs remain authored and deterministic for this proof.

## Implementation evidence — 2026-07-13

- `npm run check` passed with 170/170 deterministic tests, a production Vite build, the asset audit, and the release-size check after the camp relocation and walked-meadow path pass.
- Focused coverage proves the clean resource loop, zero-energy fire/cook/eat recovery, pass-out fee and debt branches, retained progress, save migration, Day One world projection, survival HUD accessibility, and the Day One-to-Ledger gate.
- An independent code review found no progression, recovery, migration, or Ledger-unlock blockers.
- Browser smoke at 1280×720 confirmed the welcome screen, arrival letter, first objective, pointer-lock handoff, town presentation, and an error-free console. The pilot and `?assets=baseline&traits=off` variants both booted cleanly after the camp relocation.
- The camp-spacing regression now enforces separate cottage clearance, authored-footprint breathing room, non-competing interaction radii, meadow-edge margin, a narrow approach that reaches the recovery point, local grass exclusions instead of a rendered clearing pad, and an altered-story trail that joins the approach.
- The town path regression rejects the former universal dirt ribbon, requires five authored route profiles and four batched walked-meadow layers, and enforces non-competing depth tiers plus polygon offset for flat ground projection. Pilot and baseline grass both consume the same route/camp mask.
- The development-only `story-actions-v1` pilot adds six deterministic
  animation-only GLBs totaling 270,232 bytes: four semantic Lumen gestures plus
  dedicated plant and water performances. Focused Story Actions, action-clock,
  presenter, Core Hook, and Day One suites pass 29/29; the development asset
  audit passes while the family remains explicitly release-blocked. Exact
  browser observations are tracked separately and remain pending in
  [`2026-07-13-story-actions-v1.md`](2026-07-13-story-actions-v1.md).
- The browser harness cannot hold continuous WASD input long enough for a representative 3D route traversal. The full walkable clean run and intentional pass-out run therefore remain manual playtest gates; they are not claimed as browser-validated here.

## Clean-run checks

- Start with `?story=reset` or use the in-game reset path.
- Confirm Day One nourishment, energy, and Wood/Fish/Seeds are readable without opening debug UI.
- Confirm camp interactions are unavailable before meeting Lumen and become available afterward.
- Confirm the objective always names one achievable next action.
- Complete the full loop without deliberately repeating resource actions.
- Confirm nourishment and energy fall on labor and rise after eating.
- Confirm the garden visibly changes after planting and watering.
- Confirm the fire and patched shelter visibly persist after leaving and returning.
- Confirm the Ledger stays locked until the Day One completion predicate is satisfied.
- Reload before completion and confirm inventory, needs, garden, camp, and objective restore.
- Complete the loop, sign the Ledger, ring the Bell, and confirm the existing anomaly and choice sequence still completes.

## Pass-out recovery checks

- Repeat labor until there is not enough energy for the next paid action.
- Confirm the pass-out is a recovery, not death: the player returns to camp with safe nourishment and energy.
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
  [`2026-07-13-story-actions-v1.md`](2026-07-13-story-actions-v1.md); none are
  claimed complete until that browser matrix is filled in.

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
