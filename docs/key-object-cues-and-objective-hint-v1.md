# ThornVale Feature Brief — A Courtesy Points the Way

## Decision

- **Active milestone and gate:** Phase 1 feedback and bounded refinement; reduce
  comprehension stalls without weakening the authored Day One/Core Hook route.
- **Decision to make:** Test a three-landmark visual vocabulary and a temporary
  desktop hint before considering a minimap, quest compass, or broader icon set.
- **Player-feeling shift:** Verbally overloaded and unsure what the town means ->
  recognizes the requested landmark and can recover direction without leaving play.
- **Fresh-player hypothesis:** A clean-save player can identify the Ledger, camp,
  and Bell and recover from one wrong turn with `H`, with fewer required-help
  moments and no assumption that the wind is a permanent GPS route.

## Beat contract

- **Cozy pleasure:** Small storybook object studies make the next courtesy feel
  tangible, while a warm breath of air briefly helps the player reorient.
- **Precise wrongness:** The same immaculate civic images recur in conversation
  and objectives, as though the town has already prepared what the player should see.
- **Kindness as control:** Guidance is offered politely, briefly, and only along
  routes the town considers safe.
- **Player response:** Read the depicted landmark, continue in the world, or press
  `H` to request four seconds of route guidance.
- **Protected ambiguity:** The gust can be generous wayfinding or another way
  Thornvale keeps newcomers on its approved paths.

## Beat sequence

| Beat | Player action | Town response | Player-visible evidence |
| --- | --- | --- | --- |
| Request | Read a conversation or objective | Names a key place | Ledger, camp, or Bell image appears with a text label |
| Reorient | Press `H` while grounded and world controls are active | Resolves the live objective against reviewed paths | Air gathers at the player's feet, rises, and joins one approved corridor |
| Continue | Walk or ignore the cue | Keeps progression unchanged | Gust disappears after four seconds; objective remains |
| Resolve | Reach a comply/alter ending route | Defers to the existing consequential route | No second hint competes with the persistent story trail |

## Consequence map

This refinement adds no authoritative consequence. It projects existing
objective, route, and world state and must never advance the story.

| Choice or behavior | Output type | Immediate change | Later change | Authoritative state | Visible proof |
| --- | --- | --- | --- | --- | --- |
| Read request | UI projection | Landmark study appears | Objective can reuse it | Existing content objective/beat | Image and label, with text-only fallback |
| Press `H` | World projection | A temporary windborne point cloud gathers at the player's ground contact | Cloud expires | Existing current objective and live target provider | One four-second draw; a fixed-collider-checked pickup rises into the reviewed route body, which hands off 2.4 m early to a short, eased, leashed final breath |
| Choose comply/alter | Existing route/world | Existing persistent route appears | Existing ending remains reachable | Existing `GameSession` choice | No temporary ribbon is created |

The V2 presentation retains that route contract while replacing the ground
dashes with one spatial point-cloud gust: dozens of muted-ivory motes, sparse
sage matter, and one warm-gold leading point advect in irregular clumps around
the route tangent. The accepted player position is snapshotted at visible
ground contact; an airborne request waits until the player lands and asks again.
A short boot-height pickup joins the nearest reviewed corridor that clears both
cottage masses and the fixed prop/landmark envelopes shared with town physics,
rises smoothly into a 1.0–1.35 m body with a sparse 1.5 m crest, and descends
only during the final target handoff. The stream broadens subtly and corkscrews
through its wake without opening into a haze or collapsing back into a line.
Individual motes decay at staggered thresholds after the first fifth of the
journey; by roughly ninety-percent route progress, about eighty-five percent of
the body has released into the air, leaving only the lead and a final breath.
Reduced motion freezes a short directional cloud with the same ground-to-chest
silhouette instead of simulating its flow or attrition.

## Scope

- **Reuse:** Current objectives, interactable positions, authored town paths,
  StoryUI, and Three.js scene lifecycle.
- **Build:** Three optimized landmark studies, cue descriptors, exact provenance,
  a safe path resolver, semantic `H` input, and one temporary point-cloud trail.
- **Do not build:** Voiceover, lip sync, cutscenes, minimap, compass arrow,
  navmesh/pathfinding, permanent quest GPS, new story state, or a broad icon atlas.
- **Defer until:** Clean-save observation shows which missing landmarks or failure
  points repeat across players.

## Implementation map

| File or symbol | Change | Source of truth | Proof |
| --- | --- | --- | --- |
| `src/content/key-object-cues-v1.js` and story content | Declare stable cue descriptors and exact targets | Authored content | Cue/target contract tests |
| `CoreHookDirector.currentObjective/resolveObjectiveTarget` | Expose read-only live objective destinations | Session/game state | Core Hook regression tests |
| `resolveObjectiveHintPath` | Snapshot exact player ground origin, select a reachable reviewed corridor, and fail closed | Town layout | Origin, alternate-snap, clearance, and objective matrix tests |
| `StoryUI` and `ObjectiveHintTrail` | Project images and a temporary spatial wind cue | Consumes objective state | UI/trail height, lifecycle, and browser observation |
| `assets-src/ui/key-object-cues-v1` | Record prompts, sources, transforms, and hashes | Asset provenance | Asset audit and deterministic derivative verification |

## Blind-playtest proof

- **Setup:** Clean save, no coaching, desktop keyboard/mouse, normal pacing.
- **Pass threshold:** Player identifies all three landmarks, uses or deliberately
  ignores `H`, and completes the route without treating the wind as permanent.
- **Record:** Completion time, wrong-landmark approaches, `H` presses, help
  requests, stalls over 20 seconds, route, choice, and replay interest.
- **Unprompted questions:** “What did the pictures mean?” “Who did you think was
  showing you the trail?” “What felt unusual?”
- **Failure signal:** The images are read as inventory items, the pickup fails to
  begin at the player, the wind points through scenery, or the player waits for
  it instead of reading the world.
- **Next tuning decision:** Adjust image placement, labels, duration, or only the
  repeatedly confusing objective; do not expand the system from isolated taste.

## Handoff

- **Player-visible result:** Landmark conversations are no longer text-only, and
  `H` offers a brief diegetic recovery trail to the active objective.
- **Verification:** Focused regressions, `npm run check`, asset release audit, and
  desktop/landscape/portrait browser smoke.
- **Known limitation or risk:** Pickup clearance covers cottage masses and the
  fixed gameplay colliders for the gate, authored props, Ledger, and Bell.
  Decorative non-colliders and temporary Day One dressing remain a browser-QA
  gate. V1 covers three key landmarks and desktop `H`; touch access and further
  studies require observed need.
- **Safest next gate:** Complete one clean-save route plus phase-end fresh-player
  observation before adding more image families or navigation affordances.
