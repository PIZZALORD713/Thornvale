# Asset credits and usage status

This file is a readable index, not a replacement for a license or permission
record. Exact runtime hashes and budget classifications live in
`assets-src/asset-manifest.json`.

## Thornvale project-authored work

- The favicon, cottage kit, village dressing kit, and arrival/plaza pilot are
  original Thornvale assets.
- Their editable sources and deterministic export notes live under
  `assets-src/`; runtime provenance lives beside each exported GLB. The village
  and pilot generator script is canonical, while its `.blend` is a generated
  review artifact.
- Usage is governed by `NOTICE.md` unless a file says otherwise.

## fRiENDSiES character traits

The bundled default player `#6602`, Steward Lumen `#8914`, and the `#0001`
Flower White Trait Echo source come from the fRiENDSiES collection. On
2026-07-13, the project owner established one standing `friendsies-project`
authorization for canonical fRiENDSiES assets and metadata under the owner's
control, including current and future canonical collection revisions, for any
integrated Thornvale use.
It is project authorization, not a claim that the collection is CC0,
public-domain, or generally reusable outside Thornvale.

The authorization covers local and remote avatars and NPCs, complete
characters, detached traits, hand items, sprouts, backpieces, tools, equipment,
props, environments, UI, documentation, testing, promotional captures,
streaming, selected-file local bundling or caching, optimization,
transformation, and derivative runtime assets. No new permission decision is
required per token, trait, role, context, transform, delivery method, or
canonical revision. Standalone asset or character packs, bulk raw collection
mirroring or dumps, sublicensing, raw-source redistribution as a separate
product, and reuse outside Thornvale remain excluded.

Trait Echo v1 reuses three of those already bundled files as environmental
story signals: `#0001` Flower White, plus `#8914` Torch and Crown Up. The seven
runtime placements are baked from the local GLBs in memory and instanced; no
new or modified fRiENDSiES binary is added for the treatment. These
Thornvale-authored arrangements are environmental adaptations, not canonical
fRiENDSiES tokens or new collection traits.

The current `#0001` Flower White and `#8914` Torch and Crown Up runtime hashes
and the documented seven-placement Trait Echo v1 arrangement are present
technical records under that shared authorization, not its outer boundary.

- `public/friendsies/0001/PROVENANCE.md`
- `public/friendsies/6602/PROVENANCE.md`
- `public/friendsies/8914/PROVENANCE.md`

The source-only trait index and local atlas reference the pinned collection
metadata, remote preview URLs, and remote asset URLs for casting research. They
do not copy the full collection into Thornvale. `Book Of Ocean`, `Friends Key`,
`All Seeing`, and `Orb` may be cataloged or curated there, but their assets are
not bundled or loaded by Trait Echo v1 because they have not passed the current
design and technical intake gate.

## fRiENDSiES remote player streaming

The current loader fetches one selected token from a revision-pinned catalog,
accepts token IDs `1..10000`, and loads component assets only from the approved
`https://storage.googleapis.com` origin. Those limits remain source-integrity,
security, payload, and fallback controls under the same `friendsies-project`
authorization; they are not a separate player-only permission grant.

See `docs/decisions/0004-friendsies-project-wide-authorization.md` for the
active project authorization and its exclusions. Exact runtime hashes and
dependency pins remain in `assets-src/asset-manifest.json`.

## fRiENDSiES animations

The walk, joy-jump, and rumba clips are animation-only derivatives of source
files in `PIZZALORD713/animation_collection2` at commit
`f8286ef2c5421d54115afdafdac33f206533ac25`. The six Story Actions v1 clips are
separate Mixamo-derived, animation-only outputs with their own pinned source and
conversion record. ADR 0005 supplies standing project-owner authorization for
these and all current or future animation sources and derivatives the owner
controls or may lawfully use in integrated Thornvale work. It removes repeat
approval per file, clip, pack, role, transform, or revision; it does not replace
or broaden upstream rights. Adobe's
[Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) separately
permits royalty-free use of Mixamo-sourced motion in video games.

Exact source commits or files, retrieval dates, hashes, transforms, runtime
scope, fallbacks, budgets, and QA remain in each animation family's source and
provenance records. Raw source redistribution, standalone animation or motion
packs, sublicensing, and use outside Thornvale remain excluded. Animation
provenance remains separate from canonical fRiENDSiES provenance under ADR 0004.

- `public/animations/PROVENANCE.md`
- `public/animations/story-actions-v1/PROVENANCE.md`
- `docs/decisions/0005-thornvale-animation-project-wide-authorization.md`

## Draco decoder

The local Draco decoder files are copied from Three.js `0.169.x`. Three.js is
available under the MIT License. See `public/draco/README.md` and the installed
package's `LICENSE` file for the complete terms.

## Reference-only files

The EXR and cotton-cloud PNG formerly stored in the repository have no verified
source or redistribution terms. They are absent from the current tree and may
not be restored or become runtime inputs until their permission record is
complete. Only their text tombstone remains under `assets-src/references/`.

## CC0 intake

No external CC0 asset has been admitted to the runtime build yet. Future CC0
imports must record the individual source page, direct download URL, creator,
license evidence and retrieval date, original and runtime hashes, transforms,
and raw-source redistribution status before the audit will allow them to ship.
