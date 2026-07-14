# Asset Overhaul Pilot Verification — 2026-07-12

> Historical authorization note: ADR 0004 superseded the narrow fRiENDSiES
> permission scopes in this record on 2026-07-13. Preserve the QA evidence
> below; canonical fRiENDSiES assets now share one standing Thornvale-wide grant.

> Permission update, 2026-07-12: `friendsies-animations` and the exact
> manifested local `friendsies-0001`, `friendsies-6602`, and
> `friendsies-8914` files and documented uses are now
> `project-release-authorized` for bundled Thornvale builds. The blocker results
> below are retained as historical output captured before those scoped grants;
> the separate arbitrary-token remote-streaming family is now also authorized
> under its pinned catalog, `1..10000` token range, recorded origin, and
> integrated in-game player-only contract.

> Historical note: this pass predates the local `#6602` default. The
> `avatar=local` routes below documented the removed procedural humanoid and are
> superseded by `docs/qa/2026-07-12-friendsies-6602-default.md`.

## Candidate

- Branch: `codex/asset-overhaul-test`
- Baseline: `origin/main` at `20503a73c570b198f1d6959c2e454158b25059ed`
- Pilot query: `?assets=pilot`
- Rollback query: `?assets=baseline`

## Automated verification

```text
npm run check
54 tests passed
Vite production build passed
Development asset audit passed
git diff --check passed
```

The production artifact is 7,727,222 bytes against the 8,388,608-byte cap.
The versioned arrival/plaza GLB is 326,584 bytes, 7,016 triangles, 30
primitives, and contains no textures.

`npm run assets:release` correctly fails for these explicitly blocked families:

- `friendsies-0001`
- `friendsies-8914`
- `friendsies-animations`

Those three blocker lines are historical. The current manifest clears the exact
local families without permitting raw or standalone redistribution and clears
the remote-player family without permitting collection bundling, mirroring,
environmental adaptation, or outside-project use.

The 2026-07-12 authorization refresh ran `npm run assets:release` successfully:
21 runtime files / 4,212,285 bytes, one authorized external dependency, and
production `dist` at 8,061,208 / 8,388,608 bytes. The original three-family
failure output above remains historical evidence rather than being rewritten.

## Browser smoke

Playwright CLI was run against local Vite with the offline avatar and low
quality preset.

| Route | Result |
| --- | --- |
| `?story=off&avatar=local&quality=low&assets=baseline` | Booted with the procedural v0.3 gate, Ledger, and Bell; no console errors. |
| `?story=off&avatar=local&quality=low&assets=pilot` | Booted with authored pilot roots; no console errors. |
| `?story=reset&avatar=local&quality=low&assets=pilot` | Opened the arrival letter and loaded Steward Lumen locally; no console errors. |

Day and debug-night screenshots were inspected locally under
`output/playwright/`. They are intentionally ignored and are not release
artifacts. The pilot improves the welcome threshold and makes the civic Ledger
and Bell read as one authored visual family. Story anchors and interaction
contracts remain unchanged.

## Remaining validation

- Run the baseline/pilot comparison with five fresh players.
- Capture same-device median and p95 frame time outside headless software
  rendering.
- Optimize further before admitting a CC0 support batch; only 661,386 bytes
  remain under the current total deployment cap.
- Keep the proposed `#431` Book/Friends Key trait composition excluded until its
  exact permission is recorded.
