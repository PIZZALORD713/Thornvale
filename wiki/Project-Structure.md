# Project Structure

Thornvale evolves its structure around working code. The current JavaScript
prototype already has useful runtime boundaries, so the 2.0 layout preserves
them and adds explicit homes for engineering records, QA, releases, source
assets, scripts, and test ownership.

## Current layout

```text
/
├── .github/workflows/       CI automation
├── assets-src/              Editable/intermediate asset inputs (not served)
├── docs/                    Implementation-facing engineering records
│   ├── architecture/        Runtime maps and dependency boundaries
│   ├── decisions/           Numbered architecture decision records
│   ├── qa/                  Verification procedures and retained evidence
│   └── release/             Release operations and candidate records
├── public/                  Runtime-ready static assets copied by Vite
│   ├── animations/          Bundled animation clips plus provenance
│   ├── draco/               Bundled decoder plus usage notes
│   └── friendsies/          Bundled token assets plus per-token provenance
├── scripts/                 Reusable repository and asset-pipeline helpers
├── src/
│   ├── audio/               Soundscape and audio feedback
│   ├── config/              World-specific tuning for reusable systems
│   ├── content/             Declarative authored story/configuration data
│   ├── controllers/         Player intent and movement orchestration
│   ├── core/                Input and physics-world infrastructure
│   ├── game/                Session, interaction, time, and world systems
│   │   └── camera/          Third-person camera behavior and floor safety
│   ├── physics/             Character and dynamic-body simulation
│   ├── ui/                  HUD and story presentation
│   ├── utils/               Small shared helpers
│   ├── visuals/             Models, animation, world art, sky, VFX, and post
│   └── main.js              Application composition and frame loop
├── tests/                   Node tests plus category ownership
│   └── unit/                Focused module-level regressions
├── wiki/                    Product, design, narrative, and art-direction docs
├── index.html               Browser entry point
├── package.json             Dependencies and standard commands
└── vite.config.js           Build configuration
```

`dist/`, local browser output, dependency folders, and tool caches are generated
artifacts, not architectural source directories.

## Documentation boundary

`wiki/` remains Thornvale's product and design handbook. Vision, narrative,
gameplay rules, milestones, controls, art direction, player-facing technical
expectations, and roadmap decisions belong here.

`docs/` records how the implementation is organized, verified, and released:

- [`docs/architecture`](../docs/architecture/README.md) explains current runtime
  boundaries.
- [`docs/decisions`](../docs/decisions/README.md) holds durable implementation
  ADRs.
- [`docs/qa`](../docs/qa/README.md) defines reproducible verification.
- [`docs/release`](../docs/release/README.md) defines the release handoff.

When a change affects both behavior and implementation, update both homes and
link them. Do not copy a complete specification into two places.

## Asset boundary and provenance

`assets-src/` is for editable or high-fidelity working inputs. It is outside the
runtime and has its own [source-asset rules](../assets-src/README.md).

`public/` is the deployment contract: Vite copies its contents unchanged, so
loaders rely on stable paths. Only runtime-ready exports belong there. Existing
animation and fRiENDSiES assets remain in their current public paths, and their
provenance records remain adjacent to the assets:

- [`public/animations/PROVENANCE.md`](../public/animations/PROVENANCE.md)
- [`public/friendsies/0001/PROVENANCE.md`](../public/friendsies/0001/PROVENANCE.md)
- [`public/friendsies/8914/PROVENANCE.md`](../public/friendsies/8914/PROVENANCE.md)

Do not move, rename, or replace those assets without updating the loader,
provenance, and release verification together. A working source file is never a
substitute for documented redistribution permission.

## Incremental target

The target is clearer ownership, not a big-bang tree migration. Create the next
directory only when real code or evidence needs it:

| Pressure | Incremental change |
| --- | --- |
| `main.js` accumulates independently testable bootstrap or lifecycle behavior | Extract real modules into `src/app/` and leave `main.js` as the composition entry |
| A gameplay feature grows across several related modules | Group that feature under `src/game/<feature>/` without reorganizing unrelated systems; `game/camera/` is the first example |
| A focused module regression is added | Place it in `tests/unit/`; existing feature-contract tests can remain at the root |
| A real multi-system or browser harness is adopted | Add `tests/integration/` or `tests/browser/` with the harness, not as an empty category |
| An asset transform is repeated | Add a documented helper under `scripts/` and retain provenance in the output family |
| Editable source art is committed | Add a real family under `assets-src/` with `SOURCE.md`; do not add empty category folders |

Cross-cutting or hard-to-reverse changes should get an ADR. Small feature-local
changes should follow the existing boundary and remain easy to review.

## Placement rules

1. Runtime JavaScript belongs in the narrowest fitting `src/` area.
2. Authoritative gameplay state belongs in game/session code; UI and visuals
   project that state rather than owning it.
3. Product truth belongs in `wiki/`; implementation contracts belong in `docs/`.
4. Runtime assets belong in `public/`; editable sources belong in `assets-src/`.
5. Reusable tooling belongs in `scripts/`, not in application code.
6. Node discovers tests recursively; use the category guidance in
   [`tests/README.md`](../tests/README.md) rather than moving existing tests for
   cosmetic consistency.
7. Track useful files, not empty `.gitkeep` placeholders.
