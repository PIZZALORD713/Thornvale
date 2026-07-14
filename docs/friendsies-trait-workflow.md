# fRiENDSiES environmental trait workflow

This is the design-and-engineering path for turning a large character-trait
catalog into a small, intentional Thornvale environment vocabulary. Canonical
fRiENDSiES assets and metadata already have standing project authorization under
[ADR 0004](decisions/0004-friendsies-project-wide-authorization.md). Catalog
presence, an attractive preview, or a successful geometry probe still does not
prove that a trait is the right variant, story fit, technical shape, or runtime
budget for Thornvale.

The workflow is:

```text
index -> atlas -> shortlist -> probe -> source/integrity record -> bundle -> place -> QA
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

This workflow does not expand the current milestone into a full-town
replacement, character builder, procedural trait scattering, new interactions,
a third ending, or collection-wide metadata as an environmental-trait runtime
source. Those remain outside the core-hook gate for product and engineering
reasons, not permission reasons. The shareable-player path may range-fetch one
non-bundled token and stream its character components under the same standing
authorization; its pin, origin, token range, fallback, and runtime role remain
machine-checked integrity constraints.

## 1. Index the pinned catalog

[`../assets-src/friendsies/trait-index.json`](../assets-src/friendsies/trait-index.json)
is a source-side review artifact, not a runtime manifest. It is derived from the
pinned fRiENDSiES metadata revision recorded in the index and preserves all
seven collection trait types. The bounded environmental curation sidecar
currently emphasizes `hand` and `sprout`; `backpiece` is also a valid source for
an authored Thornvale use. A trait is identified by the exact, case-sensitive key
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

Use the atlas to compare silhouettes, names, variants, and possible story jobs;
authorization is already settled. Do not infer technical compatibility from a
preview. Ask whether a trait supports a named landmark, story state, action, or
wayfinding job. Reject visually interesting objects that have no specific
opening-route responsibility.

## 3. Curate a bounded shortlist

[`../assets-src/friendsies/trait-curation.json`](../assets-src/friendsies/trait-curation.json)
is the manually reasoned decision layer. Every entry includes semantic tags, an
environment role, story phases, placement advice, rationale, and a curation
status. Rights are not adjudicated entry by entry; canonical collection material
inherits the `friendsies-project` authorization family.

Statuses mean:

- `active`: already used in the build with a complete source and technical
  contract.
- `shortlist`: worth variant, story-fit, geometry, performance, and placement
  review for a named use.
- `hold`: a catalog-confirmed reserve whose meaning, scope, timing, or technical
  shape does not support intake yet.

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
oriented, well-pivoted, attractive in Thornvale, or ready for its intended
runtime path.

## 5. Apply standing authorization and record source integrity

Before adding a new binary, identify the exact token evidence, trait type and
value, selected variant URL, original filename, original SHA-256, retrieval
date, creator or owning project, intended environmental adaptation, and the
exact transform and runtime role. Reference the shared `friendsies-project`
family and ADR 0004; do not write a new per-trait permission grant.

That standing authorization covers canonical current and future fRiENDSiES
revisions for integrated Thornvale characters, detached traits, hand items,
sprouts, backpieces, tools, equipment, props, environments, UI, documentation,
testing, promotional captures, streaming, local bundling or caching,
optimization, transformation, and derivative runtime assets. It does not cover
standalone packs, bulk raw collection mirrors or dumps, sublicensing, or reuse
outside Thornvale.

Exact catalog pins, approved origins, variant URLs, hashes, transforms, budgets,
fallbacks, and QA remain required because they make the selected result secure,
reproducible, bounded, and reversible. A changed revision or use may require
technical review and updated records, but not another permission decision.

When the evidence is sufficient, follow [`../assets-src/README.md`](../assets-src/README.md)
and the live [`../assets-src/asset-manifest.json`](../assets-src/asset-manifest.json).
Create adjacent source and runtime provenance records using the repository's
asset templates. The live manifest and audit own accepted statuses and byte
budgets; this workflow does not duplicate them.

## 6. Bundle only the selected, technically ready asset

Bundle the selected GLB under a stable, versioned `public/friendsies/` path.
Record final bytes and SHA-256 after the file is final. Add its exact manifest
entry, runtime context, `friendsies-project` family reference, transform record,
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

Add declarative placement and story meaning only after the binary and source-
integrity record agree. Preserve gameplay anchors, collider shapes, interaction IDs,
save fields, and authoritative story state. Visuals consume story state; they
do not create it.

For the current opening-route vocabulary:

- `Flower White` is a deliberate arrival gift or performed-kindness marker,
  never generic meadow filler.
- `Torch` guides at arrival and the Gate, then becomes Bell ritual and authority.
- `Crown Up` identifies the Ledger's civic office.
- `Friends Key`, if selected and technically ready, belongs as the Welcome Gate crest.
- `Book Of Ocean`, if selected and technically ready, belongs on the Ledger shelf.
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
the strict release audit against a fresh build. Fix source, transform, budget,
fallback, or QA failures rather than weakening their checks. A per-use
permission blocker on canonical fRiENDSiES material is stale policy and should
be migrated to the shared `friendsies-project` authorization.
