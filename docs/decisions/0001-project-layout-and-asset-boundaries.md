# 0001: Project layout and asset boundaries

- Status: Accepted
- Date: 2026-07-11

## Context

The playable prototype already has useful source boundaries, but engineering
records, QA notes, release evidence, helper tooling, and editable asset sources
did not have explicit homes. The old project-structure page described a
hypothetical TypeScript layout rather than the JavaScript application that is
actually shipped.

Runtime assets also need a clear separation from working source files. Vite
copies `public/` into the deployment unchanged, and several bundled assets carry
specific provenance records that must remain visible.

## Decision

- Preserve the current `src/` module groups and evolve them incrementally.
- Keep product, narrative, art-direction, and gameplay-design documentation in
  `wiki/`.
- Keep implementation architecture, ADRs, QA procedures, and release operations
  in `docs/`.
- Keep reusable repository tooling in `scripts/`.
- Keep editable or high-fidelity asset inputs in `assets-src/`; only optimized,
  runtime-ready outputs belong in `public/`.
- Keep provenance beside the published asset family and document any transform
  from source to runtime output.
- Let Node discover tests recursively. Preserve existing feature-contract tests
  at the root and add focused tests to named categories such as `tests/unit/`.
- Group a feature only when real implementation and regression coverage give it
  a clear owner; `src/game/camera/` is the first such slice.
- Create a directory when it has a real file and owner, rather than tracking an
  empty placeholder.

## Consequences

Contributors can place new work without inventing a layout per feature, and
published asset provenance remains part of the release surface. Some concepts
will have both a wiki specification and an engineering record; those documents
must link instead of silently duplicating or contradicting one another.

The source tree is not reorganized immediately. A later extraction from
`src/main.js` or a new test harness requires an implementation change and, when
cross-cutting, a follow-up ADR.
