# Mobile Controls Pilot QA — 2026-07-14

> Historical pilot evidence. The recovery onto the Ledger-first, shelter-
> recovery, corrected-spit, second-Bell mainline is recorded in
> [`2026-07-15-mobile-controls-mainline.md`](2026-07-15-mobile-controls-mainline.md).

## Candidate status

**At the time of the July 14 deployments, the touch pilot, iPhone Safari
app-mode follow-up, and premium-control pass had cleared their automated release
gates and were served from the production alias for device testing.** Browser
emulation verified the Safari-tab guidance, first-rotation notice, dynamic
viewport sizing, premium and classic layouts, and standalone suppression. A
physical-iPhone Home Screen launch and full Core Hook run remained pending.

This pilot adds an input path, not a mobile performance or support commitment.
Plan 2.0 mobile parity remains out of scope, and desktop keyboard/mouse is the
supported baseline.

## Initial production deployment — before the app-mode follow-up

- Production alias at the time: `https://thornvale.vercel.app`
- Immutable deployment: `https://thornvale-o4owhog1q-pizzalords-projects.vercel.app`
- Vercel deployment: `dpl_FeinBDMtj3bWD8FZyKRy3m28VSpx`, `Ready`, production
- Deployed: 2026-07-14 at 10:55 CDT from local `main` based on `a584234`
- Source status at the time: the mobile-control candidate was preserved on the
  dedicated `codex/mobile-controls-pilot` branch from base `a584234` and was not
  promoted to remote `main`. Later Git-triggered production deployments have
  replaced this manual pilot on the mutable production alias.

### App-mode follow-up deployment

- Target: the existing production alias above
- Immutable deployment: `https://thornvale-dzd5msr29-pizzalords-projects.vercel.app`
- Vercel deployment: `dpl_37kn5ejnUNz77WBdix9FD4gTqJwT`, `Ready`, production
- Deployed: 2026-07-14 at 11:50 CDT; production serves
  `assets/index-DkXdKm05.js`

### Premium-control follow-up deployment

- Target: `https://thornvale.vercel.app`
- Immutable deployment: `https://thornvale-pcx925ee6-pizzalords-projects.vercel.app`
- Vercel deployment: `dpl_4Gc886iaxgstiwr7z4afiGT17THb`, `Ready`, production
- Deployed: 2026-07-14 at 14:03 CDT; production serves
  `assets/index-C63Ihp8y.js`

## iPhone Safari app-mode contract

iPhone Safari cannot automatically enter element fullscreen when the device
rotates. Rotation is not a user fullscreen gesture, so the candidate does not
pretend that browser chrome can be removed from an ordinary Safari tab.
Instead, it provides the supported Home Screen web-app path:

- `manifest.webmanifest` declares `display: standalone`, while Apple standalone
  and translucent-status-bar metadata preserve compatibility with iPhone Home
  Screen launches.
- Eligible Apple touch sessions in a browser tab receive a compact instruction
  on the entry card. The first in-play rotation also shows one dismissible
  notice per page session; the notice waits until blocking story UI closes.
- Standalone launches suppress both browser-tab instructions.
- The page uses dynamic viewport height, and both `window.resize` and
  `visualViewport.resize` schedule the same animation-frame resize path.
- A Home Screen web app may receive storage separate from the Safari tab. A
  missing tab save after launching from the icon is therefore not evidence of
  save corruption; use a clean run for the physical gate.

## Runtime contracts

| Surface | Pilot contract |
| --- | --- |
| Selection | `?controls=touch`, `?controls=desktop`, and `?controls=auto`; auto requires `maxTouchPoints > 0` and `(pointer: coarse)` |
| Touch presentation | Premium vertical action arc is the default; `?controlsStyle=classic` restores the original fixed row without changing semantic input |
| Movement | Independent left analog pointer with a dead zone and outer-band sprint |
| Camera | Independent right-side drag pointer; move and look may operate simultaneously |
| Actions | Jump emits an exact-once press plus held state; contextual Interact emits an exact-once press when available |
| Story/UI blocking | Blocking story or modal state disables the touch surface and clears the touch input source |
| Cancellation | Pointer cancel/lost capture, blur, visibility change, resize/orientation, disable, and disposal return touch input to neutral |
| iPhone browser tab | Entry guidance and the first in-play rotation notice explain that rotation cannot remove Safari chrome |
| iPhone Home Screen app | Manifest/Apple standalone mode removes Safari's URL and button bars; the iOS status area may remain |
| Viewport lifecycle | `100dvh`, `window.resize`, and `visualViewport.resize` keep rendering aligned with the available viewport |
| Desktop | Keyboard, mouse look, pointer lock, sprint, jump, and interact remain unchanged |

## Automated verification

