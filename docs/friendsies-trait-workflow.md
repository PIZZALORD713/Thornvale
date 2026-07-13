# fRiENDSiES environmental trait workflow

This is the internal-evaluation path for turning a large character-trait catalog
into a small, intentional Thornvale environment vocabulary. Catalog presence,
an attractive preview, or a successful geometry probe is not permission to
bundle, adapt, redistribute, or publish a trait.

The workflow is:

```text
index -> atlas -> shortlist -> probe -> provenance -> bundle -> place -> QA
```

The player-facing beat is the opening route from arrival through the Welcome
Gate to the Community Ledger and Town Bell. The relevant Milestone 1 gate is a
readable, completable core-hook route whose cozy welcome becomes polite control.
The player should enter feeling personally welcomed and leave the intervention
feeling that every kindness was also catalogued. They cross the Gate, sign the
Ledger, ring the Bell once, discover the false record, and choose which account
remains. The testable trait hypothesis is that fresh players can identify the
Gate, Ledger, Bell, and Lumen's shift from guide to authority without being told
to inspect the decoration.

This workflow does not authorize a full-town replacement, a character builder,
procedural trait scattering, new interactions, a third ending, or collection-
wide metadata as an environmental-trait runtime source. Those remain outside
the current core-hook gate. The separate shareable-player path can range-fetch
one non-bundled token and stream its character components during development;
that path is not Trait Echo approval and is declared as a strict-release-blocked
external dependency in the asset manifest.

## 1. Index the pinned catalog

[`../assets-src/friendsies/trait-index.json`](../assets-src/friendsies/trait-index.json)
is a source-side review artifact, not a runtime manifest. It is derived from the
pinned fRiENDSiES metadata revision recorded in the index and preserves all
seven collection trait types. The bounded environmental curation sidecar uses
only `hand` and `sprout`. A trait is identified by the exact, case-sensitive key
`${traitType}:${value}`.

```bash
npm run friendsies:index
```

Each indexed trait may have several GLB variants even when its display name is
the same. Keep the distinct asset URLs and their token evidence separate. Do not
pick a convenient token and assume every same-named variant is identical.

Before using an index, verify:

- the metadata URL is revision-pinned;
- its downloaded SHA-256 matches the index source record;
- every variant retains its canonical asset and preview URL plus token IDs; and
- the generated index itself is never imported by application runtime code.

## 2. Review the atlas

Start the loopback-only review tool:

```bash
npm run friendsies:atlas
```

Then open <http://localhost:4174>. Use `PORT=4175` or `--port 4175` when that
port is occupied. The server exposes the generated index at
`/trait-index.json`, this curation at `/trait-curation.json`, and the optional
probe ledger at `/trait-probes.json`. Its source lives under
`tools/friendsies-trait-atlas/` and is not shipped by Vite.

Use the atlas to compare silhouettes and names, not to approve rights or infer
technical compatibility. Ask whether a trait supports a named landmark, story
state, or wayfinding job. Reject visually interesting objects that have no
specific opening-route responsibility.

## 3. Curate a bounded shortlist

[`../assets-src/friendsies/trait-curation.json`](../assets-src/friendsies/trait-curation.json)
is the manually reasoned decision layer. Every entry includes semantic tags, an
environment role, story phases, placement advice, rationale, and a rights
status. The three exact active traits use `project-release-authorized`; every
unapproved shortlist or hold remains `project-use-review-required`.

Statuses mean:

- `active`: already used in the build. Release scope still comes only from the
  exact manifest family and provenance record; active status alone grants
  nothing.
- `shortlist`: worth technical and permission review for a named use.
- `hold`: a catalog-confirmed reserve whose meaning, scope, timing, or rights do
  not support intake yet.

Sprouts should communicate identity, office, or district. Hand items should
communicate intent, action, ritual, or access. Prefer one meaningful object at a
landmark over a carpet of repeated decoration. `All Seeing` and `Orb` are held
for anomaly-only use because showing literal surveillance at arrival would
spoil Thornvale's subtle wrongness.

## 4. Probe one GLB in memory

Probe an exact entry after it earns shortlist attention:

```bash
npm run friendsies:probe -- \
  --type hand \
  --value "Book Of Ocean"

npm run friendsies:probe -- \
  --type sprout \
  --value "Friends Key" \
  --variant c61706dfde5db0fce0e93827e54094c1
```

`--variant` accepts the exact generated variant ID or hash, or its zero-based
index. Without it, the index's declared default is used, otherwise the first
variant. Selection is exact and case-sensitive. The hash in the example is the
variant whose index evidence includes token `#431`; same-named sprout variants
must not be treated as interchangeable.

The probe reads `assets-src/friendsies/trait-index.json`, downloads only the
selected canonical GLB, holds it in memory, parses its glTF JSON metadata, and
updates `assets-src/friendsies/trait-probes.json`. It never writes the GLB. Use
`--dry-run` to print the same report without changing the probe ledger.

