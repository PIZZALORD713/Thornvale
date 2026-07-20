# Architecture Decisions

Use an architecture decision record (ADR) for choices that are expensive to
reverse, affect several modules, establish a repository convention, or constrain
future work. Small local implementation choices belong in code and tests.

## Naming and status

Name records `NNNN-short-title.md` with a four-digit sequence. Each record has
one status: `Proposed`, `Accepted`, `Superseded`, or `Rejected`. Never rewrite
an accepted decision to hide history; add a new ADR and link the record it
supersedes.

## Template

```markdown
# NNNN: Decision title

- Status: Proposed
- Date: YYYY-MM-DD

## Context

What pressure or constraint requires a decision?

## Decision

What will the project do?

## Consequences

What becomes easier, harder, or newly required?
```

## Index

- [`0001-project-layout-and-asset-boundaries.md`](0001-project-layout-and-asset-boundaries.md) — Accepted
- [`0002-project-scoped-asset-release-authorization.md`](0002-project-scoped-asset-release-authorization.md) — Accepted; narrow fRiENDSiES scope superseded by 0004 and exact-file animation approval superseded by 0005
- [`0003-external-runtime-asset-dependencies.md`](0003-external-runtime-asset-dependencies.md) — Accepted; fRiENDSiES permission scope superseded by 0004
- [`0004-friendsies-project-wide-authorization.md`](0004-friendsies-project-wide-authorization.md) — Accepted
- [`0005-thornvale-animation-project-wide-authorization.md`](0005-thornvale-animation-project-wide-authorization.md) — Accepted
- [`0006-pizza-lab-blender-control-boundary.md`](0006-pizza-lab-blender-control-boundary.md) — Accepted for bounded pilot
- [`0007-pizza-lab-world-stage-authority.md`](0007-pizza-lab-world-stage-authority.md) — Accepted for World Stage v1
- [`0008-pizza-lab-wayfinder-asset-promotion.md`](0008-pizza-lab-wayfinder-asset-promotion.md) — Accepted for Wayfinder v1

The wiki remains the home for product and design decisions. Its
[`Tech Decisions`](../../wiki/Tech-Decisions-ADR-Log.md) page can summarize
player-relevant technical direction; implementation ADRs here carry the detailed
repository contract.
