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
Blender 4.5.9 LTS re-import. Promotion independently validated 11 nodes, 10
meshes/primitives/materials, 1,488 triangles, grounding, finite nonzero geometry,
and the 31,000-byte gate. Loader tests cover pilot selection, baseline request
suppression, and candidate-only failure fallback.

## Browser evidence

Fresh headed Chromium smoke on Vite:

- `?assets=pilot&traits=off` requested the standalone Wayfinder with HTTP 200,
  then requested `draco_wasm_wrapper.js` and `draco_decoder.wasm` with HTTP 200.
- The pilot initialized the game world with zero console warnings and errors;
  cottage, village baseline, arrival/plaza, character, and animation assets also
  remained successful.
- `?assets=baseline&traits=off` initialized with zero console warnings and
  errors and did not request either the standalone Wayfinder or arrival/plaza
  pilot file.
- Automated loader assertions confirm both modes reuse
  `TOWN_LAYOUT.authoredProps.wayfinder` and that candidate failure preserves the
  baseline Wayfinder, Garden Arch, and Stone Well roots.

Because the checked-in transport candidate is deliberately a no-op, the pilot
and baseline are visually identical. Sign readability and post/camera feel need
fresh visual acceptance after the first art-directed board transform is applied.

The production asset release gate passed at 8,387,034 of 8,388,608 bytes. Only
1,574 bytes of deployment headroom remain, so any later candidate growth must
continue to pass the complete dist gate; the GLB family cap alone is not enough.

## Limitations

The checked-in v1 candidate is the canonical no-op baseline used to validate the
new transport. Earlier freeform mesh edits are not recoverable from the prior
material-consolidated source and must be reapplied to the named board assemblies
before exporting the first art-directed revision.
