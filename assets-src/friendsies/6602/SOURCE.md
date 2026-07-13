# fRiENDSiES #6602 source

## Ownership and permission

- Manifest family ID: `friendsies-6602`
- Creator or owning project: fRiENDSiES
- Intended status: `project-release-authorized`
- Source item page: <https://www.frienemies.xyz/fren/6602>
- Canonical metadata: <https://us-central1-devloper-eth.cloudfunctions.net/friendsies-v2a/metadata/6602.json>
- Pinned trait metadata revision: <https://gist.githubusercontent.com/IntergalacticPizzaLord/a7b0eeac98041a483d715c8320ccf660/raw/ce7d37a94c33c63e2b50d5922e0711e72494c8dd/fRiENDSiES>
- Retrieved: `2026-07-12`
- Project authorization: the project owner explicitly authorized the seven
  exact manifested runtime files derived from token `#6602` as Thornvale's
  bundled default player for publication in Thornvale builds on `2026-07-12`.
- Ownership check: `pizzalord.eth` resolved to `0x28af3356C6aaF449d20C59d2531941DDfB94d713`, and the collection profile listed token `#6602` for that address on `2026-07-12`.
- Raw-source redistribution allowed: `false`; canonical inputs remain external.
- Runtime distribution scope: integrated bundled Thornvale game builds only;
  no standalone character pack, collection-wide bundling, or outside-project
  reuse.
- Separate remote scope: ADR 0003 authorizes bounded player-avatar streaming
  under its own pinned catalog/range/origin contract; it does not broaden this
  exact local-file authorization.
- Release blocker: none for the exact manifested runtime files.

## Canonical inputs

| Trait | Original filename | Bytes | SHA-256 | Direct source |
| --- | --- | ---: | --- | --- |
| Ghostin backpiece | `e986156e7e3b6d7aedda377ca2e8347e.glb` | 225,016 | `e9d2ff362bef29efd863f0572fc25654be2971ec703c8ff3120f1d900debccdf` | <https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/e986156e7e3b6d7aedda377ca2e8347e.glb> |
| Pop body | `4b58d78f06903b5f89b80550bb48e2fd.glb` | 397,132 | `41381b4f9f2b0f515ec9dcb5653a219f6834025ee801fa7599de3a0be310101d` | <https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/4b58d78f06903b5f89b80550bb48e2fd.glb> |
| Romeo face | `88713c264c343b27acb1caf0ee7c261b.png` | 10,979 | `24d367fdee20235f189bd2e6227c2130c44948121135de2a8b9d9f15e2122200` | <https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/88713c264c343b27acb1caf0ee7c261b.png> |
| Staffv hand | `50dfb90473c3b5dec9376114e5784f6a.glb` | 216,924 | `b59937fd6263fd1986d2a20ec7e89fbf6d2049b59cf83b43569939f369713c68` | <https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/50dfb90473c3b5dec9376114e5784f6a.glb> |
| Deli head | `7b8d7f689e2536b2528c4c90e3c1a467.glb` | 462,984 | `bf921cc821b9c8ed210848c377a4ac850a794c4c73d69406fc045956ac84b8bb` | <https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/7b8d7f689e2536b2528c4c90e3c1a467.glb> |
| High Boots Red | `7294e598fe07bcc1af71ec277e640974.glb` | 245,308 | `5d4e6aed5b813fbaec251a64788d38fc2626e7872ecfafc0ed9e7c8414e891a2` | <https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/7294e598fe07bcc1af71ec277e640974.glb> |
| Totem sprout | `389aac45bac35bdcd5ce2a8b59feaf33.glb` | 330,752 | `b10bab8e4c4ca7b63a88b2b3ce9e50a3e6b05237e3aa838f5537b94e5c3bbd45` | <https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/389aac45bac35bdcd5ce2a8b59feaf33.glb> |

The original files are not checked into `assets-src/`. Their URLs, byte counts,
and hashes are the intake record.

## Rebuild or transform

- Canonical source of truth: the seven external files above.
- Tool: `@gltf-transform/cli 4.4.1` (`sharp` WebP encoder).
- Transform: each GLB's embedded textures are encoded as WebP at quality 92 and effort 100. The command decodes the existing Draco stream and writes the same 20-joint, one-primitive geometry without Draco. The face PNG is bundled unchanged.
- Runtime contract: six GLBs, six primitives, 12,356 triangles, one shared 20-joint naming contract, and the body `Idle Float.001` clip.

For each canonical GLB, run:

```bash
npx --yes @gltf-transform/cli@4.4.1 webp <canonical.glb> <runtime.glb> --quality 92 --effort 100
```

Then verify runtime hashes, the unchanged triangle totals, identical joint names,
and `EXT_texture_webp` support in the browser smoke pass.
