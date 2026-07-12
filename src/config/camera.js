/**
 * Authored third-person camera tuning for Thornvale's outdoor stage.
 *
 * Keep world-specific values here; CameraRig itself stays reusable and owns
 * only safe defaults and behavior.
 */
export const THIRD_PERSON_CAMERA = Object.freeze({
  distance: 6.6,
  minDistance: 1.45,
  maxDistance: 11,
  collisionOffset: 0.62,
  collisionMinDistance: 0.12,
  playerHideDistance: 0.72,
  pivotHeight: 1.35,
  lookAtHeight: 0.95,
  shoulderOffset: 0.28,
  positionSharpness: 7.5,
  rotationSharpness: 10,
  minPitch: -0.5,
  maxPitch: 1.2,
  initialYaw: Math.PI,
  initialPitch: 0.12,
  floorHeight: 0.012,
  floorClearance: 0.45,
});

/** Apply the canonical tuning and resettable state to a CameraRig instance. */
export function configureCameraRig(cameraRig) {
  if (!cameraRig) return cameraRig;

  cameraRig.distance = THIRD_PERSON_CAMERA.distance;
  cameraRig.minDistance = THIRD_PERSON_CAMERA.minDistance;
  cameraRig.maxDistance = THIRD_PERSON_CAMERA.maxDistance;
  cameraRig.collisionOffset = THIRD_PERSON_CAMERA.collisionOffset;
  cameraRig.collisionMinDistance = THIRD_PERSON_CAMERA.collisionMinDistance;
  cameraRig.playerHideDistance = THIRD_PERSON_CAMERA.playerHideDistance;
  cameraRig.pivotHeight = THIRD_PERSON_CAMERA.pivotHeight;
  cameraRig.lookAtHeight = THIRD_PERSON_CAMERA.lookAtHeight;
  cameraRig.shoulderOffset = THIRD_PERSON_CAMERA.shoulderOffset;
  cameraRig.positionSharpness = THIRD_PERSON_CAMERA.positionSharpness;
  cameraRig.rotationSharpness = THIRD_PERSON_CAMERA.rotationSharpness;
  cameraRig.minPitch = THIRD_PERSON_CAMERA.minPitch;
  cameraRig.maxPitch = THIRD_PERSON_CAMERA.maxPitch;
  cameraRig.floorConstraintEnabled = true;
  cameraRig.floorHeight = THIRD_PERSON_CAMERA.floorHeight;
  cameraRig.floorClearance = THIRD_PERSON_CAMERA.floorClearance;
  cameraRig.yaw = THIRD_PERSON_CAMERA.initialYaw;
  cameraRig.pitch = THIRD_PERSON_CAMERA.initialPitch;
  return cameraRig;
}
