# ADR 0006: Pizza Lab Blender control boundary

- Status: Accepted for bounded pilot
- Date: 2026-07-19

## Context

ThornVale already has deterministic Blender 4.5.9 generators and an asset audit,
but it lacks a safe way for Codex to inspect or stage changes in an open Blender
session and reproduce the same operation headlessly. Blender Lab MCP was evaluated
separately, but its Blender 5.1 minimum and arbitrary-Python transport do not match
the production 4.5.9 pipeline or the desired production safety boundary.

## Decision

Adopt **Pizza Lab** as a reusable, independently implemented control layer. Its
typed Python command core is shared by the Blender add-on and headless entry point.
The Codex-facing MCP server exposes only allowlisted commands and never arbitrary
Python. Interactive requests use an authenticated localhost socket and enter a
queue drained by a Blender main-thread timer.

The v0.1 pilot permits scene inspection and validation, object-transform preview,
explicit transform application, and token-based transform undo. Object creation,
deletion, arbitrary script execution, asset publication, and terrain mutation are
not exposed. Terrain remains authoritative in `src/config/town.js` and
`src/utils/terrain-surface.js` until a shared visual/physics format is designed.
Headless v0.1 is read-only and may dry-run transforms; durable headless mutation
requires a later atomic, allowlisted output contract.

ThornVale is an adapter, not hard-coded product behavior. The adapter defines
units, axes, allowed write roots, terrain authority, and later export contracts.
Runtime placement, interactions, colliders, story IDs, and save data remain
authoritative outside Blender.

## Consequences

- Interactive and headless operations have one behavior contract.
- A non-empty session secret and localhost binding are mandatory.
- Mutations require `apply: true`; dry-run is the default.
- Objects should receive stable `pizza_lab_game_id` custom properties.
- Existing generator-owned `.blend` files remain generated artifacts and are not
  hand-edited by the pilot.
- Export and terrain authoring require later ADR amendments plus asset, physics,
  regression, browser, and rollback gates.
