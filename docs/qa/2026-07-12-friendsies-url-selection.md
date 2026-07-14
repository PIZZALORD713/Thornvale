# fRiENDSiES URL selection — 2026-07-12

> Historical authorization note: ADR 0004 superseded the narrow fRiENDSiES
> permission scopes in this record on 2026-07-13. Preserve the QA evidence
> below; canonical fRiENDSiES assets now share one standing Thornvale-wide grant.

## Scope

Verify that a shareable Thornvale URL selects an exact fRiENDSiES player,
preserves the animation-compatible component assembly, never flashes the old
procedural humanoid, and recovers to the bundled cast when selection or remote
delivery fails. The code-native emergency visual is reserved for total bundled
decoder/local-family failure, not ordinary remote-selection recovery.

## Automated verification

- `npm run check`: passed, 134 tests.
- Production Vite build: passed.
- Development asset audit against `dist/`: passed.
- `git diff --check`: passed.
- Focused selector and ranged-metadata regressions: passed, 10 tests.

## Chrome 150 results

| Case | Result |
| --- | --- |
| `?friend=8448` | Selected player `#8448`; Lucky White body, Glooms face, and The Boy head loaded as three lightweight meshes. |
| `?token=8448` | Selected `#8448` through the compatibility alias. |
| Full `https://www.frienemies.xyz/fren/8448` value in `friend` | Parsed and selected `#8448`. |
| `/fren/8448` | Selected `#8448` through the generator-compatible path. |
| Production preview at `/fren/8448` | Root-relative production chunks loaded from `/assets/`; selected `#8448` with zero console errors or warnings. |
| `?friend=8448abc` | Strictly rejected; requested and displayed bundled `#6602`. |
| Simulated selected-token metadata failure | Requested `#8448`, displayed bundled `#6602`; player-token history contained only `6602`. |
| Story enabled with `?friend=8448` | Player registry held `#8448`; steward registry held `#8914`. |

For every successful `#8448` form, player-token mutation history contained
only `8448`: local `#6602` was not briefly installed first. Scene inspection
found zero objects named `KawaiiAvatar`.

The cold remote path made one `206 Partial Content` request for bytes
`15521110-15717717` of the pinned catalog (`196608` bytes), then requested the
exact component assets. The body retained `Idle Float.001`; the authored walk,
jump, fall, landing, joy, and dance roles were all assigned.

## Boundaries

- Selection applies on initial navigation or reload; this is a shareable-link
  contract, not an in-game live-swap menu.
- Non-bundled tokens require network access. Missing metadata or component
  assets recover through bundled `#6602`, then bundled `#8914`.
- If the bundled decoder or both local families also fail, the code-native
  emergency visual must reach play; this does not change the fRiENDSiES-first
  behavior verified above.
- No new binary asset was added for URL selection. The network-fetched media is
  declared in `asset-manifest.json` as
  `friendsies-remote-player-streaming`, with the revision-pinned catalog URL,
  catalog SHA-256, 1–10,000 token scope, and
  `https://storage.googleapis.com` as the only recorded component origin.
- The external family is `project-release-authorized` only for published
  Thornvale builds to fetch the revision-pinned catalog for IDs `1..10000` and
  stream, render, and assemble one selected token's components from
  `https://storage.googleapis.com` as an integrated in-game player avatar.
- The grant does not permit full-collection bundling, canonical or raw copying,
  mirroring, standalone asset or character packs, environmental reuse or
  adaptation, sublicensing, unrelated-origin delivery, or reuse outside
  Thornvale. Any catalog, range, origin, or runtime-role expansion requires a
  new permission decision.

## Authorization refresh

- `node --test tests/asset-budgets.test.js tests/player-character-config.test.js`:
  passed, 12 tests.
- `npm run assets:release`: passed with 21 runtime files / 4,212,285 bytes,
  one authorized external runtime dependency, and production `dist` at
  8,061,208 / 8,388,608 bytes.
- The audit rejects stale blocker text on an unblocked family and rejects an
  external dependency reason that does not exactly match the family's
  affirmative authorization wording.
- Production-preview smoke at `/fren/8448?assets=pilot&traits=v1` resolved
  requested and active player token `8448` through `path:fren`, kept both the
  player and steward on `friendsies` visuals, retained pilot assets and Trait
  Echo v1, and emitted no browser warnings or errors.
