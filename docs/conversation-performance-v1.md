# ThornVale Feature Brief — Conversation Performance v1

## Decision

- **Active milestone and gate:** Phase 1 broad build is complete; this bounded
  refinement must improve comprehension and emotional connection without
  changing authoritative story progression.
- **Decision:** Prove one reusable beat-based conversation presentation across
  the existing Core Hook, with the false Ledger correction as the hero scene.
- **Player-feeling shift:** Certain of what happened -> gently pressured to
  doubt it -> aware that the chosen account changes Thornvale.
- **Fresh-player hypothesis:** Short world-visible lines synchronized with
  Lumen's existing gestures let a player describe Lumen's emotional stance and
  the one-Bell rule without describing the experience as reading a text wall.

## Beat contract

- **Cozy pleasure:** Lumen gives the player focused, courteous attention.
- **Precise wrongness:** The false apology is already dry and written in the
  player's hand, while Lumen treats it as more compassionate than lived memory.
- **Kindness as control:** Concern, shared memory, and a polite request to
  confirm the correction replace accusation or threat.
- **Player response:** Confirm the town's record or write what happened.
- **Protected ambiguity:** Lumen remains calm and plausibly protective; the
  route, Ledger, and town reveal the cost of that protection.

## Scope

- **Reuse:** Existing dialogue, StoryUI modal lifecycle, Lumen Story Actions,
  Ledger choice, route projection, endings, and save state.
- **Build:** Declarative spoken beats, one-at-a-time presentation, semantic
  gesture synchronization, and a compact world-visible dialogue treatment.
- **Do not build:** Full voiceover, lip sync, a general cutscene engine,
  procedural camera direction, new story branches, or new animation assets.
- **Defer until:** The complete route is stable and a fresh-player refinement
  pass shows which lines, framings, or vocal anchors deserve more production.

## Consequence map

| Choice | Output type | Existing immediate change | Visible proof |
| --- | --- | --- | --- |
| Confirm | Route and access | Cottage route opens | Warm destination and route treatment |
| Confirm | NPC and relationship | Lumen becomes warm | Relief gesture and welcome-home response |
| Confirm | World and ending | The town recognizes the player as Home | Ending treatment and standing projection |
| Alter | Route and access | Thorn path opens | Warm way closes and forgotten path appears |
| Alter | NPC and scrutiny | Lumen becomes corrective | Stillness and promise to practice again |
| Alter | World and ending | The town withdraws recognition | Altered route, standing, and ending treatment |

## Implementation map

| File or symbol | Change | Authority | Proof |
| --- | --- | --- | --- |
| `src/content/core-hook-v03.js` | Stable short dialogue beats and gesture cues | Authored content | Structural content test |
| `src/game/CoreHookDirector.js` | Project beat cues to Lumen without committing state | Story orchestration | Core Hook ordering regression |
| `src/ui/StoryUI.js` | Render and advance one spoken beat at a time | Presentation only | Focus and beat lifecycle tests |
| `index.html` | Keep spoken dialogue compact and the world visible | Presentation only | Desktop and touch browser smoke |

## Blind-playtest proof

- **Setup:** Clean save, normal player-facing instructions, supported desktop or
  touch viewport, no coaching.
- **Pass threshold:** At least 80% complete without help; at least 70% describe
  kindness, concern, routine, or shared memory as pressure; every finisher names
  at least two immediate consequence changes.
- **Record:** Reading stalls, rapid skips, help, route, choice, consequence
  recall, Lumen's perceived stance, and replay interest.
- **Failure signal:** Players still report a text wall, miss the false-memory
  mismatch, or cannot connect their choice to changed treatment.
- **Next tuning decision:** Adjust line length and staging before adding voice;
  add selective vocal anchors only after the conversation rhythm holds.

## Handoff gate

- Focused dialogue, UI, animation-order, and story-state regressions pass.
- `npm run check` passes from the combined worktree.
- A real-browser clean-save route reaches both outcomes with the world visible,
  dialogue advancing exactly once per input, and progression unchanged.
