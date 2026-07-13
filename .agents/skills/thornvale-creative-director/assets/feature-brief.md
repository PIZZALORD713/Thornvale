# ThornVale Feature Brief — [Player-facing beat]

## Decision

- **Active milestone and gate:** [What current exit criterion does this serve?]
- **Decision to make:** [What is being approved, rejected, or tested?]
- **Player-feeling shift:** [Starting feeling] -> [Ending feeling]
- **Fresh-player hypothesis:** [Observable claim this beat tests]

## Beat contract

- **Cozy pleasure:** [Why participation is sincerely appealing]
- **Precise wrongness:** [One social, environmental, or behavioral mismatch]
- **Kindness as control:** [Routine, scrutiny, shared memory, or polite correction]
- **Player response:** [What the player can do rather than only hear]
- **Protected ambiguity:** [How protection and containment both remain plausible]

## Beat sequence

| Beat | Player action | Town response | Player-visible evidence |
| --- | --- | --- | --- |
| Welcome | [Action] | [Response] | [Evidence] |
| Courtesy | [Action] | [Response] | [Evidence] |
| Reward | [Action] | [Response] | [Evidence] |
| Rule | [Action] | [Response] | [Evidence] |
| Anomaly | [Action] | [Response] | [Evidence] |
| Kind correction | [Action] | [Response] | [Evidence] |
| Choice | [Action] | [Response] | [Evidence] |
| Aftermath | [Action] | [Response] | [Evidence] |

## Consequence map

Include at least three distinct player-visible output types. Do not count dialogue
wording alone as a consequence.

| Choice or behavior | Output type | Immediate change | Later change | Authoritative state | Visible proof |
| --- | --- | --- | --- | --- | --- |
| [Behavior] | [Route/access/NPC/scrutiny/relationship/world/ending] | [Change] | [Change] | [Flag/value] | [What the player sees] |
| [Behavior] | [Output type] | [Change] | [Change] | [Flag/value] | [What the player sees] |
| [Behavior] | [Output type] | [Change] | [Change] | [Flag/value] | [What the player sees] |

## Scope

- **Reuse:** [Existing characters, places, interactions, and systems]
- **Build:** [Smallest complete playable thread]
- **Do not build:** [Explicit non-goals]
- **Defer until:** [Evidence or gate required before expansion]

## Implementation map

| File or symbol | Change | Source of truth | Proof |
| --- | --- | --- | --- |
| `src/content/...` | [Authored declaration] | Content | [Content/state test] |
| `src/game/...` | [Authoritative behavior] | Session/game state | [Focused regression] |
| `src/ui/...` or `src/visuals/...` | [Projection or intent] | Consumes game state | [Browser observation] |

## Blind-playtest proof

- **Setup:** Clean save/profile; no coaching; [supported viewport/input].
- **Pass threshold:** [Completion, comprehension, anomaly notice, and consequence visibility].
- **Record:** Completion time, help requests, stalls, route, choice, and replay interest.
- **Unprompted questions:** "What felt unusual?" "Why do you think the town did that?"
- **Failure signal:** [Observation that disproves the hypothesis].
- **Next tuning decision:** [One change the result would authorize].

## Handoff

- **Player-visible result:** [What changes in play]
- **Verification:** [Focused tests, `npm run check`, and browser smoke]
- **Known limitation or risk:** [Scope, ambiguity, progression, or presentation risk]
- **Safest next gate:** [Evidence required before adding another beat or system]
