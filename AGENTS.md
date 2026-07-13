# ThornVale Repository Guidance

## Begin every task

- Confirm the active Git root contains `package.json`, `wiki/Plan-2.0.md`, and
  `src/main.js`. Do not edit an empty shell or a neighboring managed checkout.
- Run `git status --short --branch` before editing. Preserve unrelated and
  in-progress changes; never treat a dirty worktree as permission to rewrite it.
- Read sources in this order when they are relevant:
  1. `wiki/Plan-2.0.md` for current scope, milestone, gates, and non-goals.
  2. `wiki/Vision-and-Pillars.md` for product identity and tone.
  3. `src/content/core-hook-v03.js` for the current executable story example.
  4. `docs/architecture/README.md`, `tests/README.md`, and the discipline-specific
     wiki or QA guide for implementation constraints.
- Treat `wiki/Plan-2.0.md` as current over older roadmap or feature promises.

## Protect the ThornVale identity

- Build sincere comfort first. Introduce wrongness through one precise social,
  environmental, or behavioral mismatch rather than generic darkness or gore.
- Express control through kindness, routine, scrutiny, shared memory, and polite
  correction. Preserve the question: are they protecting the player or keeping
  them?
- Prefer a thin authored slice that can be played and observed over broad cozy
  systems, procedural content, multiplayer, or speculative engine work.
- Name the player-facing beat and the milestone exit criterion supported by
  every feature change.
- Make consequential choices alter multiple outputs such as routes, access,
  NPC behavior, scrutiny, relationships, world state, or endings. Do not reduce
  agency to the next dialogue line.
- Keep debug controls and metrics separate from the player-facing experience.

## Respect runtime boundaries

- Keep `src/main.js` focused on composition and lifecycle.
- Keep authoritative progression and save state in `src/game/`; keep declarative
  authored values in `src/content/` when possible.
- Let UI, visuals, and audio consume authoritative state and emit intent. Do not
  make them the source of truth.
- Put reusable tuning in `src/config/`, simulation in `src/physics/`, and visual
  projection in `src/visuals/` according to `docs/architecture/README.md`.
- Add directories and abstractions only when real code and regression coverage
  justify them. Record cross-cutting or hard-to-reverse decisions in `docs/decisions/`.

## Verify changes at the right layer

- Add a focused regression that fails before a bug fix when the behavior is
  deterministic. Test authoritative state separately from visual projection.
- Run the relevant focused tests while iterating. Run `npm run check` before
  handing off a cross-cutting change.
- Use the browser smoke pass in `docs/qa/README.md` for rendering, input, camera,
  audio, asset selection, and complete-story behavior. A passing build is not
  proof of game feel.
- Reproduce long-session rendering faults with an explicit soak duration. Test
  camera, movement, and collision changes at their extremes and at structure edges.
- Record fresh-player sessions with `docs/playtests/FRESH-PLAYER-TEMPLATE.md`.
  Do not create or infer aggregate learning until comparable session records exist.
- Keep screenshots, traces, generated `dist/`, and `output/` artifacts out of
  commits unless a concise QA record deliberately retains them.

## Ship assets safely

- Follow `assets-src/README.md`: editable sources live in `assets-src/`, runtime
  files live in `public/`, and runtime URLs are deployment contracts.
- Record creator/source, permission, acquisition, transforms, and export settings
  in `SOURCE.md`, adjacent `PROVENANCE.md`, and `assets-src/asset-manifest.json`.
- Do not admit unknown-license binaries or infer redistribution rights from public
  availability or repository ownership.
- Run `npm run assets:audit` after asset changes. For a release candidate, build
  and run `npm run assets:release`; do not bypass an expected permission blocker.
- Preserve procedural or previous-version fallbacks for experimental asset pilots.
  Compare baseline and pilot behavior before making a pilot the default.

## Use the repo skills

- Use `$thornvale-creative-director` for story, activity, villager, anomaly,
  quest, dialogue, or playable-slice ideation and review.
- Use `$thornvale-ship-asset-family` for models, Blender sources, textures,
  images, animations, audio, CC0 material, or fRiENDSiES traits.
- Use `$thornvale-debug-3d-playfeel` for movement, camera, collision, animation,
  routing, interaction presentation, shader, or long-session visual bugs.

## Hand off clearly

- Distinguish what is shipped on `main` from local, opt-in, or uncommitted pilots.
- Report player-visible behavior, files or systems changed, verification evidence,
  known limitations, release/provenance blockers, and the safest next gate.
- Update the changelog, QA record, architecture note, or ADR when its documented
  contract changed; do not create duplicate sources of truth.
