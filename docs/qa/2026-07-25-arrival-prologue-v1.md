# The Path Remembers You v1 — QA Evidence

Date: 2026-07-25

Branch: `codex/path-remembers-you-v1`

Base: `e95acb62838f052304cb8c9737c5023e7acb5b32`

## Automated gate

- `npm run check`
  - 374 tests passed.
  - Production build passed.
  - Runtime asset audit passed.
  - Production dist measured 10,051,169 B / 10,066,330 B.
- Focused regressions cover:
  - all three durable `arrival_posture` choices,
  - the atomic lantern → gate → delayed-letter → Day One handoff,
  - reviewed whiteout Hint routing,
  - matching left-heel tread projection,
  - desktop/touch semantic Hint input,
  - three-choice keyboard selection and touch reflow,
  - late-installed day/night fog restoration.

## Desktop browser

Viewport: 1200 × 920, forced `controls=desktop`, clean save.

- Opening card states the three trusted memories.
- Whiteout narrows the town while leaving the crossroads readable.
- `H` makes `ObjectiveHintTrail.active === true`, reveals the remembered prints, and reports the matching missing triangle in the left heel.
- Lumen’s two welcome beats render before the three relationship choices.
- Selected `hidden-structure`; session stored `choices.arrival_posture = "hidden-structure"`.
- Lantern objective and threshold objective advanced in order.
- The self-written letter appeared only at the threshold.
- Final runtime state:
  - `phase = "day-routine"`
  - objective `sign-ledger`
  - arrival layer hidden
  - canonical fog restored to near 34 / far 96
- Browser console: 0 errors, 0 warnings.

Screenshots:

- `output/playwright/arrival-desktop-hint.png`
- `output/playwright/arrival-desktop-choice.png`
- `output/playwright/arrival-desktop-delayed-letter.png`
- `output/playwright/arrival-desktop-day-one-handoff.png`

## Touch browser

Viewport: 390 × 844, forced `controls=touch`, clean save.

- Touch control mode resolved as `touch`.
- At `follow-remembered-path`, the actual **Hint** button was visible, enabled, labeled **Hint**, and activated the same trail/footprint reveal as desktop.
- All three relationship buttons measured 336 × 66 px and fit fully inside the viewport.
- Completed one run with `notice-care` and a second with `personal-truth`; both reached the same offer of warmth and the Day One handoff.
- Final runtime state:
  - objective `sign-ledger`
  - arrival layer hidden
  - canonical fog restored to near 34 / far 96
  - story layer `aria-hidden="true"`
- Browser console: 0 errors, 0 warnings.

Screenshots:

- `output/playwright/arrival-touch-hint.png`
- `output/playwright/arrival-touch-choice.png`
- `output/playwright/arrival-touch-day-one-handoff.png`

## Findings fixed during visual QA

1. The town remained too legible behind the snow layer. Added temporary whiteout fog with exact canonical fog restoration after the gate.
2. Day/night fog is installed after `ArrivalWorld`; added lazy baseline capture and a regression for that actual initialization order.
3. Hiding touch keyboard badges collapsed choice copy into the 30 px badge column. Touch choices now use a dedicated copy + arrow grid, keeping all three options readable.

## Open playtest gate

This verifies implementation and presentation, not fresh-player comprehension. The next evidence should be five uncoached runs measuring completion time, first stall, Hint interpretation, footprint-notice rate, Lumen read, and desire for another conversation.
