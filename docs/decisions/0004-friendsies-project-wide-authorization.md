# 0004: fRiENDSiES project-wide authorization

- Status: Accepted
- Date: 2026-07-13

## Context

ADRs 0002 and 0003 recorded fRiENDSiES release permission around exact files,
tokens, runtime roles, and one pinned catalog revision. That made each new
trait, character role, transform, or catalog revision look like a new rights
decision even when the work remained entirely inside Thornvale. The resulting
per-use review duplicated policy across the manifest, curation data, runtime
metadata, tests, and documentation while adding no useful engineering signal.

Source identity and runtime safety still matter. Exact URLs, catalog pins,
approved origins, hashes, transforms, budgets, fallbacks, and QA are engineering
integrity gates; they should not be mistaken for repeated permission decisions.

## Decision

The Thornvale project owner grants one standing project authorization for
canonical fRiENDSiES assets and metadata under the owner's control, including
current and future canonical collection revisions, for any integrated use in
Thornvale. Covered uses include:

- local or remote player avatars and NPCs;
- complete characters, detached traits, hand items, sprouts, backpieces, tools,
  equipment, props, environments, and authored cross-token compositions;
- UI, documentation, testing, and Thornvale promotional captures; and
- remote streaming, selected-file local bundling or caching, optimization,
  transformation, and derivative runtime assets.

Covered material inherits the single `friendsies-project` authorization family.
No new permission decision is required because a token, asset, trait type,
runtime role, context, transform, delivery method, or canonical collection
revision changes. Catalog revisions and new assets still require source and
integrity records appropriate to their technical risk.

This authorization is limited to integrated Thornvale work. It does not permit
standalone fRiENDSiES asset or character packs, bulk raw collection mirroring or
dumps, sublicensing, raw-source redistribution as a separate product, or reuse
outside Thornvale.

The authorization does not weaken the release audit. The repository continues
to verify canonical source identity, revision pins, approved network origins,
exact selected-file URLs and hashes, documented transforms, payload and geometry
budgets, local fallbacks, deterministic tests, and browser QA. Those checks are
engineering and integrity gates, not permission gates. Unrelated third-party
material continues through the normal rights review.

Animation provenance remains separate from this canonical collection record.
The `friendsies-animations`, `friendsies-story-actions-v1`, and future covered
animation families inherit the standing Thornvale animation authorization in
[ADR 0005](0005-thornvale-animation-project-wide-authorization.md), while their
Mixamo, repository, and other upstream source chains retain independent license
and provenance records. This collection authorization does not replace them.

## Consequences

ADRs 0002 and 0003 are superseded where they imposed exact-file, token-range,
runtime-role, delivery-model, or catalog-revision permission boundaries on
fRiENDSiES material. Their generic manifest and external-dependency audit
patterns remain useful historical context.

Future fRiENDSiES work records what engineering needs to reproduce, validate,
budget, roll back, and ship the result. Curation decides design fit and technical
readiness; it no longer adjudicates rights one trait at a time. A release may
still fail because a source is noncanonical, an origin or pin changed without
review, a transform is undocumented, a budget is exceeded, a fallback is
missing, or QA failed, but not because an integrated Thornvale use needs another
per-asset authorization.
