# 2026-07-12 fRiENDSiES head emission QA

- Build/worktree: `codex/fix-friendsies-head-emission`, isolated from the dirty
  asset-overhaul checkout at `origin/main` commit `5e28cd6`.
- Scope and invariant: ordinary fRiENDSiES heads keep authored color, emissive,
  metalness, and roughness; only exact or declarative exceptions are changed.
- Reproduction: production `?friend=8` loaded head trait `Ye` with forced white
  emission at `0.22`, making its dark-brown texture read flat and pale.
- Fix: default no-op; exact streamed `Grey Cloud` and bundled declarative Grey
  Cloud/White Elephant retain white `0.22`, metalness `0.02`, roughness `0.92`.
- Browser: Chrome 150, macOS, 1200 × 919, DPR 1, low/high quality.
- Token `#8`: zero forced-white materials; dark-brown head and facial detail
  restored. Day and night paths loaded without console errors or warnings.
- Token `#1`: one reviewed Grey Cloud material retained the exception values.
- Token `#8914`: one reviewed White Elephant material retained the exception
  values required by Plan 2.0.
- Focused test: `node --test tests/friendsies-head-emission.test.js` — 3/3.
- Full check: `npm run check` — 45/45 tests and production build passed.
- Payload/runtime delta: no new binary, URL, request, draw, geometry, or
  manifest entry; material-selection code and tests only.
- Remaining limitation: the exception list is intentionally incomplete. Add a
  head only after exact-asset visual review; do not restore broad name matching.