| Check | Result | Evidence |
| --- | --- | --- |
| Input source aggregation and exact-once actions | PASS | `node --test tests/input-manager.test.js` |
| Touch mode, simultaneous pointers, cancellation, and controls | PASS | `node --test tests/touch-controls.test.js` |
| Semantic interaction consumption | PASS | `node --test tests/interactable-system.test.js` |
| Movement regression coverage | PASS | `node --test tests/character-movement.test.js` |
| Production Draco fallback equivalence | PASS | The checked-in and production-compressed decoders both decode the bundled Steward body to 2,800 points / 4,800 faces; the transform recovers at least 20 KiB without modifying the source decoder |
| Initial-pilot integrated tests and production build | PASS — pre-follow-up baseline | `npm run check`: 224/224 tests, Vite build, and dist audit passed at 8,376,925 / 8,388,608 bytes before the app-mode follow-up |
| Initial-pilot strict asset release audit | PASS — pre-follow-up baseline | `npm run assets:release`: provenance, integrity, dependency, and production-dist gates passed before the app-mode follow-up |
| Display-mode, manifest, and Apple-platform contract | PASS | `tests/mobile-display-mode.test.js`, included in the 232-test integrated run |
| First-rotation notice lifecycle | PASS | `tests/mobile-display-notice.test.js`, including story deferral, exact-once presentation, dismissal, suppression, and disposal |
| App-mode follow-up integrated tests and production build | PASS | `npm run check`: 232/232 tests, Vite build, and dist audit at 8,383,230 / 8,388,608 bytes |
| App-mode follow-up strict asset release audit | PASS | `npm run assets:release`: provenance, integrity, dependency, and production-dist gates passed |
| Premium-control state and presentation contract | PASS | `tests/touch-control-style.test.js`: modern-safe resolution, classic rollback, themed SVG markup, vertical ordering, reduced motion, contrast, runtime state projection, and terminal clearing |
| Premium-control integrated tests and production build | PASS | `npm run check`: 237/237 tests, Vite build, and dist audit at 8,388,595 / 8,388,608 bytes |
| Premium-control strict asset release audit | PASS | `npm run assets:release`: provenance, integrity, dependency, and fixed production-dist gates passed |
| Whitespace and patch integrity | PASS | `git diff --check` |

## Browser smoke matrix

Use `?controls=touch` for deterministic touch presentation and
`?controls=desktop` for the regression path. Record viewport, browser/device,
console state, and observed result for every completed row.

| Check | Result | Notes |
| --- | --- | --- |
| Auto selection on coarse touch hardware | PASS | Chromium init override with five touch points plus coarse pointer selected `touch` in auto mode |
| Explicit selector overrides | PASS | `?controls=touch` and `?controls=desktop` selected their requested presentations |
| Touch entry | PASS | Entry at 390x844 hid the gate, exposed touch controls, and kept pointer lock false |
| Portrait layout | PASS | Chromium 390x844; move pad and Jump stayed inside safe-area edges without covering the story card |
| Narrow portrait layout | PASS | Chromium 320x568 with contextual action visible; the move pad ended at x 122 and the action region began at x 144.19 with no overlap |
| Landscape layout | PASS | Chromium 844x390; move and Jump remained reachable; contextual action also fit at 1280x720 |
| Premium portrait geometry | PASS | Chromium 390x844; movement and Jump centers differed by 0–1px, while Interact sat above/inward with a 12px gap and no overlap |
| Premium landscape geometry | PASS | Chromium 844x390; movement and Jump centers differed by 4px, while Interact retained a 10px gap and no overlap |
| Premium action moat | PASS | The transparent right-thumb action region catches near misses above the camera-drag surface and remains disjoint from the movement region |
| Premium accessibility variants | PASS | Reduced motion removed stick, knob, and action transitions; forced colors produced full opacity and 2px system-color borders |
| Classic presentation rollback | PASS | `?controlsStyle=classic` removed the premium class, restored the horizontal row and text labels, and hid the SVG glyphs |
| Simultaneous movement and look | PASS | Independent synthetic pointer IDs moved the player from x 0.06 to 1.67 while changing camera quaternion |
| Outer-band sprint | PASS | Full-radius movement reported x 1 and sprint held; pointer cancellation returned both to neutral |
| Jump edge and hold | PASS | Touch jump raised player y from 0.91 to 1.88; pointer-up cleared held state |
| Accessible Jump activation | PASS | Keyboard/assistive-style programmatic activation at 320x568 raised player y from 0.905 to 1.711 without emitting a duplicate touch edge |
| Contextual interaction | PASS | Ledger proximity exposed an accessible full prompt with compact `Read` label; one click committed the authored status |
| Story blocking | PASS | The opening letter removed touch controls from the interactive tree; `Fold the letter` restored them |
| Cancellation and lifecycle clearing | PASS | Browser pointer-cancel plus deterministic lost-capture, blur, hidden, resize, orientation, pagehide, disable, and disposal tests |
| Desktop regression | PASS WITH LIMITATION | Desktop override kept touch hidden and instructions visible; embedded Chromium denied pointer lock, so the existing automated lifecycle test covers lock success while browser fallback was verified |
| Console | PASS | No application warnings or errors in touch, story-blocking, interaction, or desktop sessions |

## Historical live production verification

