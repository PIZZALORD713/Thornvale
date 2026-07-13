/**
 * Install code-native safety visuals only after the preferred fRiENDSiES load
 * chain has been exhausted. Keeping this decision at the composition boundary
 * preserves fRiENDSiES-first presentation while guaranteeing that a shared
 * GLTF or Draco failure cannot leave either playable story role invisible.
 */
export function recoverMissingCharacterVisuals({
  playerVisual = null,
  stewardVisual = null,
  storyEnabled = true,
  createFallback,
  installPlayer,
  installSteward,
} = {}) {
  let resolvedPlayer = playerVisual;
  let resolvedSteward = stewardVisual;
  let playerUsedSafeFallback = false;
  let stewardUsedSafeFallback = false;

  if (!resolvedPlayer) {
    resolvedPlayer = createAndInstallFallback('player', createFallback, installPlayer);
    playerUsedSafeFallback = true;
  }

  if (storyEnabled && !resolvedSteward) {
    resolvedSteward = createAndInstallFallback('steward', createFallback, installSteward);
    stewardUsedSafeFallback = true;
  }

  return {
    playerVisual: resolvedPlayer,
    stewardVisual: resolvedSteward,
    playerUsedSafeFallback,
    stewardUsedSafeFallback,
  };
}

function createAndInstallFallback(role, createFallback, installFallback) {
  if (typeof createFallback !== 'function' || typeof installFallback !== 'function') {
    throw new TypeError(`Missing ${role} safety-fallback wiring`);
  }

  const visual = createFallback(role);
  if (!visual) throw new Error(`The ${role} safety fallback returned no visual`);
  installFallback(visual);
  return visual;
}
