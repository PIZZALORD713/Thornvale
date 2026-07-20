# Pizza Lab Wayfinder v1 QA

- Date: 2026-07-20
- Beat: readable village navigation signage
- Exit criterion: a named Blender board-assembly edit can produce a versioned
  pilot GLB while browser placement, collider, interaction, and baseline
  rollback contracts remain unchanged

## Automated evidence

- `npm run pizza-lab:world:build`
- `npm run pizza-lab:world:verify`
- `npm run pizza-lab:wayfinder:export`
- `npm run pizza-lab:wayfinder:promote`
- `node --test tests/pizza-lab.test.js tests/town-assets.test.js tests/world-stage-manifest.test.js`
- `npm run assets:audit`
- `npm run check`
- `npm run assets:release`

The exporter rebuilt `VillageWayfinder` from the pinned generator, applied only
the three board assembly transforms, exported Draco GLB, and passed a clean
Blender 4.5.9 LTS re-import. The first art-directed revision exercises full
directional Z yaw and modest depth/height translation across all three signs.
Promotion independently validated 11 nodes, 10 meshes/primitives/materials,
1,488 triangles, grounding, finite nonzero geometry, and the 31,000-byte gate.
The final v1.1.0 GLB is 29,408 bytes with bounds 2.363 × 1.943 × 2.799 m and
SHA-256 `ff671fe0bbf5fc41431d778eccb01fc94c53def419050975a353b0031557f0bc`.
Loader tests cover pilot selection, baseline request suppression, and
candidate-only failure fallback.

## Browser evidence

Fresh headed Chromium smoke on Vite:

- `?assets=pilot&traits=off` requested the standalone Wayfinder with HTTP 200,
  then requested `draco_wasm_wrapper.js` and `draco_decoder.wasm` with HTTP 200.
- The pilot initialized the game world with zero console warnings and errors;
  cottage, village baseline, arrival/plaza, character, and animation assets also
  remained successful.
- Runtime inspection found `authored_wayfinder` at `(0, 0, -6.4)` with asset
  version `1.1.0`, the promoted SHA-256 above, and all 10 authored material
  children attached.
- `?assets=baseline&traits=off` initialized with zero console warnings and
  errors and did not request either the standalone Wayfinder or arrival/plaza
  pilot file.
- Automated loader assertions confirm both modes reuse
  `TOWN_LAYOUT.authoredProps.wayfinder` and that candidate failure preserves the
  baseline Wayfinder, Garden Arch, and Stone Well roots.

The checked-in pilot differs visibly from baseline through the three
artist-authored board positions and directions. A direct viewport check from the
arrival path confirmed all three pink boards render at their revised heights and
directional yaw around the unchanged post. Final art-direction acceptance remains
with the author in the headed pilot session.

The production asset release gate passed at 8,388,275 of 8,388,608 bytes. Only
333 bytes of deployment headroom remain, so any later candidate growth must
continue to pass the complete dist gate; the GLB family cap alone is not enough.

## Limitations

The pilot changes the three named board assembly transforms only. Text, mesh
topology, materials, post geometry, terrain, colliders, camera proxies, and
interaction contracts remain outside this authoring gate.
