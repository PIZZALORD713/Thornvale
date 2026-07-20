# 2026-07-19 Conversation Performance v1 QA

## Scope

- Player-facing change: spoken exchanges advance as short authored beats in a
  world-visible dialogue panel; beat changes cue existing semantic Lumen
  gestures; the Ledger decision remains deliberate and world-visible.
- Hero encounter: false Ledger correction -> Lumen intervention ->
  comply/alter -> immediate response.
- Progression authority, save schema, routes, relationships, and endings are
  unchanged.
- Voiceover, lip sync, procedural cinematography, new animations, and a
  physical Ledger-writing interaction remain outside this v1 build.

## Automated evidence

| Gate | Result | Evidence |
| --- | --- | --- |
| Dialogue content | PASS | Stable unique beat IDs, nonempty short text, correction order, and existing gesture vocabulary |
| StoryUI | PASS | One beat per advance, Next/Continue hint transitions, callback isolation, legacy fallback, focus/inert restoration, and safe disposal |
| Core Hook | PASS | Gesture ordering/fallback and unchanged interaction, persistence, route, relationship, and ending contracts |
| `npm run check` | PASS | 261/261 tests, Vite production build, and development asset audit |
| Production payload | PASS | `dist/` 8,386,106 / 8,388,608 bytes; existing Vite chunk-size warning only |

## Browser evidence

- Runtime: local Vite development server in headless Chromium 150 on macOS,
  DPR 1, normal-motion media preference.
- Route: `?story=reset&controls=desktop&assets=baseline&traits=off`.
- Artifacts were captured under ignored `output/playwright/`; they are not
  release artifacts or committed evidence.

| View or behavior | Result | Observation |
| --- | --- | --- |
| Desktop welcome and correction | PASS | 1280x720 world remained visible around the bottom-left panel; each Enter/click advanced exactly one beat; intermediate and final labels/hints agreed |
| Deliberate choice | PASS | A bare Enter did not select either irreversible Ledger choice; explicit button activation did |
| Comply response | PASS | Director reached `choice=comply`, `relationship=warm`, `phase=resolution`; response remained beat-based |
| Alter response | PASS | Director reached `choice=alter`, `relationship=corrective`, `phase=resolution`; response remained beat-based |
| Phone landscape | PASS | At 844x390, dialogue stayed bottom-left and the two-choice panel stayed grounded with the town visible above it |
| Phone portrait | PASS | At 390x844, dialogue stayed within safe edges with a 48px action target and the player/Lumen/world visible |
| Console | PASS | No error or warning during recorded conversation, choice, desktop, landscape, or portrait checks |

The two outcome checks used deterministic QA staging through authoritative
`GameSession` state followed by the real `CoreHookDirector.interact` and
StoryUI path. That proves integration and consequence contracts, not a genuine
walked clean-save route or fresh-player comprehension.

## Remaining observation and refinement gates

- Walk the complete clean-save route at normal pacing and inspect the Ledger
  acknowledgement plus both correction gestures against their real day/night
  silhouettes.
- Run the phase-end fresh-player questionnaire before claiming improved
  emotional connection or comprehension.
- Tune line length, typography, framing, pauses, vocal texture, and selective
  voice anchors from observation; do not expand to full voice production before
  the conversation rhythm holds.
- Test any future physical Ledger-writing interaction as a separate input and
  consequence slice rather than making the UI the source of story state.
