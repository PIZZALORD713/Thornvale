# Pizza Lab v0.3

Pizza Lab is ThornVale's reusable Blender copilot foundation. It gives Codex a
small typed MCP surface for an open Blender application and uses the same command
implementation in headless Blender 4.5.9 LTS.

## Current tools

| Tool | Mutation |
| --- | --- |
| `pizza_scene_inspect` | None |
| `pizza_scene_validate` | None |
| `pizza_object_transform` | Only with `apply: true` |
| `pizza_transaction_undo` | Restores the token's exact prior transform |
| `pizza_terrain_contract` | None; terrain is context-only in v0.3 |
| `pizza_stage_load` | Rebuilds only the owned Blender staging collection |
| `pizza_stage_publish` | Writes the allowlisted placement candidate |
| `pizza_world_stage_load` | Rebuilds the complete resolved World Stage |

General creation, deletion, arbitrary Python, terrain mutation, and GLB publishing are
intentionally unavailable in this pilot. Placement publication is limited to the
allowlisted Wayfinder candidate.

## Install the Blender add-on

Zip the `pizza_lab` directory inside `tools/pizza-lab/blender_addon/`, then use
Blender **Edit > Preferences > Add-ons > Install from Disk**. The add-on supports
Blender 4.5 and newer.

In the add-on preferences:

1. Set the project adapter to
   `tools/pizza-lab/adapters/thornvale.json`.
2. Create a fresh random session token and keep it out of Git.
3. Leave the default port at `9877` unless it conflicts.
4. Press **Start Pizza Lab** in the 3D View sidebar only while actively using it.

The bridge binds only to `127.0.0.1`. Blender operations are queued and executed
by a main-thread timer.

This checkout includes an isolated launcher whose preferences and add-on scripts
do not touch the normal Blender 4.5 profile:

```bash
npm run pizza-lab:blender
```

## ThornVale full World Stage

Generate the complete disposable stage and open it in the isolated Blender
profile:

```bash
npm run pizza-lab:world:build
npm run pizza-lab:world:verify
npm run pizza-lab:blender -- output/pizza-lab/thornvale-world-stage-v1.blend
```

The stage contains the real ten GLB roots, exact shared Bell-hill mesh, resolved
path ribbons, static collision volumes, interaction radii, Day One stations,
story routes, grass exclusions, and environmental placement guides. The browser
and Blender scene are generated from the same versioned layout manifest. In an
already open Blender session, **Load Full World Stage** or
`pizza_world_stage_load` rebuilds the same owned collections.

`PL_ASSETS_EDITABLE` contains the reviewed authoring set.
`PL_ASSETS_CONTEXT`, `PL_TERRAIN_CONTEXT`, `PL_PATH_CONTEXT`,
`PL_CONTRACT_PROXIES`, and `PL_GUIDES` are locked reference collections. MCP
also rejects transforms on locked objects, even when addressed by a stable ID.

## Current publishable trial

The older three-prop stage remains available for a smaller placement-only trial:

```bash
npm run pizza-lab:stage
npm run pizza-lab:blender -- output/pizza-lab/thornvale-town-stage.blend
```

Only the `VillageWayfinder` root is currently selectable and publishable in
either scene. Move it on Blender X/Y, rotate around Blender Z, and keep Blender
Z=0 with unit scale.

Use **Publish Placement Candidate** in the Pizza Lab sidebar—or let Codex call
`pizza_stage_publish`—then promote and verify it:

```bash
npm run pizza-lab:promote
npm run check
```

The development server reloads the browser from the generated placement JSON.
The same `TOWN_LAYOUT.authoredProps.wayfinder` value drives the GLB visual,
static collider, camera proxy, and grass clearance, so those cannot drift apart.

## Register with Codex

From this worktree, register a disabled-at-rest MCP entry with environment values
for `PIZZA_LAB_TOKEN`, `PIZZA_LAB_PORT=9877`, and `PIZZA_LAB_MODE=interactive`:

```text
node tools/pizza-lab/mcp/server.mjs
```

Do not commit the token. Enable the entry only for an active session and stop the
Blender sidebar bridge afterward.

For headless calls, set `PIZZA_LAB_MODE=headless`, `PIZZA_LAB_BLENDER`, and,
when inspecting a file, `PIZZA_LAB_BLEND_FILE`. Headless v0.3 supports inspect,
validate, terrain-contract inspection, and transform dry-runs. It rejects apply
and undo because no approved atomic output/save contract exists yet.

## Object identity

Set a Blender custom property named `pizza_lab_game_id` on every controlled
object. Pizza Lab rejects missing targets and duplicate IDs. Display names remain
free to change.

## Verification

```bash
npm run pizza-lab:test
npm run pizza-lab:verify
npm run pizza-lab:world:build
npm run pizza-lab:world:verify
npm run check
```

The Blender verification creates a disposable factory scene, proves inspect,
dry-run, apply, undo, validation, and the terrain boundary, imports the real
village GLB, and round-trips runtime/Blender coordinates. It compares canonical
transforms, not `.blend` bytes.

## Current boundary and next gate

The full spatial context is present, but changing a Wayfinder child mesh (for
example sign-board size or height), publishing a modified source GLB, or editing
terrain is not yet admitted by v0.3. The next bounded gate is a versioned
Wayfinder asset-family candidate: export the isolated root, validate geometry and
source provenance, compare collider/clearance behavior, retain the current GLB as
rollback, and prove the browser result. Other objects become editable only after
their visual, physics, interaction, story, and ambient consumers have equivalent
promotion gates.
