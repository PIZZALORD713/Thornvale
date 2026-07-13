# 0002: Project-scoped asset release authorization

- Status: Accepted
- Date: 2026-07-12

## Context

The asset audit originally treated only project-authored and verified CC0
families as releasable. That conflated permission to publish exact assets in a
Thornvale build with permission to redistribute those assets generally. The
three shipped fRiENDSiES animation derivatives already have exact hashes and an
explicit owner authorization for publication in Thornvale.

## Decision

- Add `project-release-authorized` as a hard-coded release-approved status.
- Require an exact runtime-distribution scope, `releaseBlocked: false`, and
  `rawSourceRedistribution: false` for every family using that status.
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
