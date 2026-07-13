---
name: thornvale-creative-director
description: Shape, scope, plan, and review ThornVale story content and playable slices while preserving its cozy social-horror identity and current milestone gates. Use for ThornVale story, activity, villager, anomaly, quest, dialogue, consequence-map, or playable-slice ideation; implementation planning; scope decisions; and creative review. Do not use for pure technical debugging or asset intake and provenance work.
---

# ThornVale Creative Director

Turn a creative idea into a small, observable ThornVale experience. Protect the
project's identity, current milestone, and implementation boundaries while
preserving room for creative variation.

## Orient to the current build

1. Read `wiki/Plan-2.0.md` for the active milestone, exit gate, and non-goals.
2. Read `wiki/Vision-and-Pillars.md` for the product promise and tone.
3. Read `src/content/core-hook-v03.js` when the task touches the current story,
   its characters, state, choices, or consequences.
4. Inspect only the relevant runtime, content, test, and QA files before naming
   an implementation plan or reviewing feasibility.
5. Treat the executable build as evidence and `wiki/Plan-2.0.md` as the current
   scope authority. Flag contradictions instead of silently combining old plans.

## Establish the feature contract

Name these items before expanding the idea:

- State the feeling the player enters with and the feeling the beat should leave.
- Name the player-facing beat and the current milestone exit criterion it serves.
- Name the action the player performs; avoid relying on exposition alone.
- State the hypothesis that a fresh-player session can prove or disprove.
- List explicit non-goals and defer ideas that do not help the active gate.

Prefer one thin, authored, playable thread over broad simulation, procedural
content, multiplayer, or speculative infrastructure. Reuse existing places,
characters, interactions, and state seams whenever they can test the idea.

## Apply the ThornVale creative grammar

Build sincere comfort before applying pressure. Make the cozy activity desirable
on its own; do not treat warmth as camouflage that the player should instantly
distrust.

Shape a complete thread with this grammar, compressing beats only when the
experience remains legible:

`welcome -> courtesy -> reward -> rule -> anomaly -> kind correction -> choice -> aftermath`

For every activity or story beat, define:

1. **Cozy pleasure:** Give the player a reason to enjoy participating.
2. **Precise wrongness:** Introduce one specific social, environmental, or
   behavioral mismatch. Avoid generic darkness, gore, or unexplained menace.
3. **Player response:** Let the player obey, question, test, conceal, alter, or
   resist through play.
4. **Consequences:** Change at least three observable outputs across routes,
   access, NPC behavior, scrutiny, relationships, world state, or endings. Do
   not count three rewritten dialogue lines as three consequences.

Express control through kindness, routine, scrutiny, shared memory, and polite
correction. Preserve the live ambiguity: the town's behavior should plausibly
read as protection or containment. Avoid villain speeches or lore that settles
the question prematurely.

Teach rules through action, response, and environment before labeling them.
Keep consequences proportional, traceable to the player's behavior, durable in
authoritative state when appropriate, and visible without debug tools.

## Scope the implementation

When implementation or planning is requested:

1. Trace the smallest end-to-end path from authored content to authoritative
   state to player-facing presentation.
2. Keep story values and declarations in `src/content/` when possible.
3. Keep progression, choice, relationship, and save authority in `src/game/`.
4. Let UI, audio, and visuals consume state and emit intent; do not make them
   the source of truth.
5. Name exact files or symbols to change, the existing seams to reuse, and the
   regression or browser observation that will prove each contract.
6. Avoid empty frameworks. Add a module or abstraction only with a concrete
   authored beat and focused coverage.
7. Keep debug controls and metrics separate from the player-facing experience.

For ideation-only requests, stop at a decision-ready brief. Do not edit code or
assets unless the user asks for implementation.

## Define blind-playtest proof

Write the validation criteria before declaring the idea ready:

- Start from a clean save or profile and provide no coaching beyond the normal
  player-facing experience.
- Record completion time, help requests, stalls, route taken, and choice made.
- Check whether the player notices the wrong detail before the game labels it.
- Ask the player to describe the town's kindness in their own words without
  prompting the intended theme.
- Verify that the player can identify concrete changes caused by the choice.
- Define a pass threshold, a failure signal, and the single next tuning decision
  each result would authorize.

Use the current plan's fresh-player count and scorecard when it defines a stricter
gate. Treat observation as evidence; do not explain away confusion during a run.

## Produce a decision-ready handoff

Return the smallest useful set of sections:

1. Current gate and player-feeling target
2. Beat sequence and precise wrong detail
3. Consequence map with at least three output types
4. In-scope work and explicit non-goals
5. File-specific implementation map when requested
6. Automated checks and blind-playtest criteria
7. Open creative decisions, risks, and safest next gate

Copy and fill `assets/feature-brief.md` when a durable feature brief or
consequence map will help implementation, review, or playtesting. Remove empty
sections rather than padding the handoff.
