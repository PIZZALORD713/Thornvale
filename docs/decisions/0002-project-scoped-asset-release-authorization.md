# 0002: Project-scoped asset release authorization

- Status: Accepted
- Date: 2026-07-12

> The narrow exact-file and exact-use fRiENDSiES scope is superseded by
> [ADR 0004](0004-friendsies-project-wide-authorization.md). This record is
> retained as history; its exact-file animation approval model is superseded by
> [ADR 0005](0005-thornvale-animation-project-wide-authorization.md). Its
> animation source/provenance requirements remain active. The 2026-07-14
> authorization/readiness addendum below supersedes the original requirement
> that every authorized family must also be technically release-ready.

## Context

The asset audit originally treated only project-authored and verified CC0
families as releasable. That conflated permission to publish exact assets in a
Thornvale build with permission to redistribute those assets generally. The
three shipped fRiENDSiES animation derivatives already have exact hashes and an
explicit owner authorization for publication in Thornvale.

## Decision

- Add `project-release-authorized` as a hard-coded release-approved status.
- Require an exact runtime-distribution scope, an explicit `releaseBlocked`
  value, and `rawSourceRedistribution: false` for every family using that
  status.
- Treat `project-release-authorized` as the owner-publication scope, independent
  from technical readiness. An authorized family may remain
  `releaseBlocked: true` for a categorized upstream-rights, provenance,
  transform, fallback, budget, or QA reason without reopening owner permission.
- Limit the grant to the exact manifested runtime files and Thornvale game
  builds. It does not authorize source-file, standalone asset-pack, or general
  outside-project redistribution.
- Keep `project-use-recorded` as the release-blocked state when exact publication
  permission is still unresolved.

The `friendsies-animations` family was the first family accepted through this
path. On 2026-07-12, the project owner also explicitly authorized the exact
manifested files in `friendsies-0001`, `friendsies-6602`, and
`friendsies-8914` for their documented integrated Thornvale uses. That scope
includes the exact local default player and steward files plus the documented
Flower White, Torch, and Crown Up Trait Echo v1 arrangement. It excludes raw or
standalone redistribution and unmanifested traits. That exact-file grant does
not itself authorize collection-range remote streaming.

Later on 2026-07-12, the project owner separately authorized the
`friendsies-remote-player-streaming` family for publication under the bounded
contract in ADR 0003. Published Thornvale builds may fetch the revision-pinned
catalog for token IDs `1..10000` and stream, render, and assemble the selected
token's components only from `https://storage.googleapis.com` as an integrated
in-game player avatar. This separate grant does not authorize full-collection
bundling, canonical or raw copying, mirroring, standalone asset or character
packs, environmental reuse or adaptation, sublicensing, unrelated-origin
delivery, or reuse outside Thornvale.

## Consequences

The strict audit no longer blocks these exact authorized local families solely
because they are neither project-authored nor CC0. Future project-scoped
approvals must record exact files, hashes, grantor, date, provenance, and
runtime scope. General reuse remains intentionally narrower than release inside
Thornvale. `friendsies-remote-player-streaming` remains a separate family whose
authorization comes from the explicit bounded grant above, not from the local-
file grants.

On 2026-07-14, the project owner instructed the project to ship PR #13. That
release instruction authorizes the six exact manifested animation-only files
in `friendsies-story-actions-v1` for integrated bundled publication inside
Thornvale. It does not authorize redistribution of the raw Mixamo ZIPs or FBXs,
a standalone derived-motion pack, sublicensing, or use outside Thornvale.
Later that day, ADR 0005 replaced this exact-file approval model with a standing
authorization for all current and future animation sources and derivatives the
owner controls or may lawfully use inside Thornvale. This paragraph remains as
the historical clearance for the first Story Actions release.

The same 2026-07-14 revision separated authorization from technical readiness.
The original `releaseBlocked: false` requirement conflated those two decisions;
the current audit permits an authorized family to carry a specific non-
permission blocker until its engineering or QA gate is complete. A covered
family may not use repeated project-owner approval as that blocker.
