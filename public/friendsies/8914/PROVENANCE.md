# Steward Lumen fRiENDSiES #8914 provenance

## Permission and release scope

- Manifest status: `project-release-authorized`
- Release blocked: no
- Authorization: the Thornvale project owner explicitly authorized the six
  exact manifested runtime files below as Steward Lumen and the documented
  Torch and Crown Up Trait Echo v1 uses for publication in Thornvale builds on
  `2026-07-12`.
- Runtime distribution: permitted only when integrated into bundled Thornvale
  game builds as Steward Lumen or in the documented Trait Echo v1 arrangement.
- Raw-source and standalone character or trait-pack redistribution: prohibited
  by this record; canonical source files remain external.
- General reuse outside Thornvale or collection-wide bundling: not granted;
  bounded remote in-game selection is authorized separately under ADR 0003.

These are the six traits referenced by the canonical fRiENDSiES metadata entry
for token `#8914`. They are bundled so the first-run steward does not depend on
downloading the full collection index before the opening scene.

| Runtime file | Trait | Source asset | SHA-256 |
| --- | --- | --- | --- |
| `body.glb` | Frosted Cloud Boy | `600f48634a2e9298a6e6d8dd6f3b60eb.glb` | `2bd4f3c4873c0ad98b933d0ca1723a86a5e2fa297e8fbbb5c4343e91b258a803` |
| `head-white-elephant.glb` | White Elephant | `9df9664cccd9444e49fce857f30aefa8.glb` | `717ddd9e9dc4e8268279d84bcacc5c9f4f06df4f964f4c76ee2df99b5efc663f` |
| `backpiece-pip.glb` | Pip | `92da33bd033be42d12fa769f9aa8c3e2.glb` | `ee6e2fd607578b539fb00a7b67616bfdcef420671e772b827591fef7ec347175` |
| `hand-torch.glb` | Torch | `b5b728235798d3920af800b4710f0219.glb` | `ddf53a25732ec6b43e81b3630d1be27b8157c18cfcd6835327c64f3f77ed0e7f` |
| `shoes-wrappers-gold.glb` | Wrappers Gold | `674388b8ed5be28011a558f30f97680b.glb` | `5e7e1529e4c4d75cd580703b835e7655856f10a56fae9fc8417095a90d21c55e` |
| `sprout-crown-up.glb` | Crown Up | `cc116d05ffb83fcc2a6285b5dbcaa613.glb` | `6b8875347d5f01d1701e63760c28e128607df19ef0c18659a3831b456b392f78` |

Source host: `https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/`

The project owner explicitly requested fRiENDSiES `#8914` as Thornvale's
starting steward on 2026-07-11, then publication with the live Thornvale build
on 2026-07-12. This project-specific authorization covers the bundled traits in
Thornvale; it does not grant general redistribution rights outside Thornvale.

## Trait Echo v1 environmental use

On 2026-07-12, the project owner also requested strategic use of fRiENDSiES
flowers, sprouts, and hand items in Thornvale's environment. Trait Echo v1
reuses `hand-torch.glb` for three mounted placements: paired sconces on the
Welcome Gate posts and one ritual sconce at the Town Bell. It reuses
`sprout-crown-up.glb` once as the Community Ledger crest. Each
rigid frame-zero pose is normalized in memory and rendered through one
instanced mesh per trait family; no derived binary is written or added to the
build.

Torch has one semantic job: civic guidance becoming dusk ritual and authority.
Crown Up has one semantic job: identity or office at the Ledger, with its
posture tilting during the anomaly, intervention, and alter states. A shared
code-native civic-mount draw physically grounds the three Torches and Crown as
sconces and a crest; it is Thornvale-authored geometry, not another fRiENDSiES
trait or binary. These arrangements are Thornvale-authored environmental
adaptations, not canonical tokens or new fRiENDSiES traits. `?traits=off`
removes the complete environmental treatment without changing the character.

This authorization is hash-bound to the six runtime files above and the
documented three-Torch/one-Crown Thornvale arrangement. It does not approve
other `#8914` files, other traits, arbitrary token streaming, or standalone
redistribution. The separate remote-player authorization in ADR 0003 does not
broaden this local-file or environmental grant.
