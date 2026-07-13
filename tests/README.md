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
| Movement and physics | `character-movement.test.js` | `src/controllers/`, `src/physics/`, `src/core/` | Add a regression for grounding, collision, movement-state, or controller changes |
| Camera constraints | `unit/camera-rig.test.js` | `src/game/camera/`, `src/config/`, world collision surfaces | Cover pitch, reset, smoothing, floor-clearance, and collision-policy changes |
| Character presentation | `visual-rig.test.js`, `friendsies-animation.test.js`, `friendsies-cast.test.js`, `friendsies-metadata-range.test.js`, `player-character-config.test.js`, `character-cast-fallback.test.js` | `src/visuals/`, `src/config/`, `src/app/` | Cover model normalization, URL/token selection, exact remote metadata lookup, animation selection, transition, and independent fallback changes |
| Story world presentation | `story-world.test.js` | `src/visuals/`, `src/game/` | Cover route visibility and world-state projection changes |
| Browser journey | Manual; see `docs/qa/` | Composition across `src/` | Smoke-test rendering, input, camera, audio, and the full Core Hook |

## Test rules

- Prefer a focused regression that fails before a bug fix and passes afterward.
- Keep tests deterministic and independent of remote assets or network access.
- Test authoritative state separately from visual projection when possible.
- Keep browser-only behavior in a documented smoke pass until a browser runner
  is deliberately added.
- Run `npm run check` before handing off a cross-cutting change.
