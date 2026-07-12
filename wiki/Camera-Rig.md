# Camera Rig

## Goals

* Comfortable framing
* Smooth follow
* No clipping (initially avoid dense interiors)
* Never reveal the underside of the authored world stage

## MVP Settings (Draft)

* Distance: ~3–5m
* Height: ~1.2–1.6m
* Smoothing: position lerp + rotation damping

## Controls

* Mouse orbit
* Clamp pitch

## Runtime ownership

* `src/game/camera/CameraRig.js` owns orbit, collision, smoothing, and the hard floor invariant.
* `src/config/camera.js` owns Thornvale-specific framing and tuning values.
* `cozy_terrain_surface` participates in the camera raycast; terrain patches, hills, foliage, and particles do not.
* Detailed authored assets stay decorative for raycasts; invisible `camera_proxy_*` boxes represent their stable blocking mass.
* When a wall is closer than normal third-person framing allows, collision may compress below `minDistance`; the player and blocking visual hide temporarily so the view remains usable, then restore when the camera clears.
* The camera center must remain at or above `floorHeight + floorClearance` after reset and every smoothed update, even when no collision mesh is available.
