# The Path Remembers You — Mobile Hint and Scale QA

Date: 2026-08-04

Branch: `codex/path-remembers-you-v1`

Base: `e95acb62838f052304cb8c9737c5023e7acb5b32`

## Correction under test

- Keep a labeled **Hint** control in a stable touch-action slot.
- Make the arrival feel remote before the crossroads rather than placing the
  player a few steps from town.
- Let Hint reveal direction without solving the entire whiteout in one press.

## Geometry and guidance contract

- Reviewed spawn-to-gate route: 75.63 metres.
- Winding approach before the crossroads: 29.91 metres.
- Remembered route from crossroads toward Lumen: 38.72 metres.
- Plausible dead-end fork: 23.81 metres.
- Temporary snow field: 54 × 60 metres; whiteout fog near/far: 2.8 / 14.5.
- Arrival Hint: four-second, high-contrast whiteout palette bounded to the next
  12 metres. Normal town guidance retains its canonical palette and 24-metre
  range.

## Phone browser evidence

Viewport: 390 × 844, forced `controls=touch`, clean save.

- The actual touch joystick moved the player from the remote spawn through the
  winding approach and triggered the crossroads objective without keyboard
  input.
- **Hint** remained visible in the right-thumb action stack, measured 72 × 66 px,
  was the topmost hit target at its centre, and became enabled for the current
  objective.
- Tapping **Hint** set `ObjectiveHintTrail.active === true`, selected the
  `whiteout` palette, revealed remembered footprints, and produced a route
  exactly 12 metres long.
- Browser console: 0 errors, 0 warnings.

Screenshot:

- `.playwright-cli/page-2026-08-04T07-18-27-670Z.png`

## Automated evidence

- Focused arrival, route, wind-trail, and touch regressions: 46 passed.
- Full `npm run check`: 375 tests passed, production build passed, runtime
  asset audit passed.
- Production artifact: 10,055,539 B / 10,066,330 B.
- Desktop clean-save run: `H` activated the same whiteout cue for the
  `arrival-crossroads` objective; browser console had 0 errors and 0 warnings.
- Live-preview checks are recorded with the eventual pull request and Vercel
  deployment.

## Remaining human playtest question

Does the extra distance create the intended uncertainty, or does the winding
approach now feel like travel time before the relationship scene? Adjust route
length and landmark density before adding any new tutorial mechanic.
