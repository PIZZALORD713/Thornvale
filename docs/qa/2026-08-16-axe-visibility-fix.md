# Canonical Axe Visibility Fix

- Date: 2026-08-16
- Branch: `codex/path-remembers-you-v2`
- Scope: canonical fRiENDSiES `hand:Axe` pickup and woodcutting action presentation

## Root cause

The loader reported `canonical`, but the rigid skinned hand trait retained its
collection-armature offset. After cloning and rendering, the mesh landed several
metres away from the interaction anchor and below the world while the prompt
continued to work.

## Fix

- Reuse the existing rigid-trait frame-zero baker for both the Axe and fishing
  pole, then normalize each as centered static equipment.
- Present the Axe side-on and offset from the avatar on a small persistent
  chopping block so its head and handle remain readable at prompt distance.
- Keep the interaction anchor, ownership/equipment state, exact-once strike
  authority, canonical binary, and procedural fallback unchanged.

## Verification

- Fail-before regression proved the unbaked Axe was not centered static
  equipment; the fixed suite covers normalized bounds, canonical pickup/action
  orientation, the persistent empty station, and fallback behavior.
- `npm run check`: 390/390 tests, production build, and dist audit passed.
- `npm run assets:release`: passed at 10,065,911 / 10,066,330 bytes.
- Desktop Chromium at 800 x 806 reproduced the reported player position and
  showed the full canonical Axe on its chopping block.
- Touch Chromium at 390 x 844 showed the same readable pickup and labeled Pick
  action. Pick -> Chop produced one visible canonical swing, committed exactly
  one tree hit, hid the collected Axe, kept the empty station, and ended with
  zero console errors or warnings.

Screenshots and generated browser artifacts remain local under
`.playwright-cli/` and are not committed.
