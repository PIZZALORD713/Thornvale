# Default player fRiENDSiES #6602 runtime provenance

## Standing authorization

- Manifest family ID: `friendsies-project`
- Creator: fRiENDSiES
- License or permission: ADR 0004 grants standing project-wide authorization
  for present and future canonical fRiENDSiES assets in any integrated
  Thornvale role, without per-token, per-file, per-context, or per-transform
  approval.
- Release blocked: no
- Block reason: none
- Runtime distribution: permitted as integrated parts of Thornvale builds,
  tools, documentation, testing, and Thornvale promotion.
- Raw-source or standalone character-pack redistribution: prohibited by this
  record; canonical files remain external.
- Bulk raw collection mirrors, sublicensing, and reuse outside Thornvale are not
  granted. Exact source and runtime hashes remain engineering evidence.

## Runtime contract

| Runtime file | Canonical source | Transform | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| `backpiece-ghostin.glb` | `e986156e7e3b6d7aedda377ca2e8347e.glb` | WebP quality 92, effort 100 | 170,296 | `d7233348ebd29b3f743600cfa292aee5a65faf89231b9b95a26bce50a5760112` |
| `body.glb` | `4b58d78f06903b5f89b80550bb48e2fd.glb` | WebP quality 92, effort 100 | 236,084 | `aef864bd3b45024ce8499b0a398215e75b825ee337ebdb63c9a0a5d927500208` |
| `face-romeo.png` | `88713c264c343b27acb1caf0ee7c261b.png` | Bundled unchanged | 10,979 | `24d367fdee20235f189bd2e6227c2130c44948121135de2a8b9d9f15e2122200` |
| `hand-staffv.glb` | `50dfb90473c3b5dec9376114e5784f6a.glb` | WebP quality 92, effort 100 | 101,836 | `58fbd2ea47f3985fbd9e2f873cd785df79dbdd4cce8f0ee3ce83daecc8a60eea` |
| `head-deli.glb` | `7b8d7f689e2536b2528c4c90e3c1a467.glb` | WebP quality 92, effort 100 | 101,904 | `778e3cf66d58a5cae3a2427450040c0aae706436bb83deac63633cc6a47f4f54` |
| `shoes-high-boots-red.glb` | `7294e598fe07bcc1af71ec277e640974.glb` | WebP quality 92, effort 100 | 151,340 | `b7b9d795b2a010cbb94adeb38c33646e846f621fe95a7d48686cfccc255c0511` |
| `sprout-totem.glb` | `389aac45bac35bdcd5ce2a8b59feaf33.glb` | WebP quality 92, effort 100 | 116,408 | `da151889550b213de19b4194551c49b529af65d2ff284754ea5e979bae223ffa` |

- Runtime URLs: `/friendsies/6602/<file>`
- Format: glTF 2.0 binary with `EXT_texture_webp`; unchanged PNG face overlay.
- Payload: 888,847 bytes total.
- Geometry: six meshes/primitives and 12,356 triangles total.
- Skeleton: one skin and the same 20 named joints in every GLB; the body supplies `Idle Float.001`.
- Loader and placement owner: `src/visuals/CharacterLoader.js` and `src/visuals/VisualRig.js`.
- Default and fallback: `#6602` is the local default player. A failed player
  request falls back to local `#6602`, then local Steward `#8914`. A code-native
  emergency visual is allowed only after the bundled decoder or both local
  fRiENDSiES families fail, so total asset failure still reaches play.
- Known constraint: desktop Chromium-class browsers are the current target because the runtime GLBs require `EXT_texture_webp`.

The seven hashes above describe the current bundled default, not the boundary
of permission. New canonical fRiENDSiES files, roles, and delivery paths inherit
ADR 0004 without another approval, while raw standalone redistribution remains
excluded and every shipped file still needs source, integrity, budget,
fallback, and QA evidence.

## Verification

- Deterministic validation: `tests/friendsies-6602-assets.test.js`, `tests/friendsies-cast.test.js`, and `npm run assets:audit`.
- Browser gate: clean and network-blocked startup must show token `#6602`
  without the emergency visual or a failed local request; a separate total-
  bundled-family/decoder failure check must reach play with the emergency visual.
- Performance delta: pending the final same-device browser pass.
