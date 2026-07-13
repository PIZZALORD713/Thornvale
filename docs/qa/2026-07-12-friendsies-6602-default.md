# 2026-07-12 fRiENDSiES #6602 default-player QA

## Scope and decision gate

- Worktree: `codex/asset-overhaul-test`, dirty with pre-existing asset-overhaul work.
- Player-facing beat: the first visible player character on a clean load.
- Previous behavior: a procedural `KawaiiAvatar` rendered before token `#0001`, and `avatar=local` kept it permanently visible.
- Candidate: fRiENDSiES-first local `#6602` with an empty rig until it loads.
- Rollback/recovery: local `#6602`, then local Steward `#8914`; use the code-
  native emergency visual only after the bundled decoder or both local families
  fail.
- Gate: clean startup must render `#6602`, make no remote metadata request, and
  avoid the emergency visual. A separate total bundled-family/decoder failure
  must still reach playable state with that visual.

## Asset delta

- Added `#6602`: 888,847 bytes, six primitives, 12,356 triangles.
- Removed superseded `#0001` player-only body, face, head, and shoe files: 640,457 bytes.
- Retained `#0001` Flower White for Trait Echo v1: 295,916 bytes.
- Managed runtime media: 3,963,895 -> 4,212,285 bytes (`+248,390`).
- Production output: 7,795,025 -> 8,039,856 bytes (`+244,831`), below the 8,388,608-byte cap.

The six `#6602` GLBs were transformed with `@gltf-transform/cli 4.4.1`
using WebP quality 92 and effort 100. Tests confirm the source triangle counts,
20-joint names, and body idle clip remain intact.

## Automated evidence

| Command | Result | Notes |
| --- | --- | --- |
| Focused Node tests | PASS | 29/29 across cast, #6602 GLBs, asset budgets, and Trait Echo |
| `npm run build` | PASS | Vite 8.1.4; expected large-chunk advisory only |
| `npm run assets:audit -- --dist` | PASS for development | 8,039,856-byte production output |
| `npm run check` | PASS | 134 tests, build, and dist audit |
| `git diff --check` | PASS | Whitespace validation |

## Browser evidence

- Browser: Chromium 150 on macOS through Playwright CLI.
- Viewport: 1200 x 919 CSS pixels, DPR 1.
- Routes:
  - `?story=off&quality=low&assets=pilot&traits=off`
  - `?story=reset&quality=low&assets=pilot&traits=off`
- Clean sandbox load: player token `6602`, role `default-player`, visible, zero procedural-avatar scene objects, and zero console errors or warnings.
- Story load: player token `6602`, Steward token `8914`, character registry keys `player` and `steward`, and zero procedural-avatar scene objects.
- Network: all seven `#6602` files returned 200 from local `/friendsies/6602/` URLs. No collection Gist or remote model request occurred.
- Visual inspection: #6602's Deli head, Romeo face, Staffv, red boots, Totem sprout, and body rendered together at the spawn gate with stable ground contact.
- Failure recovery: forcing `/friendsies/6602/body.glb` to return 404 changed the player fallback to local token `#8914`; the scene still contained zero procedural-avatar objects.
- Retained screenshots remain ignored under `.playwright-cli/` and are not release artifacts.

## Open validation

- This targeted pass did not replay both complete story endings or capture a same-device frame-time profile.
- The exact local `#6602` runtime hashes are project-release-authorized for
  bundled Thornvale builds. That exact-file grant does not authorize
  raw/standalone assets. The separate remote-player family has its own bounded
  authorization and does not broaden the local `#6602` file grant.
