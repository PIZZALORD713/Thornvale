# 2026-07-15 — Mobile controls mainline recovery

## Release decision

- State at candidate verification: release-ready branch
  `codex/mobile-controls-main`, based on `main` at `ca286c6`
- Owner decision: restore the previously tested mobile controls to the main
  project
- Release target: remote `main` and `https://thornvale.vercel.app`
- Capability claim: included touch input pilot; desktop Chromium remains the
  supported baseline and full mobile performance/support remains gated

The implementation was recovered from local commit `f87d972` rather than
recreated. It was transplanted onto current main so the early Ledger, corrected
fish spit, shelter recovery, and second-Bell camera work remained authoritative.

## Player-visible behavior

- Coarse touch hardware auto-selects a left analog movement stick, right-side
  drag look, outer-band sprint, Jump, and contextual Interact.
- The modern vertical action arc is default; `?controlsStyle=classic` restores
  the original touch presentation without forking input behavior.
- Story cards disable touch. Blur, visibility loss, pointer cancellation,
  resize, orientation, pass-out recovery, and disposal clear held state.
- The second-Bell focus shot clears held touch input and temporarily exposes a
  semantic Skip action. Desktop `E` uses that same exact-once edge.
- Apple browser-mode sessions explain Add to Home Screen and show one deferred
  first-rotation notice. Standalone mode suppresses browser-only guidance.

## Default and rollback

- Default: `?controls=auto&controlsStyle=modern`
- Force touch: `?controls=touch`
- Desktop rollback: `?controls=desktop`
- Touch-presentation rollback: `?controlsStyle=classic`
- Asset and trait rollbacks remain independent: `?assets=baseline` and
  `?traits=off`

## Packaging prerequisite

The first integrated build exceeded the fixed 8 MiB production cap by 15,308
bytes. The preserved `b8e32a5` transform minifies only the copied production
`draco_decoder.js` with compression and no identifier mangling. Checked-in
Three.js source, `/draco/` URLs, decoder API, WASM decoder, and wrapper stay
unchanged. A deterministic test decodes the bundled Steward body before and
after the transform to the same 2,800 points and 4,800 faces.

Current main's runtime-provenance document pruning remains active alongside the
decoder transform. The final candidate is `8,379,189 / 8,388,608` bytes, leaving
9,419 bytes of headroom without raising the budget.

## Verification

- Focused semantic-input regression failed before recovery and passes after it.
- The stale keyboard/semantic Bell edge regression failed before the rebase fix
  and passes after it.
- `npm run check`: PASS, 255/255 tests and production dist audit.
- `npm run assets:release`: PASS.
- `git diff --check`: PASS.
- Exact-build Chromium QA: PASS for modern portrait/landscape, classic,
  desktop, reduced motion, simulated Apple auto-detection, current Ledger touch
  interaction, pass-out clearing, and second-Bell Skip.
- Fresh single-session browser console: zero warnings and zero errors.

Detailed measurements and the physical-device gate are recorded in
[`../qa/2026-07-15-mobile-controls-mainline.md`](../qa/2026-07-15-mobile-controls-mainline.md).

## Publication

- Pull request: [`#21`](https://github.com/PIZZALORD713/Thornvale/pull/21),
  merged 2026-07-15
- Feature commit: `93c47d3e5c44cc746b1b3649c2f386a790195b76`
- Mainline merge commit: `719f23b89c0b2c8f15dd4d3ba26641d2250b1d1f`
- GitHub/Vercel production deployment: `5457506153`, successful at
  2026-07-15 13:05:22 UTC
- Immutable deployment URL:
  `https://thornvale-i4mpolw2i-pizzalords-projects.vercel.app`
- Production alias: `https://thornvale.vercel.app`
- Live application asset: `assets/index-CNX6_PYE.js`, matching the candidate
  build

Production smoke passed at 390x844 for touch entry, story-card blocking and
restore, simultaneous movement/look, outer-band sprint, and neutral release.
The modern and classic touch presentations both resolved correctly; the desktop
override kept touch hidden/inert and retained keyboard movement. Fresh sessions
reported zero warnings and zero errors. The manifest, all three retained
fRiENDSiES provenance URLs, and the minified Draco decoder returned HTTP 200;
the live decoder is the expected 487,515 bytes.
