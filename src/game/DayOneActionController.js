function asActionDefinition(value) {
  const id = String(value?.id || '').trim();
  const clipName = String(value?.clipName || '').trim();
  const duration = Number(value?.duration);
  const commitTime = Number(value?.commitTime);
  if (!id) throw new TypeError('Day One action requires an id');
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new TypeError(`${id} requires a positive duration`);
  }
  if (!Number.isFinite(commitTime) || commitTime < 0 || commitTime > duration) {
    throw new TypeError(`${id} commitTime must be inside its duration`);
  }
  return Object.freeze({
    ...value,
    id,
    clipName,
    duration,
    commitTime,
  });
}

function publicState(active, type) {
  return Object.freeze({
    type,
    action: active.definition,
    id: active.definition.id,
    elapsed: active.elapsed,
    duration: active.definition.duration,
    commitTime: active.definition.commitTime,
    progress: Math.min(1, active.elapsed / active.definition.duration),
    committed: active.committed,
  });
}

/**
 * Frame-driven transient clock for committed Day One performances.
 *
 * GameSession remains authoritative. This controller only decides when the
 * already-validated transaction callback runs, and marks the cue committed
 * before invoking it so slow frames and subscriber failures cannot duplicate
 * state.
 */
export class DayOneActionController {
  constructor({ control = null } = {}) {
    this.control = control;
    this.active = null;
    this.listeners = new Set();
    this.disposed = false;
  }

  get isActive() {
    return Boolean(this.active);
  }

  get snapshot() {
    return this.active ? publicState(this.active, 'snapshot') : null;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  run(definition, { onCommit = null, context = null } = {}) {
    if (this.disposed) return Promise.reject(new Error('DayOneActionController is disposed'));
    if (this.active) return Promise.reject(new Error(`Day One action already active: ${this.active.definition.id}`));

    const action = asActionDefinition(definition);
    return new Promise((resolve, reject) => {
      this.active = {
        definition: action,
        elapsed: 0,
        committed: false,
        commitResult: undefined,
        onCommit: typeof onCommit === 'function' ? onCommit : null,
        context,
        resolve,
        reject,
      };

      try {
        this._setControlLocked(true, this.active, { required: true });
      } catch (error) {
        this.active = null;
        reject(error);
        return;
      }
      this._emit(publicState(this.active, 'start'));
    });
  }

  update(dt) {
    const active = this.active;
    if (!active || this.disposed) return this;
    const delta = Number(dt);
    if (!Number.isFinite(delta) || delta <= 0) return this;

    active.elapsed = Math.min(active.definition.duration, active.elapsed + delta);
    if (!active.committed && active.elapsed >= active.definition.commitTime) {
      // Set this first. Even a throwing commit callback cannot be retried by a
      // later frame and accidentally transact twice.
      active.committed = true;
      try {
        const result = active.onCommit?.(publicState(active, 'commit'));
        if (result && typeof result.then === 'function') {
          throw new TypeError(`${active.definition.id} commit callback must be synchronous`);
        }
        active.commitResult = result;
        this._emit(publicState(active, 'commit'));
      } catch (error) {
        this._fail(active, error);
        return this;
      }
    }

    if (this.active === active) this._emit(publicState(active, 'progress'));
    if (this.active === active && active.elapsed >= active.definition.duration) {
      this.active = null;
      this._setControlLocked(false, active);
      const event = publicState(active, 'complete');
      this._emit(event);
      active.resolve(Object.freeze({
        ...event,
        cancelled: false,
        commitResult: active.commitResult,
      }));
    }
    return this;
  }

  cancel(reason = 'cancelled') {
    const active = this.active;
    if (!active) return false;
    this.active = null;
    this._setControlLocked(false, active);
    const event = Object.freeze({
      ...publicState(active, 'cancel'),
      reason: String(reason),
    });
    this._emit(event);
    active.resolve(Object.freeze({
      ...event,
      cancelled: true,
      commitResult: active.commitResult,
    }));
    return true;
  }

  dispose() {
    if (this.disposed) return;
    this.cancel('disposed');
    this.disposed = true;
    this.control = null;
    this.listeners.clear();
  }

  _fail(active, error) {
    if (this.active !== active) return;
    this.active = null;
    this._setControlLocked(false, active);
    this._emit(Object.freeze({
      ...publicState(active, 'error'),
      error,
    }));
    active.reject(error);
  }

  _setControlLocked(locked, active, { required = false } = {}) {
    const setter = this.control?.setActionLocked;
    if (typeof setter !== 'function') return;

    try {
      setter.call(this.control, Boolean(locked), {
        action: active?.definition ?? null,
        context: active?.context ?? null,
      });
    } catch (error) {
      if (required) throw error;
      console.warn('[DayOneActionController] Failed to release action controls.', error);
    }
  }

  _emit(event) {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.warn('[DayOneActionController] Presentation subscriber failed.', error);
      }
    }
  }
}

export default DayOneActionController;
