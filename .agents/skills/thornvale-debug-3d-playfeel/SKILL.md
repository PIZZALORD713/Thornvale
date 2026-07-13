---
name: thornvale-debug-3d-playfeel
description: Diagnose and fix ThornVale 3D playfeel and presentation regressions with deterministic reproduction, explicit invariants, targeted regression tests, and real-browser verification. Use for movement, camera, collision, animation cadence or footsteps, route clearance, interaction presentation or persistence, shaders or post-processing, viewport resizing, quality or reduced-motion variants, and long-session visual faults in ThornVale.
---

# Debug ThornVale 3D Playfeel

Turn a subjective or intermittent playfeel report into a reproducible contract, fix the owning layer, and verify both deterministic behavior and the rendered experience. Preserve authoritative game state, physical simulation, and visual projection as separate concerns.

## Follow the repository contract

1. Confirm the active Git root and inspect `git status --short --branch` before editing. Preserve unrelated work.
2. Read only the relevant parts of `wiki/Plan-2.0.md`, `docs/architecture/README.md`, `tests/README.md`, and `docs/qa/README.md` before changing behavior.
3. Match the requested scope. For diagnosis-only requests, reproduce and report the owner without implementing a fix.
4. Keep `src/main.js` as composition and lifecycle. Put world tuning in `src/config/`, physical simulation in `src/physics/`, input orchestration in `src/controllers/`, gameplay and persistence authority in `src/game/`, and projection in `src/visuals/` or `src/ui/`.
5. Do not hide an authoritative-state or physics defect with a presentation-only correction. Do not make UI, animation, VFX, or route markers the source of truth.

## Build a deterministic reproduction

Record the smallest route, starting state, input sequence, and observation point that exhibits the fault. Establish the baseline before editing; do not rely on a verbal impression alone.

Vary only dimensions relevant to the report:

| Dimension | Useful values |
| --- | --- |
| Session | clean save, restored save, migrated save, `?story=reset` |
| Story | phase, interaction order, comply or alter route, before and after refresh |
| Timing | 60, 120, and 144 Hz; slow frame; fixed-step boundary; explicit soak duration |
| Space | terrain seam, slope, ledge, wall, porch, doorway, route segment, world origin or distant point |
| View | minimum and maximum pitch, close obstruction, rapid orbit, narrow and wide viewport, resize |
| Presentation | day and night, low and high quality, reduced motion on and off |
| Asset flags | `?assets=baseline` and `?assets=pilot`; `?traits=off` and `?traits=v1` when relevant |

For each tested cell, capture:

- exact setup and input sequence;
- expected invariant and actual result;
- first bad frame, transition, route segment, or elapsed time;
- console error or diagnostic value, if any;
- whether physical state, authoritative state, and visible projection agree.

Prefer numeric evidence such as distance travelled, minimum camera height, maximum render-pose step, transition count, route clearance, animation phase, uniform value, viewport size, or save snapshot. Use debug controls for observation, but do not make them part of player-facing behavior.

## Classify the owner before changing code

Use this symptom matrix as a starting hypothesis, then trace the data flow to confirm it:

| Symptom | Inspect first | Existing regression surface |
| --- | --- | --- |
| Speed changes with refresh rate, sticky collision, false airborne state, hover or jitter | `src/controllers/PlayerController.js`, `src/physics/CharacterMotor.js`, `src/core/PhysicsWorld.js` | `tests/character-movement.test.js`, `tests/town-physics.test.js` |
| Camera crosses terrain, clips a wall, jumps after obstruction, or hides the wrong target | `src/config/camera.js`, `src/game/camera/CameraRig.js`, collision metadata and cache wiring | `tests/unit/camera-rig.test.js`, `tests/visual-rig.test.js` |
| Walk cadence, footsteps, takeoff, fall, landing, or shoe grounding disagrees with travel | motor motion state, `src/visuals/FriendsiesAnimator.js`, `PlayerAnimator.js`, `VisualRig.js`, audio consumption | `tests/friendsies-animation.test.js`, `tests/visual-rig.test.js`, `tests/character-movement.test.js` |
| Guidance trail crosses a cottage, becomes discontinuous, or ends somewhere unreachable | `src/config/town.js`, `src/visuals/StoryWorld.js`, town collider and approach helpers | `tests/story-world.test.js`, `tests/town-physics.test.js` |
| Prompt or response shows stale data, a name disappears, or refresh changes an interaction | `src/game/GameSession.js`, core-hook director/content, then UI projection | `tests/core-hook-session.test.js`, `tests/story-world.test.js` |
| Grain, bloom, vignette, color, or pulse fails after time or quality changes | `src/visuals/PostProcessing.js`, shader uniforms, frame `dt`, quality and fallback paths | Add a focused projection test; verify in a real browser |
| Stretching, blur, wrong framing, or stale render targets after resize | camera aspect/projection, renderer size and pixel ratio, post-processing resize, VFX pixel ratio | Add a deterministic resize contract where practical; verify multiple viewports |

Classify the fault explicitly as one or more of: state transition, persistence or migration, input edge, render-versus-fixed timing, coordinate space, collision geometry or filtering, asset contract, animation state, visual projection, shader precision, viewport lifecycle, or composition wiring.

## State the invariant

Write one falsifiable sentence before implementing. Include units, bounds, timing, and exceptions. Useful ThornVale patterns include:

