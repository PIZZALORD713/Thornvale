# Stewardship Interactions v1 QA

- Date: 2026-07-20
- Branch: `codex/global-inventory-wood-fishing-v1`
- Scope: global state, canonical axe and `hand:Guess` fishing pole, three
  authored harvest trees, one planting patch, simple-rod fishing, desktop/touch
  semantic interaction input

## Automated evidence

- `npm run check` passed: 360 tests, production Vite build, and dist asset audit.
- `npm run assets:release` passed.
- Canonical axe: 146,792 bytes, SHA-256
  `866cef9aec2a8817983e150f38e8634990c9038864d6a69fad67c5c26c4c98ba`.
- Canonical `hand:Guess` pole: 368,156 bytes, SHA-256
  `f7fd184057ea34c3a2a0b3ee0c0f5f5a2acfa978182ecd73758eb2b65b91b1b1`.
- Geometry coverage proves the pole's rigid frame-zero skin is baked into
  centered static equipment before normalization; this regression was added
  after headed QA caught a successfully loaded but off-anchor skinned mesh.
- Fishing state-machine coverage passes at 60, 120, and 144 Hz, including false
  nibbles, missed hook, line break, tension recovery, landing, and exact-once
  specimen rewards.
- Tree coverage verifies three committed contacts, independent authored trees,
  exact-once rewards, stump rejection, and seed consumption at planting.
- Each committed tree strike spends the established Day One chop labor cost;
  an under-energy attempt leaves the tree untouched and uses the existing
  retained-inventory clinic recovery transaction.
- Completed Day One accounts now remain historical while later wood and fish
  continue updating lifetime activity totals. Impossible authored/player tree
  stages and counters reject transactions or reset invalid persisted saves.
- Projection coverage proves an initially restored stump appears immediately,
  while a live mature-to-stump change retains the authored fall.
- Axe loader coverage proves both canonical pickup/action views and a local
  forced-failure path that keeps both procedural views and every interaction
  anchor available.

## Real-browser acceptance

Run against the Vite development server with deterministic touch controls.

- Clean boot reached the welcome screen with zero console errors.
- Runtime axe loader reported `canonical`; three authored tree visuals were
  present.
- Axe pickup owned/equipped the tool and hid the world pickup.
- Three strikes progressed `1 -> 2 -> 3`, with only the third felling the tree.
- A fourth strike was rejected. State and projection agreed on one stump, six
  wood, one felled-tree total, and a stump collider.
- Planting consumed the dropped seed and created one visible persistent
  `seedling` at `planting.grove.01`.
- Reload without the reset query restored the owned axe, stump, six wood, and
  planted tree.
- Fishing reached `bite -> struggle -> landing -> landed`; the HUD exposed
  tension and shore progress, movement unlocked at completion, and one 18 cm
  ordinary pond dace persisted as `catch-0001`.
- A desktop usability replay exposed the complete four-step guide before the
  first nibble. The decoy phase said not to press, an intentional early hook
  returned a `false-nibble-hook` outcome plus the specific "too soon" lesson,
  live tension switched the current cue from `HOLD E` to `RELEASE E` before
  red, and the landed frame confirmed the catch in inventory.
- A touch-mode replay used `TAP ACTION` and `HOLD / RELEASE ACTION` throughout;
  the visible interaction button was labelled `Wait` during the opening phase.
- Clean canonical browser console error count remained zero.
- The canonical pole loader reported `canonical`; the gold grip, coiled line,
  blue lure, and live white cast line all rendered at the authored pond while
  the four-step guide remained readable.
- A forced failure of `/friendsies/tools/fishing-pole-v1.glb` reported the one
  expected failed request and local warning, retained the procedural rod, and
  still started active fishing with the same bobber, guide, input, and pond
  anchor. No unrelated or unhandled application error appeared.
- A forced failure of `/friendsies/tools/axe-v1.glb` produced only the expected
  failed request and local warning, retained both procedural Axe views, still
  collected/equipped the tool, and committed a first tree strike. State moved
  to one hit while energy changed `82 -> 66` and nourishment `72 -> 66`.

## Visual observations

- The stump, usable-log pile, and replacement seedling read together from the
  western camp clearing.
- Direct player feedback found the original compact prompt insufficiently
  self-explanatory even though the mechanic worked. The revised presentation
  keeps all four rules visible, highlights only the current step, and pairs the
  two meters with an imperative instruction and a plain-language explanation.
- Canonical `hand:Guess` gives the pond a recognizable, characterful fishing
  silhouette without moving gameplay authority into the asset. Its built-in
  dark line and lure read as stowed tackle; the live cast remains a separate
  pale line to the bobber.
- A new independent fresh-player session and reduced-motion feel check are
  still required for subjective acceptance; automation proves the corrected
  teaching states and projection, not that the comprehension target is met.
