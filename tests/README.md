# Test Ownership

`npm test` uses Node's recursive test discovery. Existing cross-module and
feature-contract tests remain directly in this directory; focused module tests
may live in a named category such as `tests/unit/`. Add a category only with a
real suite, not as an empty placeholder.

Ownership here means the code area responsible for keeping a contract covered,
not a specific person.

| Category | Current coverage | Primary code area | Change obligation |
| --- | --- | --- | --- |
| Story and session state | `core-hook-session.test.js` | `src/game/`, `src/content/` | Update for phase, persistence, choice, or ending contract changes |
| Day One activity state | `day-one-loop.test.js` | `src/game/DayOneDirector.js`, `src/game/GameSession.js`, `src/content/day-one-v01.js` | Cover costs, yields, activity order, completion, pass-out recovery, and migration changes |
| Day One action timing | `day-one-action-controller.test.js`, `day-one-action-presenter.test.js`, `interactable-system.test.js` | `src/game/DayOneActionController.js`, `src/visuals/DayOneActionPresenter.js`, `src/game/InteractableSystem.js` | Preserve exact-once contact commits, no overlap, terminal cancellation, normal/reduced behavior, and presentation-failure isolation |
| Day One projection | `day-one-world.test.js`, `hud-survival.test.js` | `src/visuals/DayOneWorld.js`, `src/ui/HUD.js`, `src/config/town.js` | Keep authoritative state out of presentation and cover visible, accessible projections |
| Town ground presentation | `town-path-presentation.test.js`, `breathing-grass.test.js` | `src/visuals/CozyTownKit.js`, `src/visuals/BreathingGrass.js`, `src/config/town.js` | Preserve distinct route profiles, local grass masks, batched drawables, and stable flat-surface depth tiers in pilot and baseline variants |
| Input and touch controls | `input-manager.test.js`, `touch-controls.test.js`, `touch-control-style.test.js`, `interactable-system.test.js` | `src/core/InputManager.js`, `src/ui/TouchControls.js`, `src/config/controls.js`, input consumers | Preserve source aggregation, simultaneous move/look, exact-once action edges, contextual interaction, device/style overrides, premium/classic presentation, accessible variants, projected held state, and neutral state after cancellation, blocking, disable, or teardown |
| Mobile app display mode | `mobile-display-mode.test.js`, `mobile-display-notice.test.js` | `src/config/display-mode.js`, `src/ui/MobileDisplayNotice.js`, `src/main.js`, `index.html`, `public/manifest.webmanifest` | Preserve Apple touch/browser eligibility, standalone suppression, entry guidance, first-rotation exact-once behavior, story-blocking deferral, manifest metadata, viewport lifecycle, and disposal |
| Movement and physics | `character-movement.test.js` | `src/controllers/`, `src/physics/`, `src/core/` | Add a regression for grounding, collision, movement-state, or controller changes |
| Camera constraints | `unit/camera-rig.test.js` | `src/game/camera/`, `src/config/`, world collision surfaces | Cover pitch, reset, smoothing, floor-clearance, and collision-policy changes |
| Character presentation | `visual-rig.test.js`, `friendsies-animation.test.js`, `friendsies-cast.test.js`, `friendsies-metadata-range.test.js`, `player-character-config.test.js`, `character-cast-fallback.test.js` | `src/visuals/`, `src/config/`, `src/app/` | Cover model normalization, URL/token selection, exact remote metadata lookup, animation selection, transition, and independent fallback changes |
| Story animation assets | `story-actions-assets.test.js` plus `npm run animations:verify` | `assets-src/friendsies-animations/`, `public/animations/story-actions-v1/`, `scripts/build-story-actions-v1.mjs`, `scripts/convert-friendsies-animation.py` | Keep source/toolchain pins, runtime and manifest hashes, canonical targets, 30 Hz endpoint/root policy, animation-only payload, and semantic IDs aligned |
| Story world presentation | `story-world.test.js` | `src/visuals/`, `src/game/` | Cover route visibility and world-state projection changes |
| Browser journey | Manual; see `docs/qa/` | Composition across `src/` | Smoke-test rendering, input, camera, audio, Story Actions normal/reduced/failure behavior and contact cues, the complete Day One loop, pass-out recovery, and the full Core Hook |

## Test rules

- Prefer a focused regression that fails before a bug fix and passes afterward.
- Keep tests deterministic and independent of remote assets or network access.
- Test authoritative state separately from visual projection when possible.
- Keep browser-only behavior in a documented smoke pass until a browser runner
  is deliberately added.
- For touch-control changes, use `?controls=touch` for deterministic browser
  coverage and verify portrait and landscape layouts, simultaneous move/look,
  story blocking, cancellation/blur/visibility/resize clearing, and the
  unchanged `?controls=desktop` pointer-lock path. Also verify pass-out recovery
  cannot retain held input and the second-Bell fly-to exposes one exact-once
  touch Skip action. Record current mainline evidence in
  `docs/qa/2026-07-15-mobile-controls-mainline.md`.
- For touch presentation changes, verify the modern default and
  `?controlsStyle=classic`, movement/Jump center alignment, contextual-action
  separation, the action moat, pressed state, reduced motion, and forced
  colors. Presentation selectors must not fork semantic input behavior.
- Browser emulation can cover display-mode selection, manifest markup, notice
  lifecycle, and viewport resize wiring, but it cannot prove the iPhone Home
  Screen launch. For that gate, remove the old shortcut, use **Share > Add to
  Home Screen**, enable **Open as Web App** if shown, launch from the new icon,
  and verify browser-tab guidance is absent. Record separate-storage behavior
  instead of assuming the Safari-tab save transfers.
- Run `npm run check` before handing off a cross-cutting change.
