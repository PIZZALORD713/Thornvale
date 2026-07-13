# 0003: External runtime asset dependencies

- Status: Accepted
- Date: 2026-07-12

## Context

The asset manifest originally described only files committed under `public/`.
Shareable fRiENDSiES player links can instead fetch one entry from a pinned
collection catalog and stream that token's component assets directly from the
collection host. Those components never become local manifest files, so a
strict release audit could pass without evaluating their publication scope.

The arbitrary-token path is useful for shareable published-player links, and
its failure fallback remains the bundled cast. Its release boundary must remain
machine-checkable even though the streamed components are not repository files.

## Decision

- Record network-fetched creative media in the asset manifest under
  `externalRuntimeDependencies`, even when the dependency owns no local file.
- Each entry must reference a manifest family and declare a revision-pinned
  metadata URL, catalog SHA-256 and byte length, exact allowed asset origins,
  token scope, runtime use, and reason.
- Apply the same runtime-family permission statuses to local and external
  dependencies. A `project-use-recorded` external family may operate in
  development only when it remains explicitly release blocked; a bounded
  `project-release-authorized` dependency may ship only under its recorded
  runtime scope.
- Keep `friendsies-remote-player-streaming` available for token IDs `1..10000`
  in local and published Thornvale builds. Its catalog is the revision-specific
  `fRiENDSiES` gist whose SHA-256 is
  `9f1c4e1cf8d848bd2ceaff7cde48c4ecf60a4b1d0afe273e7a5c5b68c2aee3ef`;
  selected component assets are expected only from
  `https://storage.googleapis.com`.
- Record the project owner's 2026-07-12 authorization as
  `project-release-authorized`: a published Thornvale build may fetch the
  revision-pinned catalog and stream, render, and assemble one selected token's
  components as an integrated in-game player avatar. The grant excludes full-
  collection bundling, canonical or raw copying, mirroring, standalone asset or
  character packs, environmental reuse or adaptation, sublicensing, unrelated-
  origin delivery, and reuse outside Thornvale.
- Keep `rawSourceRedistribution: false`. Any catalog revision, origin, token-
  range, runtime role, or distribution-model change requires a new permission
  decision rather than inheriting this authorization.

## Consequences

Published builds may keep shareable arbitrary-token links and bundled failure
fallback under the bounded contract. The external dependency contributes zero
local files and zero declared deployment bytes, while the strict audit verifies
that its affirmative authorization wording matches the family record.

The catalog hash is provenance evidence for the pinned source snapshot; the
current ranged runtime fetch does not re-hash the complete 18.5 MB document.
Origin, catalog, token-scope, runtime-role, or authorization changes must update
the manifest contract and its deterministic audit tests. Remote delivery is not
an exemption from asset permission review, and this decision does not authorize
environmental Trait Echo use or asset redistribution outside the in-game player
assembly path.
