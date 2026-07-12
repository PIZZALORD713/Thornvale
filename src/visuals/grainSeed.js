// hash21 repeats when both input coordinates advance by 100 because its
// 123.34 and 456.21 multipliers then advance by whole numbers. Keeping the
// animated offset inside that period avoids long-session float precision loss
// without introducing a special jump at the wrap boundary.
export const GRAIN_SEED_PERIOD = 100;

export function advanceGrainSeed(seed, dt, rate) {
  const safeSeed = Number.isFinite(seed) ? seed : 0;
  const safeDt = Number.isFinite(dt) ? dt : 0;
  const safeRate = Number.isFinite(rate) ? rate : 0;
  const wrapped = (safeSeed + safeDt * safeRate) % GRAIN_SEED_PERIOD;
  return wrapped < 0 ? wrapped + GRAIN_SEED_PERIOD : wrapped;
}
