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
- [`0002-project-scoped-asset-release-authorization.md`](0002-project-scoped-asset-release-authorization.md) — Accepted
- [`0003-external-runtime-asset-dependencies.md`](0003-external-runtime-asset-dependencies.md) — Accepted

The wiki remains the home for product and design decisions. Its
[`Tech Decisions`](../../wiki/Tech-Decisions-ADR-Log.md) page can summarize
player-relevant technical direction; implementation ADRs here carry the detailed
repository contract.
