# 2026-07-15 — Mobile controls mainline recovery QA

## Scope and invariant

- Candidate: `codex/mobile-controls-main` rebased from `main` at `ca286c6`
- Recovery source: `f87d972` plus the bounded production-only Draco transform
  from `b8e32a5`
- Player-facing beat: complete the existing Ledger-first Day One and second-Bell
  route with move, look, sprint, Jump, Interact, and camera Skip available on a
  touch device.
- Invariant: desktop and touch produce the same semantic movement, look, held
  action, and exact-once action edges; blocking and terminal lifecycle paths
  always return touch state to neutral.
- Scope boundary: this promotes a tested input path. It does not claim reference-
  phone frame-time, thermal, memory, browser-chrome, or full mobile support.

## Fail-before evidence

- Current `main` failed the recovered semantic input regression because
  `InputManager` had no external movement, look, or action-source contract.
- Rebased keyboard `E` could leave both a physical edge and a semantic Interact
  edge when skipping the second-Bell focus shot. The added inverse-consumption
  regression failed before the fix and now proves either consumer clears both.
- The first integrated build passed all behavior tests but failed the fixed
  deployment cap at `8,403,916 / 8,388,608` bytes. The production-only Draco
  transform recovered 24,727 bytes in the final build without changing checked-
  in decoder files, runtime URLs, or decoded geometry.

## Automated evidence

| Check | Result |
| --- | --- |
| Focused input, touch, interaction, camera, movement, and Draco tests | PASS |
| `npm run check` | PASS — 255/255 tests, production build, dist audit |
| Production artifact | PASS — `8,379,189 / 8,388,608` bytes |
| Draco fallback equivalence | PASS — 2,800 points / 4,800 faces before and after transform |
| `npm run assets:release` | PASS |
| `git diff --check` | PASS |

Built application asset during candidate QA: `assets/index-CNX6_PYE.js`.

## Exact-build browser evidence

The production `dist/` was served locally and tested with Playwright Chromium.
Generated screenshots remained under ignored `.playwright-cli/` output.

| Route or condition | Result | Evidence |
| --- | --- | --- |
| Modern portrait, 390x844 | PASS | Controls fit safe edges; touch entry, objective, HUD, Ledger name card, movement, and Jump remained readable |
| Modern landscape, 844x390 | PASS | Move zone `18..126`, look zone `354.48..844`, and Jump `756..816` stayed inside the viewport |
| Simultaneous move/look | PASS | Player moved from x `0.012` to `2.362` while the camera quaternion changed; cancellation returned movement to zero |
| Outer-band sprint and resize | PASS | Sprint armed at movement magnitude `0.966`; landscape resize cleared movement and sprint |
| Story blocking | PASS | Opening letter, Lumen dialogue, and Ledger signing removed touch controls from the interactive tree and restored them afterward |
| Current Ledger flow | PASS | Touch spoke with Lumen, exposed the early Ledger action, entered `Aster`, and reached the recorded-chores objective |
| Pass-out recovery | PASS | Armed touch movement/sprint became zero/false and the surface hidden/inert during recovery; it returned enabled and neutral at the gate |
| Second-Bell Skip | PASS | Active focus exposed enabled `Skip`; one touch restored the camera, revealed once, unlocked controls, and left no stale Interact edge |
| Reduced motion | PASS | Control transition durations were `0s`; Bell reveal ran directly with one reveal, no focus shot, and no retained lock |
| Classic rollback | PASS | `?controlsStyle=classic` selected classic markup/layout while preserving touch semantics |
| Desktop rollback | PASS | `?controls=desktop` hid touch, retained the instruction panel, and keyboard `W` moved the player despite embedded pointer-lock denial |
| Auto-detected Apple touch | PASS | Five touch points plus coarse pointer selected touch; browser-mode Home Screen hint and first-rotation notice appeared; body height equaled `844`px viewport height |
| Fresh single-session console | PASS | Bundled player `#6602` loaded with zero warnings and zero errors |

Four concurrent Chromium sessions caused one character-body timeout. After the
other sessions closed, the same auto-detected route loaded `#6602` cleanly and
the timeout did not reproduce. This remains resource-contention evidence, not a
single-session mobile fault.

## Human gate

The project owner previously reported the pilot working well on mobile and
authorized its mainline return. The safest current-build confirmation is one
clean representative-iPhone run:

1. Remove any older Home Screen shortcut, open the current production build in
   Safari, then add and launch it again as a web app.
2. Sign the early Ledger entry and confirm the software keyboard leaves both the
   name line and Sign action reachable.
3. Move and look together, perform one chore, then pass out while holding the
   movement stick; recovery must return neutral at the front gate.
4. Complete the Bell return route once normally and once using touch Skip.
5. Rotate portrait/landscape and compare modern with `?controlsStyle=classic`
   for reach, missed taps, accidental look drags, obstruction, frame pacing,
   heat, and memory.

Desktop Chromium keyboard/mouse remains the support baseline until that
reference-device evidence is recorded.
