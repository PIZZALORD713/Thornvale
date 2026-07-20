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
  moments and no assumption that the ribbon is a permanent GPS route.

## Beat contract

- **Cozy pleasure:** Small storybook object studies make the next courtesy feel
  tangible, while a warm ground ribbon briefly helps the player reorient.
- **Precise wrongness:** The same immaculate civic images recur in conversation
  and objectives, as though the town has already prepared what the player should see.
- **Kindness as control:** Guidance is offered politely, briefly, and only along
  routes the town considers safe.
- **Player response:** Read the depicted landmark, continue in the world, or press
  `H` to request four seconds of route guidance.
- **Protected ambiguity:** The ribbon can be generous wayfinding or another way
  Thornvale keeps newcomers on its approved paths.

## Beat sequence

| Beat | Player action | Town response | Player-visible evidence |
| --- | --- | --- | --- |
| Request | Read a conversation or objective | Names a key place | Ledger, camp, or Bell image appears with a text label |
| Reorient | Press `H` while world controls are active | Resolves the live objective against reviewed paths | One warm, collision-free ground ribbon appears |
| Continue | Walk or ignore the cue | Keeps progression unchanged | Ribbon disappears after four seconds; objective remains |
| Resolve | Reach a comply/alter ending route | Defers to the existing consequential route | No second hint competes with the persistent story trail |

## Consequence map

This refinement adds no authoritative consequence. It projects existing
objective, route, and world state and must never advance the story.

| Choice or behavior | Output type | Immediate change | Later change | Authoritative state | Visible proof |
| --- | --- | --- | --- | --- | --- |
| Read request | UI projection | Landmark study appears | Objective can reuse it | Existing content objective/beat | Image and label, with text-only fallback |
| Press `H` | World projection | Temporary path markers appear | Markers expire | Existing current objective and target | One four-second instanced ribbon |
| Choose comply/alter | Existing route/world | Existing persistent route appears | Existing ending remains reachable | Existing `GameSession` choice | No temporary ribbon is created |

## Scope

- **Reuse:** Current objectives, interactable positions, authored town paths,
  StoryUI, and Three.js scene lifecycle.
- **Build:** Three optimized landmark studies, cue descriptors, exact provenance,
  a safe path resolver, semantic `H` input, and one temporary instanced trail.
- **Do not build:** Voiceover, lip sync, cutscenes, minimap, compass arrow,
  navmesh/pathfinding, permanent quest GPS, new story state, or a broad icon atlas.
- **Defer until:** Clean-save observation shows which missing landmarks or failure
  points repeat across players.

## Implementation map

| File or symbol | Change | Source of truth | Proof |
| --- | --- | --- | --- |
| `src/content/key-object-cues-v1.js` and story content | Declare stable cue descriptors and exact targets | Authored content | Cue/target contract tests |
| `CoreHookDirector.currentObjective/resolveObjectiveTarget` | Expose read-only live objective destinations | Session/game state | Core Hook regression tests |
| `resolveObjectiveHintPath` | Follow only reviewed town corridors and fail closed | Town layout | Path clearance and objective matrix tests |
| `StoryUI` and `ObjectiveHintTrail` | Project images and a temporary world ribbon | Consumes objective state | UI/trail tests and browser observation |
| `assets-src/ui/key-object-cues-v1` | Record prompts, sources, transforms, and hashes | Asset provenance | Asset audit and deterministic derivative verification |

## Blind-playtest proof

- **Setup:** Clean save, no coaching, desktop keyboard/mouse, normal pacing.
- **Pass threshold:** Player identifies all three landmarks, uses or deliberately
  ignores `H`, and completes the route without treating the ribbon as permanent.
- **Record:** Completion time, wrong-landmark approaches, `H` presses, help
  requests, stalls over 20 seconds, route, choice, and replay interest.
- **Unprompted questions:** “What did the pictures mean?” “Who did you think was
  showing you the trail?” “What felt unusual?”
- **Failure signal:** The images are read as inventory items, the ribbon points
  through scenery, or the player waits for it instead of reading the world.
- **Next tuning decision:** Adjust image placement, labels, duration, or only the
  repeatedly confusing objective; do not expand the system from isolated taste.

## Handoff

- **Player-visible result:** Landmark conversations are no longer text-only, and
  `H` offers a brief diegetic recovery trail to the active objective.
- **Verification:** Focused regressions, `npm run check`, asset release audit, and
  desktop/landscape/portrait browser smoke.
- **Known limitation or risk:** V1 covers three key landmarks and desktop `H`;
  touch access and further studies require observed need.
- **Safest next gate:** Complete one clean-save route plus phase-end fresh-player
  observation before adding more image families or navigation affordances.
