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
- Run `npm run check` before handing off a cross-cutting change.
