# Runtime Architecture

Thornvale is a static Vite application. `src/main.js` is the composition root:
it creates the renderer and scene, wires the gameplay and presentation systems,
and owns the frame loop. Static runtime assets are served from `public/`.

## Runtime flow

```text
index.html
  -> src/main.js
      -> core + input
      -> config + feature tuning
      -> physics + player controllers
      -> content + game state/systems
      -> visuals + audio + UI
      -> render/update loop
```

## Current control flow

`src/main.js` resolves `?controls=touch|desktop|auto` during composition. Auto
mode selects touch only when `navigator.maxTouchPoints` is greater than zero
and `(pointer: coarse)` matches; the explicit selectors keep QA deterministic.
It separately resolves `?controlsStyle=modern|classic`; modern is the safe
default and classic is a presentation-only rollback. The resolved style is
projected onto document/UI datasets and does not fork input authority.

`InputManager` aggregates device sources into semantic movement, look, held
actions, and edge-triggered action presses. Keyboard and mouse remain one
source. `TouchControls` is a UI intent producer: its independent left movement
pointer, right look pointer, Jump button, and contextual interaction button
write through the same semantic contract. `PlayerController` and
`InteractableSystem` consume that contract rather than owning device-specific
DOM behavior. `TouchControls` also projects moving, sprinting, held Jump, and
interaction availability as visual state on its root; terminal lifecycle paths
clear those projections alongside semantic touch state.

Touch mode does not request pointer lock. Story/modal blocking disables the
touch UI and clears its source; pointer cancellation, blur, visibility changes,
resize, orientation changes, disable, and disposal follow the same neutral-input
path. Pass-out recovery temporarily disables the whole touch surface, while the
second-Bell camera reveal clears held touch state and temporarily projects Skip
through the semantic interaction edge. This seam is an included controls pilot
only and does not change the Plan 2.0 mobile-parity or performance scope.

The iPhone display-mode seam is separate from gameplay input.
`src/config/display-mode.js` performs pure Apple-platform, browser/standalone,
and notice-eligibility decisions. `src/ui/MobileDisplayNotice.js` owns only the
first in-play rotation notice lifecycle, including story-blocking deferral and
disposal; it never sizes the viewport or writes gameplay state. `src/main.js`
wires those decisions, while the web manifest and Apple metadata declare the
Home Screen standalone contract. iPhone Safari cannot automatically enter
element fullscreen on rotation, so browser-tab UI explains the supported Add
to Home Screen path and is suppressed in standalone mode.

Viewport projection remains a composition concern. The document uses dynamic
viewport height, and `window.resize` plus `visualViewport.resize` are coalesced
through one animation-frame callback before the camera, renderer,
post-processing, and pixel-ratio consumers update. Input cancellation remains
independent in `TouchControls`. A Home Screen launch may use storage separate
from the Safari tab; `GameSession` remains authoritative within whichever
browser context launched the game.

## Source boundaries

| Directory | Owns | Should not own |
| --- | --- | --- |
| `src/audio/` | Soundscape and audio feedback | Game progression rules |
| `src/config/` | Thornvale-specific tuning for reusable systems | Runtime algorithms or side effects |
| `src/content/` | Declarative authored story/configuration data | Rendering or persistence side effects |
| `src/controllers/` | Player intent and orchestration around movement | World art construction |
| `src/core/` | Shared input and physics-world infrastructure | Feature-specific story logic |
| `src/game/` | Session state, interactions, time, camera behavior, authored gameplay systems, and town assembly | DOM presentation |
| `src/physics/` | Character and dynamic-body simulation | Story branching or UI |
| `src/ui/` | HUD and story presentation | Canonical gameplay state |
| `src/utils/` | Small dependency-light helpers | Feature coordination |
| `src/visuals/` | Models, animation, world presentation, sky, VFX, and post-processing | Save-state authority |

These are responsibility boundaries, not a reason for a large migration. A
module may coordinate with adjacent layers while the prototype is small. New
dependencies should still point toward data and state rather than making core
infrastructure depend on a feature UI or visual implementation.

## Composition rules

- Keep `src/main.js` focused on wiring and lifecycle. Extract a subsystem when
  it gains an independently testable lifecycle, not only to shorten the file.
- Keep authoritative state in game/session modules. UI and visuals consume that
  state and emit intent.
- Keep authored values that describe the story or progression in `src/content/`
  when they can remain data.
- Pass collaborators into systems where practical. Avoid hidden module-level
  singletons that make reset, testing, and multiple sessions difficult.
- Treat `public/` URLs as deployment contracts. See the asset rules in
  [`../../assets-src/README.md`](../../assets-src/README.md) before changing
  asset locations.

## Current authored gameplay flow

`GameSession` is the single save and progression authority for both the Core
Hook, the bounded Day One Proof, and stewardship activities. The clean v1 save
stores global `player`, `world`, and `activities` state; chapter state keeps a
historical account and completion flag but never duplicates current inventory.
`CoreHookDirector` owns the social-horror story spine, `DayOneDirector` owns
camp/garden costs and recovery, `WoodcuttingDirector` owns axe/tree/planting
commits, and `FishingController` owns the transient cast-to-landing state
machine. `src/main.js` routes stable interaction IDs to those systems and
projects snapshots into `DayOneWorld`, `StewardshipWorld`, the HUDs, the story
world, and the aesthetic presentation. Visual and UI modules never write saved
state; fishing timing, line tension, tree fall, and axe swing remain transient.

## Incremental target

Do not pre-create empty source trees. Add these seams only when the stated
pressure exists:

| Add | When |
| --- | --- |
| `src/app/` | Bootstrap, lifecycle, or frame-loop code is extracted from `main.js` into real modules |
| `src/game/<feature>/` | A gameplay feature has several tightly related modules or data adapters; `camera/` owns the current camera slice |
| `tests/integration/` or `tests/browser/` | A real suite and its required harness exist; focused module tests already use `tests/unit/` |
| Architecture diagrams | A relationship is no longer clear from the flow and ownership table above |

Record a cross-cutting or hard-to-reverse boundary change in
[`../decisions`](../decisions/README.md).
