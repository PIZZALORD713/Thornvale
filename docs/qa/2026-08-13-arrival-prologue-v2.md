# The Path Remembers You — Arrival V2 QA

Date: 2026-08-13

Branch: `codex/path-remembers-you-v2`

Base: `71eddf05408c28c0d41a8e709100df0001aeba36`

## Slice under test

- Teach Look and Move by observing the player's real input, then offer Hint
  only after a crossroads stall or committed wrong turn.
- Keep desktop and touch copy device-aware without stacking a second Interact
  tutorial over the existing contextual prompt.
- Hide the snow-plane edge behind pines, brush, and drifts.
- Fold players who leave the reviewed arrival corridor back to one broken
  ochre-ribbon waypost without changing story state.

## Desktop browser evidence

URL: `?controls=desktop&story=reset`, clean save.

- `Mouse · Look into the storm` rendered in the second objective-grid row and
  was announced through the objective live region.
- Real mouse movement cleared Look at more than 20 degrees cumulative yaw;
  real `W` movement cleared `WASD · Follow your fresh prints` after 3 metres.
- Turning 180 degrees at spawn showed the pine boundary rather than a plane
  edge.
- At the crossroads, Hint was absent immediately and appeared after the
  authored stall as `H · Ask the wind`; pressing `H` revealed the live trail.
- One forced off-route fold activated the sky/fog whiteout, preserved yaw at
  `3.141592653589793`, returned the player to the waypost lane, and left the
  serialized session byte-for-byte unchanged.
- Contextual `Press E` prompts spoke to Lumen and took the lantern. The run
  crossed the gate with all six arrival events and ended in `day-routine` on
  the `sign-ledger` objective.
- Console: 0 errors, 0 warnings.

Screenshots:

- `.playwright-cli/page-2026-08-14T02-51-35-390Z.png`
- `.playwright-cli/page-2026-08-14T02-54-16-368Z.png`

## Touch browser evidence

Viewport: 390 × 844, URL: `?controls=touch&story=reset`, clean save.

- `Drag · Look into the storm` fit inside the objective; dragging the real look
  zone advanced to `Move · Follow your fresh prints`.
- The real joystick moved the player more than 3 metres and cleared Move.
- The persistent Hint button measured 72 × 66 px. It did not pulse immediately
  at the crossroads; after the stall it pulsed with `Hint · Ask the wind`, and
  tapping the actual button cleared the cue and emphasis.
- One forced off-route fold activated the sky/fog whiteout, preserved yaw at
  `3.7015926535897936`, returned the player to the waypost lane, and left the
  serialized session byte-for-byte unchanged.
- Contextual `Ask` and `Take` actions completed Lumen's welcome, the lantern,
  and the gate crossing. The run ended in `day-routine` on `sign-ledger`.
- Console: 0 errors, 0 warnings.

Screenshot:

- `.playwright-cli/page-2026-08-14T02-56-16-660Z.png`

## Automated evidence

- Focused tutorial, recovery, arrival-world, story UI, and touch tests: 30/30.
- Full `npm run check`: 388/388 tests, production build, and dist audit passed.
- Release asset audit: 10,066,308 B / 10,066,330 B.
- `git diff --check`: clean.

## Review corrections included

An independent clean-frame review caught and the final slice fixes: an
unmatched cue CSS selector, rear pines outside fog range, premature HUD Hint
copy, a missing late-cue live announcement, avoidable skirt shadow casters, and
a fold pulse that originally fogged the world but not the sky dome.
