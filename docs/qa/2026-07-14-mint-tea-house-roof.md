# Mint Tea House Roof QA — 2026-07-14

## Player-visible regression

From the welcome gate, the mint tea house near the pawn showed stretched,
striped roof planes that flickered or changed shape as the camera moved. The
runtime material is opaque with depth testing enabled; the fault was authored
mesh topology, not a transparency or post-processing effect.

## Invariant and fail-before evidence

Every exported roof must be a closed solid with outward triangle winding. Both
ends of the tea-house main roof and veranda canopy must keep one consistent cap
normal, and the two roofs must remain visibly separated.

The original runtime GLB failed that invariant at the main-roof rear cap:

```text
every triangle on the roof cap at z=-2.550 must face out
actual:   [-1, 1]
expected: [-1]
```

The fixed-fan merge triangulation crossed the concave curled-eave profile and
created overlapping, inverted cap triangles. The original cross-section solid
also used inward face winding.

## Repair evidence

- Curled eaves now use a simple, closed perimeter with a shallow underside.
- Blender loop triangulation replaces the unsafe fixed fan.
- Roof solids export with outward winding, and the canopy clears the main roof,
  lintel, and support posts.
- Four clean Blender processes produced the same 564,844-byte runtime GLB:
  `af5afde73586fb7d4d72f6dff6b1d456e113cee1e4bda5e1c45f82497029326c`.
- Clean glTF re-import preserved all four origin/unit-scale cottage roots. The
  mint tea house contains 12 meshes, 7,700 triangles, and 3,978 vertices.
- Focused town-asset and asset-budget suites passed 19/19 tests.
- `npm run check` passed 214/214 tests, the production build, and the dist audit.
- `npm run assets:release` passed at 8,386,196 / 8,388,608 production bytes.

## Browser and release state

The rebuilt local asset rendered without the projected roof spike at the
welcome-gate view at the default viewport and 2560 x 1080. A deterministic
close-range WebGL orbit of the exact runtime GLB covered four cardinal yaw
angles plus high and low pitch views; the main roof, canopy, end caps, eaves,
undersides, and visible separation remained clean with no browser warnings or
errors.

PR #16 merged to `main` as
`b374456cdd84759b8abdf9114f47cd2b2add6844`. The main-branch CI run and Vercel
production deployment both passed. A cache-busted fetch from
`https://thornvale.vercel.app/town/cottages/thornvale-cottages.glb` returned the
expected 564,844 bytes and SHA-256
`af5afde73586fb7d4d72f6dff6b1d456e113cee1e4bda5e1c45f82497029326c`.
The production welcome-gate view rendered the repaired roof cleanly, and a
fresh direct-route browser smoke produced no warnings or errors. Because the
deployed GLB is byte-identical to the asset used for the close-range orbit, the
completed angle and pitch coverage applies to the live asset.
