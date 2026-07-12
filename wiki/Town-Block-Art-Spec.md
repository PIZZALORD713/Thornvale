# Town Block Art Spec

## Scale

* 1 unit = 1 meter
* Player height ~1.7–1.8 units

## Layout Goals

* Keep the story plaza as the focal square with at least 4m of breathing room beyond its edge
* Place cottages in a readable outer ring with their own garden plots
* End approach paths at doorsteps rather than beneath building colliders
* Connect the districts with secondary garden walks and 2–3 landmarks
* Keep authored coordinates in `src/config/town.js` so visuals, physics, story routes, and tests agree

## Collider Authoring

* Use simple boxes for buildings
* Name colliders with prefix: `COL_`

## Export

* Export as `.glb`
* Apply transforms
* Keep textures reasonable (2K max for MVP)
* Author at local origin with the runtime facade facing +Z
* Keep simple Rapier boxes authoritative for collision during the current milestone

Blender 4.5 LTS source files live under `assets-src/`; optimized runtime exports live under `public/`. Rebuild the current kits from the repository root with:

```bash
/Applications/Blender-4.5-LTS.app/Contents/MacOS/Blender \
  --background --factory-startup \
  --python scripts/build-town-cottages.py

/Applications/Blender-4.5-LTS.app/Contents/MacOS/Blender \
  --background --factory-startup \
  --python scripts/build-village-dressing.py
```
