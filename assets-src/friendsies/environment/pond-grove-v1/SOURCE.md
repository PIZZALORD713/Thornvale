# Pond–Grove Trait Echo v1 source record

Retrieved 2026-07-21 from the pinned fRiENDSiES catalog revision
`ce7d37a94c33c63e2b50d5922e0711e72494c8dd`, whose metadata SHA-256 is
`9f1c4e1cf8d848bd2ceaff7cde48c4ecf60a4b1d0afe273e7a5c5b68c2aee3ef`.
Canonical material inherits the standing `friendsies-project` authorization in
ADR 0004. Exact identity, integrity, budget, fallback, and QA remain release
gates.

| Runtime role | Exact trait | Token witness | Canonical asset | Bytes | SHA-256 |
| --- | --- | ---: | --- | ---: | --- |
| Rounded grove tree | `head:Carrot` | #952 | `52ace99054a82db5bb05d1213ec048a5.glb` | 286,216 | `497704b585c74c3d4b4a2eaf27d0f6bee2dd36b50144acea0d6c29172e5ed65e` |
| Mushroom landmark | `head:Earthworm` | #601 | `e87f8a5943a749d420354f24b5c913df.glb` | 359,232 | `3961eda5f0f194eadc07fe36f126478dc1b5275f11220d5dd44a5be19e03db0b` |
| Flowered bank | `head:Flower Hill` | #563 | `be68e9d400f5be45fc485bf18df85a68.glb` | 84,744 | `e2cc2e240b5894ca5fa6bfbccb216658c3c833a8063afec181a95b57cda165d8` |
| Grove growth endpoint | `sprout:Blooming Tree` | #563 | `832b32717ead69077ab86f57d169a203.glb` | 160,004 | `307dffcfacb8341c62284e1d572f823a83f061e951e459cfa529e3cccfc7f086` |
| Pond leaf | `sprout:Resting Green Leaf` | #1017 | `c3d4251fd07059dd4e8fced0b0ca631a.glb` | 89,740 | `91f4544d2ace120956416407a7afe29e00731bd8b2ac862c256a897740a398a5` |
| Fungal understory | `sprout:Purp Mush` | #404 | `e21213f839a1064cefa849551b6e6d5b.glb` | 57,888 | `75413d5aec8c59ae78a497a38d9a2ff749462e2a4a127415e6d98960ac6c4487` |

All six GLBs are bundled byte-for-byte from
`https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/<canonical asset>`.
The runtime performs an in-memory frame-zero rigid bake, height normalization,
and instancing; it does not rewrite the checked-in source binaries.

Rollback is `?traits=off`. That selector makes zero requests for the family and
leaves the procedural town and nature treatment in place.
