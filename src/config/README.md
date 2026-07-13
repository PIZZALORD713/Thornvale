# Runtime configuration

This folder owns authored tuning values that compose reusable systems into the
Thornvale game. Keep engine behavior in its feature or `core` module; keep
world-specific numbers here so balancing does not require editing algorithms.

- `camera.js` defines outdoor camera framing, pitch, collision, and floor safety.
- `player-character.js` owns strict fRiENDSiES URL selection, generator deep
  links, and collection bounds.
- `assets.js` owns the reversible town-treatment and Trait Echo query selectors
  plus versioned runtime asset paths. The intended local composition is
  `assets=pilot&traits=v1`; `assets=baseline&traits=off` is the explicit and
  unknown-value rollback. Baseline retains the v0.3 procedural landmarks,
  64 static grass tufts, and six legacy butterflies instead of the authored
  plaza, breathing grass, and dragonfly treatment.
- `town.js` owns gameplay-facing positions, routes, collider envelopes, and
  interaction contracts.
- `trait-echoes.js` owns decorative fRiENDSiES trait families, semantic roles,
  placements, and visual budgets. It must not introduce gameplay contracts.
