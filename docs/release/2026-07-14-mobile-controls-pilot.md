# 2026-07-14 — Mobile controls production pilot

> Historical pilot deployment record. The mainline recovery and current release
> evidence are recorded in
> [`2026-07-15-mobile-controls-mainline.md`](2026-07-15-mobile-controls-mainline.md).

The historical deployment details below distinguish the initial touch-controls
pilot, the iPhone Safari app-mode follow-up, and the premium-control follow-up.
Physical Home Screen verification remained open as a device-support follow-up;
it is not a blocker to bounded mainline touch-input inclusion.

- Release type at the time: opt-in/auto-detected production pilot for physical-device testing
- Base commit: `a5842344a1aabc53934fbab3aa09b7c2ef5e5d9f`
- Deployment source: reviewed local working tree based on `a584234`; the exact
  candidate was preserved on `codex/mobile-controls-pilot` and remained off
  remote `main`
- Production alias at the time: `https://thornvale.vercel.app`
- Immutable URL: `https://thornvale-o4owhog1q-pizzalords-projects.vercel.app`
- Vercel deployment: `dpl_FeinBDMtj3bWD8FZyKRy3m28VSpx`, `Ready`

## iPhone Safari app-mode follow-up

- Source state: preserved on `codex/mobile-controls-pilot`
- Immutable URL: `https://thornvale-dzd5msr29-pizzalords-projects.vercel.app`
- Vercel deployment: `dpl_37kn5ejnUNz77WBdix9FD4gTqJwT`, `Ready`, production
- Final bundle/timestamp: `assets/index-DkXdKm05.js`, deployed 2026-07-14 at
  11:50 CDT
- Player-visible behavior: iPhone Safari rotation remains an ordinary browser
  tab rather than claiming unsupported automatic fullscreen. The touch entry
  card explains the Home Screen path, and the first in-play rotation shows one
  dismissible notice after any blocking story card closes.
- App shell: the web manifest uses standalone display mode and Apple web-app
  metadata; standalone launches suppress browser-tab guidance.
- Viewport lifecycle: dynamic viewport height plus animation-frame-coalesced
  `window` and `visualViewport` resize events update the renderer and dependent
  presentation surfaces.

## Premium-control follow-up

- Source state at the time: preserved on `codex/mobile-controls-pilot`; not
  promoted to remote `main`
- Immutable URL: `https://thornvale-pcx925ee6-pizzalords-projects.vercel.app`
- Vercel deployment: `dpl_4Gc886iaxgstiwr7z4afiGT17THb`, `Ready`, production
- Final bundle/timestamp: `assets/index-C63Ihp8y.js`, deployed 2026-07-14 at
  14:03 CDT
- Player-visible behavior: the default touch presentation used a quieter
  idle stick, vertical right-thumb action arc, inline glyphs, interaction-first
  placement, sprint/press/availability feedback, and an action moat that blocks
  accidental camera drags between controls.
- Rollback: `?controlsStyle=classic` restores the original horizontal treatment
  while keeping the same semantic movement, look, jump, and interaction path.
- Accessibility: reduced-motion removes control transitions; increased and
  forced contrast retain opaque surfaces and strong borders.

## Initial-pilot gates — before the app-mode follow-up

- `npm run check`: PASS, 224/224 tests and production dist
  8,376,925 / 8,388,608 bytes
- `npm run assets:release`: PASS
- `git diff --check`: PASS
- Production Draco fallback: original and transformed decoders both produced
  2,800 points / 4,800 faces from the bundled Steward body

## App-mode follow-up gates

- `node --test tests/mobile-display-mode.test.js tests/mobile-display-notice.test.js`:
  PASS as part of the integrated 232-test run; focused lifecycle coverage also
  passed during iteration
- `npm run check`: PASS, 232/232 tests and production dist
  8,383,230 / 8,388,608 bytes
- `npm run assets:release`: PASS
- `git diff --check`: PASS
- Immutable deployment and production alias at the time: PASS; alias served
  `assets/index-DkXdKm05.js`, Apple web-app metadata, and the manifest at
  `application/manifest+json`

## Premium-control follow-up gates

- Focused input/style regressions: PASS, 16/16
- `npm run check`: PASS, 237/237 tests and production dist
  8,388,595 / 8,388,608 bytes
- `npm run assets:release`: PASS with the fixed 8 MiB production cap unchanged
- `git diff --check`: PASS
- Local browser QA: PASS at 390x844 and 844x390 for alignment, separation,
  action moat, press state, reduced motion, forced colors, and classic rollback
- At-the-time live production QA: PASS for modern default and classic rollback; fresh
  sessions reported zero application warnings or errors

## Historical live routes checked

- `?controls=auto&quality=low&post=off&story=reset`: simulated iPhone
  capabilities selected touch and displayed the Tap entry path
- `?controls=touch&quality=low&post=off&story=reset`: entry, story blocking,
  simultaneous movement/look, outer-band sprint, Jump, cancellation, portrait,
  and landscape
- `?controls=touch&quality=low&post=off&story=off`: contextual Ledger action
- `?controls=desktop&quality=low&post=off&story=off`: touch hidden/inert,
  instructions visible, keyboard movement/sprint, and release to neutral
- `?controls=touch&controlsStyle=modern&quality=low&post=off&story=off`:
  premium default, icon visibility, vertical action layout, and center alignment
- `?controls=touch&controlsStyle=classic&quality=low&post=off&story=off`:
  original horizontal presentation rollback
- Live Apple touch browser emulation at 390x844 and 844x390: browser display
  mode exposed the install instruction, first rotation showed the one-time
  notice below the top HUD, and repeated rotation stayed dismissed
- Live standalone emulation at 390x844: display mode resolved to `standalone`,
  both browser-only hints stayed hidden, and body height matched the viewport

Fresh browser-tab and standalone-mode live sessions completed without
application warnings or errors.
One parallel Chromium session reported a player-body load timeout while four
browser sessions competed for resources; the fault did not reproduce in a
fresh single session.

## Remaining support gates

These checks govern broader device-support and performance claims; they do not
block the bounded touch-input pilot from being included on mainline.

- Remove any older Thornvale Home Screen shortcut before testing; it may retain
  the pre-manifest launch contract.
- In iPhone Safari, use **Share > Add to Home Screen**, enable **Open as Web
  App** if that control appears, add the shortcut, and launch from the new icon.
  Rotation inside the Safari tab cannot automatically enter fullscreen.
- Confirm the entry instruction and first in-play rotation notice in the Safari
  tab, then confirm both are absent in the Home Screen app.
- Complete the Core Hook on a representative iPhone in portrait and landscape
  from the Home Screen launch.
- Compare the modern default against `?controlsStyle=classic` on the physical
  iPhone for reach, missed taps, accidental look drags, and visual obstruction.
- Record whether the Home Screen app receives separate storage from Safari; a
  clean save there may be expected and must not be reported as corruption.
- Record frame time, thermal behavior, and memory before claiming mobile support.
- Keep historical comparisons paired with the immutable deployment and exact
  pilot candidate. Run current support checks against the newer mainline release
  recorded in the linked July 15 document.