Reports include bytes, SHA-256, mesh, primitive, triangle, skin, joint,
animation, material, texture, image, node, and morph-target counts. The
compatibility result is deliberately conservative:

The checked-in probe ledger currently records the three active traits plus
`Book Of Ocean` and the token-`#431` `Friends Key` variant. It contains reports
only; no downloaded GLB is retained.

| Classification | Meaning | Next action |
| --- | --- | --- |
| `rigid-candidate` | One scene-node primitive could fit the existing frame-zero bake | Decode and verify that every vertex is rigidly weighted to one joint before runtime use |
| `deformable` | Morphs, multiple skins, or multiple skinned meshes require live deformation | Review as a character asset or reject for Trait Echo |
| `review` | Valid triangles use a more complex mesh or primitive layout | Inspect deliberately; do not assume the current instancer can consume it |
| `unsupported` | The container lacks usable scene triangles or has incomplete geometry/skin metadata | Reject or define a separate, justified pipeline |

A metadata-only `rigid-candidate` is not proof that a model is rigid, correctly
oriented, well-pivoted, attractive in Thornvale, or safe to redistribute.

## 5. Record permission and provenance

Before adding a new binary, identify the exact token evidence, trait type and
value, selected variant URL, original filename, original SHA-256, retrieval
date, creator or owning project, intended environmental adaptation, and the
permission text that covers that use.

The exact active Flower White, Torch, and Crown Up runtime hashes and documented
Trait Echo v1 arrangements are project-release-authorized for bundled Thornvale
builds. That scope is not a general license. For every other candidate whose
exact environmental-adaptation and publication authority is unrecorded, keep
the candidate metadata-only. Do not add its URL to the Trait Echo/environment
runtime configuration, preload it for the environment, request it from the
Trait Echo system, copy it into `public/`, or relax the asset audit. A full token
selected through the separately authorized remote-player path may independently
stream the same binary as an integrated character component; that does not
approve the candidate for environmental use, local bundling, raw copying,
mirroring, standalone redistribution, or use outside Thornvale.

When the evidence is sufficient, follow [`../assets-src/README.md`](../assets-src/README.md)
and the live [`../assets-src/asset-manifest.json`](../assets-src/asset-manifest.json).
Create adjacent source and runtime provenance records using the repository's
asset templates. The live manifest and audit own accepted statuses and byte
budgets; this workflow does not duplicate them.

## 6. Bundle only the approved selection

Bundle the one approved GLB under a stable, versioned `public/friendsies/` path.
Record final bytes and SHA-256 after the file is final. Add its exact manifest
entry, runtime context, family permission state, release blocker when applicable,
and adjacent provenance in the same change.

Do not bundle the full metadata index, all same-named variants, or the complete
collection. Do not make a new environmental trait a startup-blocking remote
dependency. A missing optional Trait Echo family must fail locally while the
procedural or previous version remains playable.

Run the development audit immediately after intake:

```bash
npm run assets:audit
```

“Asset audit passed for development; release blockers remain” means exactly
that. It is not release approval.

## 7. Place as authored story language

Add declarative placement and story meaning only after the binary and rights
record agree. Preserve gameplay anchors, collider shapes, interaction IDs,
save fields, and authoritative story state. Visuals consume story state; they
do not create it.

For the current opening-route vocabulary:

- `Flower White` is a deliberate arrival gift or performed-kindness marker,
  never generic meadow filler.
- `Torch` guides at arrival and the Gate, then becomes Bell ritual and authority.
- `Crown Up` identifies the Ledger's civic office.
- `Friends Key`, if approved, belongs as the Welcome Gate crest.
- `Book Of Ocean`, if approved, belongs on the Ledger shelf.
- `All Seeing` and `Orb` remain absent from Trait Echo until an anomaly-only
  reveal is authored and validated.

Keep `?traits=off` as the independent rollback and preserve per-family failure.
Use instancing for repeated rigid placements, dispose cloned GPU resources, and
retain semantic state changes under reduced motion while removing incidental
sway or flicker.

## 8. Verify before expanding

Add deterministic tests for exact trait/variant resolution, GLB structure,
hashes and manifest records, no Trait Echo/environmental requests for held
traits, failed-family fallback, story-state projection, reduced motion, and
disposal. Then run:

```bash
node --test tests/friendsies-trait-probe.test.js
npm run assets:audit
npm run check
```

Complete the browser matrix in [`qa/README.md`](qa/README.md) with identical
baseline/pilot routes, day/dusk/night, high/low quality, reduced motion, failed
requests, save/reset, and both endings. Record same-device frame time and fresh
player observations before expanding beyond the opening route.

For a release candidate, follow [`release/README.md`](release/README.md) and run
the strict release audit against a fresh build. Never bypass an expected rights
blocker to make that command pass.