| Check | Result | Evidence |
| --- | --- | --- |
| Deployment arrival | PASS | Production serves `index-CcQ-bmG3.js`, the touch root, and the touch-aware entry path instead of the previous `index-D1YyQTR0.js` bundle |
| iPhone capability selection | PASS | At 390x844 with five touch points and a coarse pointer, `?controls=auto` selected `touch`, showed `Tap to begin`, and kept pointer lock false |
| Story blocking | PASS | The opening letter removed controls from the interactive tree; `Fold the letter` restored Move, look, and Jump |
| Simultaneous move/look | PASS | At 390x844 the player moved from x 0.004 to 5.586 while the camera quaternion changed; outer-pad sprint engaged and pointer cancellation returned movement and sprint to neutral |
| Jump | PASS | Touch pointer input raised player y from 0.922 to 2.324; pointer-up cleared the held state |
| Context action | PASS | At the Ledger the full accessible label and compact `Read` label were enabled; one activation produced `The Ledger warms at your touch. Kindness remembered.` |
| Rotation lifecycle | PASS | Active movement at 0.948 plus sprint cleared to zero/false on 844x390 resize; move and action regions remained inside the viewport without overlap and portrait restoration stayed neutral |
| Desktop rollback | PASS WITH LIMITATION | `?controls=desktop` kept touch hidden/inert and desktop instructions visible; W+Shift moved from z 13.954 to 10.846 and key-up returned input to neutral. Embedded Chromium denied pointer lock, while its existing lifecycle regression covers the success path |
| Live console | PASS | Fresh single-session touch, auto, interaction, and desktop checks had zero application errors or warnings. One of four concurrently running Chromium sessions timed out loading the player body; it did not reproduce after closing the extra sessions |

During the app-mode deployment, browser emulation verified the web contract.
The rows that depend on Safari chrome or an installed Home Screen app remained
open as support-quality follow-ups for a representative iPhone:

| App-mode follow-up check | Result | Evidence |
| --- | --- | --- |
| Safari-tab entry guidance | PASS IN LIVE EMULATION; PHYSICAL CONFIRMATION PENDING | Live 390x844 Apple touch browser mode selected `touch`, exposed the Home Screen instruction, and resolved `displayMode=browser` |
| First in-play rotation notice | PASS IN LIVE EMULATION; PHYSICAL CONFIRMATION PENDING | Live 844x390 rotation showed one reachable notice at y=76 with no status/day overlap; dismissal survived repeated rotation. Deterministic tests cover story-card deferral |
| Dynamic viewport recovery | PASS IN LIVE EMULATION; SAFARI-CHROME CHECK PENDING | Live portrait/landscape checks kept `body` height equal to `innerHeight`; physical Safari must confirm expand/collapse behavior |
| Home Screen launch | PENDING | Remove the old shortcut, reinstall as a web app, launch from the icon, and confirm Safari URL/button bars and both browser-tab hints are absent |
| Standalone clean-save route | PENDING | Record whether iOS provides separate storage, then complete the run from the state actually presented by the Home Screen app |
| App-mode live console | PASS IN LIVE EMULATION; PHYSICAL CONFIRMATION PENDING | Fresh live browser and standalone-mode sessions each reported zero application warnings or errors |

The premium-control deployment also received this at-the-time verification:

| Premium follow-up check | Result | Evidence |
| --- | --- | --- |
| Default presentation | PASS | Live 390x844 touch route resolved `controlsStyle=modern`, displayed the vertical icon treatment, and aligned movement and Jump centers exactly |
| Classic rollback | PASS | Live `?controlsStyle=classic` removed the modern class, restored the horizontal action row and Jump text, and hid premium glyphs |
| Live bundle and alias | PASS | At the time of verification, the production alias and immutable deployment served `assets/index-C63Ihp8y.js`; deployment `dpl_4Gc886iaxgstiwr7z4afiGT17THb` was Ready |
| Premium live console | PASS | Fresh modern and classic production sessions reported zero application warnings or errors |

## Remaining support gates

These checks inform device support, performance claims, and later touch tuning;
they are not blockers to including the bounded touch-input pilot on mainline.

- On the representative iPhone, first remove any old Thornvale Home Screen
  shortcut so cached pre-manifest behavior cannot satisfy the gate accidentally.
- In Safari, open the candidate, choose **Share > Add to Home Screen**, enable
  **Open as Web App** if iOS shows that option, add it, and launch Thornvale from
  the new icon. Rotating the still-open Safari tab is not the fullscreen path.
- Play the full Core Hook in the Home Screen app in portrait and landscape
  before making a broader mobile-support claim. Treat the Home Screen app as a
  clean save if iOS does not expose the Safari-tab storage.
- On the physical iPhone, compare modern and `?controlsStyle=classic` for thumb
  reach, accidental camera drags, simultaneous move/look comfort, and action
  readability before treating the modern presentation as validated phone UX.
- Measure reference-device frame time, thermal behavior, and memory separately
  before making any mobile performance or support claim.
- Keep historical pilot comparisons pinned to the recorded immutable deployment
  and exact `codex/mobile-controls-pilot` candidate. Run current support checks
  against the newer mainline release recorded in the linked July 15 document.
