---
schema: thornvale.qa-note/v1
subject: "friend:6602"
status: passed
baseline_commit: e95acb62838f052304cb8c9737c5023e7acb5b32
tags:
  - thornvale/qa
  - thornvale/character
  - friendsies
---

# Friend 6602 Preview — 2026-07-23

## Scope

Local story-room verification for [[../Characters/Friend 6602|Friend 6602]].
This is not a production deployment, physical-phone performance pass, or
authoritative game-state test.

## Automated gates

- Focused archive tests: 5/5 passed.
- Full repository test suite: 369/369 passed.
- Vite production build: passed.
- Distribution asset audit: passed.
- Production distribution remained 10,034,529 / 10,066,330 bytes because the
  archive is a local authoring tool and adds no runtime media.

## Desktop Chromium

Route:
`/story-archive/Preview/?id=friend%3A6602&mode=play`

- Reached `Ready · keyboard and touch input pilot` with a clean supported-route
  console.
- Rendered the complete colorful 6602 assembly with grounded shadow and card
  metadata for all seven verified traits.
- Read-only diagnostics reported `cardId: friend:6602`,
  `characterVisible: true`, 8 draw calls, and 13,030 rendered triangles for the
  character-plus-ground frame.
- `Space` produced `Jump · preview only`; the landing returned to Idle.
- Plant Seed was invoked from its action button and returned to Idle after the
  one-shot.
- The debug surface continued to report `writesAuthoritativeState: false`.

## iPhone 15 emulation

- The responsive card hid the desktop metadata rail and exposed the movement
  pad, drag-look hint, Jump, Action, and seven safe action buttons without
  horizontal clipping.
- Touch Jump produced `Jump · preview only`.
- Touch Action produced `Joy · preview only`.
- A bounded upward movement-pad drag moved the preview from `z = 0` to
  `z = -0.647425` with Walk active, then released to neutral.

This verifies the touch input pilot in browser emulation only. It does not claim
physical-device performance or full mobile support.

## Failure truth

Route:
`/story-archive/Preview/?id=friend%3A8914&mode=play`

- Failed visibly with `Unknown character card: friend:8914`.
- Changed the page title to `Character preview unavailable`.
- Hid the identity card and disabled every action.
- Did not load or display Friend 6602 as a fallback.
