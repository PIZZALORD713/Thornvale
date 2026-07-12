# Camera feature

This slice owns third-person orbit behavior and its world-collision contract.

- `CameraRig.js` owns orbit math, smoothing, raycasts, and the non-negotiable
  floor-height invariant.
- `../../config/camera.js` owns Thornvale's authored framing and clearance.
- `../../../tests/unit/camera-rig.test.js` covers pitch direction, reset,
  smoothing, and the optional floor-constraint escape hatch.

World meshes opt out of camera collision with
`userData.cameraCollision = false`. The main meadow remains collidable; small
decorations opt out so they cannot make the camera pop toward the player.
