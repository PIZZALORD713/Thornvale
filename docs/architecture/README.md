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
