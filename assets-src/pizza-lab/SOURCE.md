# Pizza Lab ThornVale Staging Source

Pizza Lab stages existing project-authored runtime GLBs without changing their
geometry. The editable staging record is
`staging/thornvale-town-v1.json`; it stores runtime-space placement data and is
promoted into `src/content/generated/` only through the repository validator.

- Creator: ThornVale project
- Source geometry: `public/village/thornvale-village-dressing.glb`
- Geometry authorization: project-authored ThornVale asset
- Blender version: 4.5.9 LTS
- Units: meters
- Blender axes: +Z up, -Y authored front
- Runtime axes: +Y up, +Z front
- Rebuild/promotion: `npm run pizza-lab:promote`

The v1 trial makes only `wayfinder` publishable. `gardenArch` and `stoneWell`
are staging context and remain locked because they have broader ambient or
clearance consequences. Publishing changes placement data only; the source GLB,
materials, pivots, geometry, hashes, runtime URL, and procedural fallback remain
unchanged.
