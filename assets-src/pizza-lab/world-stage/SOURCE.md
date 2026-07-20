# ThornVale World Stage v1 source

The World Stage is a generated production view over existing ThornVale sources.
It does not introduce or redistribute new geometry.

- Creator: ThornVale project
- Source manifest: `thornvale-world-stage-v1.json`
- Runtime copy: `src/content/generated/thornvale-world-stage-v1.json`
- Source geometry:
  - `public/town/cottages/thornvale-cottages.glb`
  - `public/village/thornvale-village-dressing.glb`
  - `public/village/pilot/v1/thornvale-arrival-plaza.glb`
- Geometry authorization: existing project-authored ThornVale assets and their
  adjacent provenance records
- Blender version: 4.5.9 LTS
- Units: meters
- Runtime axes: +Y up, +Z front
- Blender axes: +Z up, -Y front
- Generated outputs: `output/pizza-lab/world-stage-v1.input.json` and
  `output/pizza-lab/thornvale-world-stage-v1.blend` (ignored)
- Rebuild: `npm run pizza-lab:world:build`
- Semantic verification: `npm run pizza-lab:world:verify`

The manifest pins the complete static `TOWN_LAYOUT` snapshot and SHA-256 hashes
for every imported GLB. The generated `.blend` is disposable and must not be
hand-maintained as a source of truth.