- Travel over the same input duration remains equivalent at 60, 120, and 144 Hz within a named tolerance.
- A one-frame raw ground gap does not emit airborne or landing transitions; an explicit jump immediately overrides stale contact.
- The rendered capsule or feet remain visually stable even when Rapier makes a small allowed body correction.
- The camera lens never falls below configured floor height plus clearance; close collision may override normal framing distance without crossing the blocking surface.
- Decorative terrain, particles, foliage, avatars, and story dressing do not become camera blockers.
- Animation role and foot contacts derive from motor phase and actual horizontal speed; stopping, jumping, or resuming cannot replay stale contacts.
- Every authored route segment clears physical building bounds plus player margin, markers remain readable, and the destination is reachable.
- Player-entered names are normalized and saved before dependent dialogue begins; refresh and migration preserve the same authoritative value.
- Shader inputs remain finite and precision-safe for the stated soak duration; any bounded-time wrap preserves visual continuity.
- Resizing updates camera projection, renderer, composer, and pixel-ratio consumers without a stale frame or invalid dimension.

Do not weaken the invariant merely to match current output. Separate acceptable low-level noise from the player-visible contract and justify both thresholds.

## Add a fail-before regression

Reproduce the defect in the narrowest deterministic test before fixing it whenever practical. Make the new assertion fail for the reported reason, not because the harness is unrealistic.

- Simulate render-rate and fixed-step interactions rather than assuming a single `dt`.
- Exercise transition edges, not only steady state: takeoff, landing, direction reversal, obstruction enter/exit, resize, quality switch, route choice, save/reload, and time wrap.
- Test authoritative state separately from visual projection.
- Use local fixtures and bundled fallbacks; keep tests independent of network assets.
- For route clearance, test line segments against the same authored bounds and margins used by the town contract.
- For a long-session shader fault, advance or inject the relevant clock deterministically when possible, then perform a real-duration soak only for behavior a unit test cannot represent.

If a browser-only defect cannot receive an automated regression without creating a new harness, document why and specify an exact focused smoke check. Do not introduce a browser test framework solely for one bug.

## Implement the smallest coherent fix

Fix the confirmed owner and keep one source of truth:

- Change algorithms in their owning subsystem and reusable world values in config.
- Preserve the distinction between physical body position, filtered render pose, and visual grounding offset.
- Derive animation cadence and footsteps from travel state instead of maintaining an unrelated timer when authored contacts exist.
- Keep route layout, collider geometry, and approach helpers mutually consistent.
- Commit session state before awaiting UI dialogue or presentation effects that consume it.
- Bound or rebase long-running shader clocks only with a continuity contract; reject non-finite `dt` and clamp exceptional frame deltas at the owning boundary.
- Resize every dependent render surface from the same measured viewport and respect quality and pixel-ratio caps.
- Preserve direct-render, fallback-avatar, baseline-asset, reduced-motion, and reset paths.

Avoid broad refactors, duplicated tuning, arbitrary delays, animation-only masks for physics faults, or new abstractions without a concrete regression.

## Verify from narrow to broad

Run the focused test while iterating, then adjacent contracts:

```bash
node --test tests/character-movement.test.js
node --test tests/unit/camera-rig.test.js tests/visual-rig.test.js
node --test tests/friendsies-animation.test.js tests/visual-rig.test.js
node --test tests/story-world.test.js tests/town-physics.test.js
node --test tests/core-hook-session.test.js tests/story-world.test.js
```

Select only commands relevant to the change. Run `npm run check` before handing off a cross-cutting change.

Then verify the real rendered result using the browser smoke guidance in `docs/qa/README.md` plus a targeted pass for the invariant:

1. Re-run the original reproduction first.
2. Test the nearest extremes and transitions: both pitch limits, obstruction enter/exit, terrain and structure edges, walk/sprint/jump/land, both route choices, refresh, resize, day/night, and quality or reduced-motion variants as relevant.
3. Inspect console output and confirm the fallback path still renders.
4. For an intermittent or time-dependent fault, run the named soak duration and record elapsed time, active flags, viewport, quality, and result. Do not claim a soak from accelerated unit time alone.
5. Confirm debug metrics agree with the visible result, then disable debug presentation and check the player experience.

## Record durable QA evidence only when needed

Use the repository's `docs/qa/` convention for a release blocker, intermittent regression, or result another person must reproduce. Do not create a record for every small unit fix or commit generated screenshots, traces, `dist/`, or `output/` by default.

Use this compact structure without duplicating the standard smoke checklist:

```markdown
# YYYY-MM-DD — <topic>

- Build/commit:
- Scope and invariant:
- Starting save/route:
- Browser, device, viewport, pixel ratio:
- Quality, reduced motion, asset/trait flags:
- Reproduction inputs and expected/actual result:
- Baseline measurements:
- Fix measurements:
- Focused tests:
- Browser extremes and soak duration:
- Console or fallback result:
- Retained artifact links, if deliberately committed:
- Remaining limitation and next gate:
```

## Hand off the result

Report the player-visible symptom and outcome, confirmed fault class and owner, invariant, files or systems changed, fail-before regression, focused and broad verification, browser matrix and soak duration, and any remaining limitation. Distinguish automated evidence from visual judgment and local results from shipped behavior.
