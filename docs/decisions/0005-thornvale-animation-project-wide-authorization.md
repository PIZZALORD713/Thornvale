# 0005: Thornvale animation project-wide authorization

- Status: Accepted
- Date: 2026-07-14

## Context

The animation pipeline has repeatedly treated each new file, clip, source pack,
runtime role, transform, or source revision as a new request for permission from
the Thornvale project owner. That duplicated owner-approval prose across the
manifest, source records, provenance records, tests, and release notes without
improving the evidence that determines whether an animation may lawfully ship.

Animation rights can include upstream authors, performers, motion libraries,
characters, rigs, repositories, and product-use terms. Those rights and the
technical source chain still require exact evidence. A standing project-owner
authorization cannot replace or expand an upstream license.

## Decision

The Thornvale project owner grants one standing project authorization for all
current and future animation sources and derivatives that the owner controls or
may lawfully use, for any integrated use in Thornvale. Covered uses include:

- player, NPC, creature, prop, environmental, cinematic, UI, documentation,
  testing, and promotional animation;
- local bundling or caching, lawful streaming, retargeting, trimming,
  splitting, blending, time-scaling, root-motion treatment, optimization,
  rebaking, recoloring, recombination, and other runtime derivatives; and
- present and future files, clips, source packs, roles, contexts, transforms,
  delivery methods, and revisions that remain within this lawful scope.

No new project-owner permission decision is required because an animation file,
clip, pack, rig, character role, gameplay role, context, transform, delivery
method, or revision changes. Existing `friendsies-animations`,
`friendsies-story-actions-v1`, and future covered animation families inherit
this standing authorization.

This authorization does not claim, waive, replace, or broaden upstream rights.
Every animation intake must still verify the exact source and all applicable
licenses or permissions, including motion, performance, character, mesh,
material, texture, audio, and repository terms as relevant. Unknown,
incompatible, or unverified upstream rights remain valid release blockers.
Source URLs or commits, retrieval dates, original and derivative hashes,
transforms, runtime scope, budgets, fallbacks, and QA remain required.

The authorization is limited to integrated Thornvale work. It does not permit
raw animation-source redistribution, standalone animation or motion packs,
sublicensing, or use outside Thornvale. An upstream license may impose stricter
conditions, which continue to control.

Animation provenance remains separate from canonical fRiENDSiES provenance.
Canonical fRiENDSiES assets and metadata inherit ADR 0004; motion and animation
sources inherit this ADR while retaining their own source-family and upstream-
license records. An animated fRiENDSiES character may therefore rely on both
records without combining their provenance families.

## Consequences

A covered animation may not be release-blocked solely because another per-file,
per-clip, per-pack, per-role, per-transform, or per-revision approval from the
Thornvale project owner has not been requested. Such a blocker is policy drift
and should be replaced by the standing authorization reference.

Release can still be blocked when the source cannot be identified, upstream
rights are missing or incompatible, transforms or hashes are undocumented, raw
or standalone redistribution would be required, budgets fail, runtime fallback
is unsafe, or verification and browser QA are incomplete. This keeps legal and
engineering integrity strict while removing a redundant owner-approval loop.
