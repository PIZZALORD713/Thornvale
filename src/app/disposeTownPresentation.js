/**
 * Release town presentation systems in dependency order.
 *
 * Ambient life, trait echoes, and breathing grass may all register callbacks
 * with the shared world animator. Let each owner unregister and release its
 * resources before clearing the remaining animation registry.
 */
export function disposeTownPresentation({
  ambientLife = null,
  traitEchoes = null,
  breathingGrass = null,
  worldAnimator = null,
} = {}) {
  ambientLife?.dispose?.();
  traitEchoes?.dispose?.();
  breathingGrass?.dispose?.();
  worldAnimator?.clear?.();

  return {
    ambientLife: null,
    traitEchoes: null,
    breathingGrass: null,
    worldAnimator: null,
  };
}
