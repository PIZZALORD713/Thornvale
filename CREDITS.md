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
Flower White Trait Echo source come from the fRiENDSiES collection. The project
owner authorized the exact manifested runtime files and their documented
Thornvale uses for publication in bundled Thornvale builds on 2026-07-12. They
are `project-release-authorized`, not CC0, public-domain, or generally reusable
assets. Raw-source, standalone character or trait-pack, collection-wide
bundling, and general outside-project redistribution remain prohibited by this
record. The separately authorized remote in-game selection path does not
broaden these local grants.

Trait Echo v1 reuses three of those already bundled files as environmental
story signals: `#0001` Flower White, plus `#8914` Torch and Crown Up. The seven
runtime placements are baked from the local GLBs in memory and instanced; no
new or modified fRiENDSiES binary is added for the treatment. These
Thornvale-authored arrangements are environmental adaptations, not canonical
fRiENDSiES tokens or new collection traits.

The exact `#0001` Flower White and `#8914` Torch and Crown Up runtime hashes and
the documented seven-placement Trait Echo v1 arrangement are included in that
Thornvale-only authorization. That exact-file grant does not extend to other
collection traits and is separate from the remote-player authorization below.

- `public/friendsies/0001/PROVENANCE.md`
- `public/friendsies/6602/PROVENANCE.md`
- `public/friendsies/8914/PROVENANCE.md`

The source-only trait index and local atlas reference the pinned collection
metadata, remote preview URLs, and remote asset URLs for casting research. They
do not copy the full collection into Thornvale or grant environmental runtime
approval. `Book Of Ocean`, `Friends Key`, `All Seeing`, and `Orb` may be
cataloged or curated there, but their assets are not bundled or loaded by Trait
Echo v1.

## fRiENDSiES remote player streaming

On 2026-07-12, the Thornvale project owner separately authorized published
Thornvale builds to fetch the revision-pinned fRiENDSiES catalog for token IDs
`1..10000` and stream, render, and assemble one selected token's components
from `https://storage.googleapis.com` as an integrated in-game player avatar.
The family is `project-release-authorized` under the exact manifest contract in
ADR 0003.

This grant does not permit full-collection bundling, canonical or raw copying,
mirroring, standalone asset or character packs, environmental reuse or
adaptation, sublicensing, unrelated-origin delivery, or reuse outside
Thornvale. It does not promote cataloged traits into Trait Echo or authorize
their local bundling.

## fRiENDSiES animations

The walk, joy-jump, and rumba clips are animation-only derivatives of source
files in `PIZZALORD713/animation_collection2` at commit
`f8286ef2c5421d54115afdafdac33f206533ac25`. The project owner requested their
use and publication in Thornvale. These exact hashed runtime derivatives are
`project-release-authorized` for bundled Thornvale game builds. That scoped
authorization does not permit raw-source or standalone animation-pack
redistribution and does not grant general reuse outside Thornvale. Adobe's
[Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) separately
permits royalty-free use of Mixamo-sourced motion in video games.

- `public/animations/PROVENANCE.md`

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
