# ThornVale Feature Brief — The Path Remembers You

## Decision

- **Active milestone and gate:** Improve fresh-player comprehension without adding a new tutorial verb or weakening the Core Hook Proof.
- **Decision to make:** Test a 75–120 second arrival in which movement, camera look, Hint, interaction, and one relationship posture are learned through play.
- **Player-feeling shift:** Exposed and uncertain → relieved by earned warmth → curious about a contradiction.
- **Fresh-player hypothesis:** An uncoached player can reach the gate, use or understand Hint, notice the matching old tread, and want another conversation with Lumen.

## V2 refinement contract

- Teach through response, not a separate tutorial: show only Look, then Move,
  then the optional Hint invitation inside the existing objective surface.
- Clear Look after 20 degrees of cumulative yaw, Move after three metres, and
  Hint only after a successful semantic Hint action. Reaching the crossroads
  retires any unfinished Look or Move cue without scolding the player.
- Keep the existing contextual `E`/Action prompts as the sole interaction
  teaching near Lumen and the lantern; do not teach sprint or jump here.
- Conceal the physical edge with a 20–30 metre presentation skirt of dense
  pines, buried brush, deep drifts, and worsening snow.
- Treat the approach, remembered route, and wrong fork as one reviewed
  corridor. More than ten metres off every segment may trigger a 200–300 ms
  whiteout fold to the broken three-pronged waypost with its snapped prong and
  ochre ribbon. Preserve facing and held movement; mutate no session state.
- Keep the matching older tread as the opening's only canonical contradiction.
  The fold is optional edge recovery, not a second mystery or new story branch.

## Beat contract

- **Cozy pleasure:** A near-spent lantern, an open gate, and a snow-covered Lumen make the welcome feel prepared and costly.
- **Precise wrongness:** The older footprints have the same missing triangle in the left heel as the player’s fresh prints.
- **Kindness as control:** Lumen does not deny the contradiction, but moves the conversation inside before answering it.
- **Player response:** The player protects their memory, notices Lumen’s care, or probes who “we” means; then they choose when to take the lantern and cross.
- **Protected ambiguity:** Lumen may be protecting a cold traveler, participating in the town’s shared-memory system, or both.

## Beat sequence

| Beat | Player action | Town response | Player-visible evidence |
| --- | --- | --- | --- |
| Trusted memory | Continue from the opening card | The storm yields control | The player remembers choosing Thornvale and every mile before the storm, but not this path |
| Crossroads | Follow a winding approach through the whiteout | Snow drifts, sparse stakes, and two credible roads obscure the town | Only the player’s fresh prints are visible behind them |
| Hint | Press `H` or tap the persistent **Hint** control, or choose a road unaided | A high-contrast gust traces the next 12 metres of the reviewed route | Older prints with the matching left-heel notch emerge toward the gate |
| Welcome | Approach Lumen | He names the route as familiar | Snow rests on his shoulders beside a nearly spent lantern and open gate |
| Relationship | Choose one of three questions | Lumen acknowledges the contradiction without settling it | `arrival_posture` records truth-, care-, or structure-seeking intent |
| Invitation | Take the lantern | Warmth is offered without agreement | The lantern leaves its waiting place |
| Threshold | Walk through the gate | The arrival layer yields to the town | The existing self-written letter appears only after the first opinion of Lumen has formed |

## Consequence map

| Choice or behavior | Output type | Immediate change | Later change | Authoritative state | Visible proof |
| --- | --- | --- | --- | --- | --- |
| Use Hint at the crossroads | World/guidance | Reveals the older matching trail and projects a bounded 12-metre wind cue | Establishes “the path remembers” as the opening motif | No progression change; presentation only | Matching notched prints and four-second trail |
| Choose an arrival posture | Relationship | Changes what the player asks Lumen first | Leaves a durable hook for later Lumen memory tracks | `choices.arrival_posture` | Selected line, followed by Lumen’s common offer of warmth |
| Take the lantern and cross | Access/world | Makes the threshold player-controlled | Opens the existing Day One/Courtesy route | `arrival-lantern-taken`, then atomic `arrival-letter-seen` + `steward-lumen-met` | Lantern disappears; snow layer clears; Ledger objective begins |

## Scope

- **Reuse:** Steward Lumen, the welcome gate, `GameSession`, `CoreHookDirector`, semantic `objective-hint`, `ObjectiveHintTrail`, Story UI, and the existing self-written letter.
- **Build:** One temporary 75-metre snow route, one legible dead-end fork, sparse distance markers and drifts, readable footprint anomaly, device-specific Hint access, three arrival postures, a lantern interaction, and a player-controlled threshold.
- **Do not build:** Total amnesia, danger timers, health loss, companion footprints, voiced wind, branching destinations, new map systems, or branches that change Day One.
- **Defer until:** A fresh-player test shows the player feels cared for, notices the contradiction, and wants another Lumen conversation.

## Implementation map

| File or symbol | Change | Source of truth | Proof |
| --- | --- | --- | --- |
| `src/config/arrival-prologue.js` | Arrival anchors, 75-metre reviewed route, dead-end fork, footprint sets, one tread signature | Arrival geometry contract | Arrival world and route tests |
| `src/content/core-hook-v03.js` | Trusted memory, Lumen beats, three postures, lantern/gate objectives | Authored story content | Dialogue and session tests |
| `src/game/CoreHookDirector.js` | Durable arrival sequence and atomic gate handoff | `GameSession` | Interaction-order and all-posture regressions |
| `src/visuals/ArrivalWorld.js` | Snow, crossroads, matching prints, open gate, lantern, shoulder snow | Presentation consumes state | Scene projection test and browser smoke |
| `src/config/objective-hints.js` | Reviewed whiteout route and arrival objective mappings | Hint corridor graph | Safe-path regressions |
| `src/ui/TouchControls.js`, `src/ui/StoryUI.js` | Touch Hint parity and three-choice UI | Semantic input and accessible modal contracts | Touch and keyboard tests |

## Blind-playtest proof

- **Setup:** Clean save, no coaching, one desktop and one representative phone viewport.
- **Pass threshold:** Reach the gate in 75–120 seconds; understand Hint without mistaking it for teleport; notice or later identify the matching print; describe Lumen as caring, suspicious, or both.
- **Record:** Completion time, first stall, Hint use, anomaly notice, chosen posture, and desire to speak with Lumen again.
- **Unprompted questions:** “What felt unusual?” “Why do you think Lumen waited?”
- **Failure signal:** The player remembers only “press H,” misses the footprint match, reads Lumen as purely sinister, or cannot find the mobile action.
- **Next tuning decision:** Adjust prompt timing, footprint contrast, or Lumen’s wait evidence before adding another anomaly.

## Handoff

- **Player-visible result:** Fresh saves begin with The Path Remembers You; established saves retain their current town entry and progression.
- **Verification:** Focused content/state/input/route tests, full `npm run check`, and desktop plus touch browser smoke.
- **Known limitation or risk:** The posture is stored for later relationship tracks but intentionally does not branch Day One yet.
- **Safest next gate:** Five uncoached fresh-player runs across desktop and phone before expanding the motif.
