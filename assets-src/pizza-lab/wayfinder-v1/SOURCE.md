# Pizza Lab Wayfinder v1 Source

- Creator: Thornvale project
- Status: project-authored
- Canonical generator: `scripts/build-village-dressing.py`
- Editable source: `thornvale-wayfinder-authoring.blend`
- Blender version: 4.5.9 LTS
- Units / axes: meters, Blender +Z up and -Y front
- Runtime axes: glTF +Y up and +Z front
- External model, texture, font, scan, or audio inputs: none

`npm run pizza-lab:wayfinder:seed` creates the editable source from the
deterministic village-dressing generator. The source exposes exactly three
named board assemblies. Candidate export rebuilds the Wayfinder from that same
generator, applies only the recorded assembly transforms, consolidates meshes
by the ten reviewed project-authored materials, and exports a Draco-compressed
GLB.

Allowed board changes are bounded translation, Z rotation, and scale. The post,
stones, vine, leaves, flower, topology, and materials remain generator-owned.
The runtime position, collider, camera proxy, grass clearance, and interaction
contracts remain game-owned.
