# Mint Tea House Roof Hotfix — 2026-07-14

## Release

- Player-visible change: removes the stretched, striped, flickering roof planes
  on the mint tea house beside the welcome-gate pawn.
- Pull request: `#16` (`Fix mint tea house roof topology`).
- Production merge: `b374456cdd84759b8abdf9114f47cd2b2add6844` on `main`.
- Environment: Vercel production at `https://thornvale.vercel.app`.
- Main CI: `https://github.com/PIZZALORD713/Thornvale/actions/runs/29315642249`.

## Automated gates

- Focused town-asset and asset-budget tests: 19/19 passed.
- `npm run check`: 214/214 tests, Vite production build, and dist audit passed.
- `npm run assets:audit`: passed.
- `npm run assets:release`: passed at 8,386,196 / 8,388,608 production bytes.
- `npm audit --omit=dev --audit-level=high`: no vulnerabilities found.

## Production evidence

- The deployed cottage GLB is 564,844 bytes with SHA-256
  `af5afde73586fb7d4d72f6dff6b1d456e113cee1e4bda5e1c45f82497029326c`,
  matching the release candidate exactly.
- The live welcome-gate view rendered the roof without the original projected
  planes or flicker.
- The byte-identical candidate passed a close WebGL orbit at four cardinal yaw
  angles and high/low pitch, including the end caps, curled eaves, undersides,
  and the gap between the main roof and canopy.
- A fresh live direct-route smoke at
  `https://thornvale.vercel.app/?story=off&quality=high` produced no browser
  warnings or errors.

## Known constraints

- The production asset budget has 2,412 bytes of remaining headroom.
- Vite continues to report the existing non-blocking large-chunk warning.
- No remaining mint tea house roof limitation is known.
