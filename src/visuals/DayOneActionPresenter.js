/**
 * Presentation-only bridge for Day One action events.
 *
 * The frame clock and commit transaction continue if this presenter, the
 * skeletal clip, or the code-native fallback is unavailable.
 */
export class DayOneActionPresenter {
  constructor({
    getAnimator = null,
    reducedMotion = false,
    documentRoot = globalThis.document?.documentElement || null,
    onCommitCue = null,
    onFallbackCue = null,
  } = {}) {
    this.getAnimator = typeof getAnimator === 'function' ? getAnimator : () => null;
    this.reducedMotion = Boolean(reducedMotion);
    this.documentRoot = documentRoot;
    this.onCommitCue = typeof onCommitCue === 'function' ? onCommitCue : null;
    this.onFallbackCue = typeof onFallbackCue === 'function' ? onFallbackCue : null;
    this.activeId = null;
    this.activeAnimator = null;
    this.activeClipName = null;
    this.usingFallback = false;
    this.disposed = false;
  }

  handle(event) {
    if (this.disposed || !event) return false;
    try {
      if (event.type === 'start') {
        this._start(event);
      } else if (event.type === 'commit') {
        if (this.usingFallback) this.onFallbackCue?.(event);
        this.onCommitCue?.(event);
      } else if (event.type === 'progress') {
        if (this.usingFallback) this.onFallbackCue?.(event);
      } else if (event.type === 'complete' || event.type === 'cancel' || event.type === 'error') {
        if (this.usingFallback) this.onFallbackCue?.(event);
        this._finish(event.id);
      }
      return true;
    } catch (error) {
      console.warn('[DayOneActionPresenter] Presentation failed.', error);
      if (event.type === 'start') this._finish(event.id);
      return false;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this._finish(this.activeId);
    this.getAnimator = () => null;
    this.documentRoot = null;
    this.onCommitCue = null;
    this.onFallbackCue = null;
  }

  _start(event) {
    this.activeId = event.id;
    if (this.documentRoot?.dataset) this.documentRoot.dataset.dayOneAction = event.id;
    if (this.reducedMotion || !event.action.clipName) {
      this.usingFallback = true;
      this.onFallbackCue?.(event);
      return;
    }

    const animator = this.getAnimator();
    const clip = animator?.getClip?.(event.action.clipName);
    const sourceDuration = Number(clip?.duration);
    const timeScale = Number.isFinite(sourceDuration) && sourceDuration > 0
      ? sourceDuration / event.duration
      : 1;
    const played = animator?.playOneShot?.(event.action.clipName, {
      returnTo: 'idle',
      timeScale,
      fadeDuration: 0.12,
    });
    if (played) {
      this.activeAnimator = animator;
      this.activeClipName = event.action.clipName;
      return;
    }
    this.usingFallback = true;
    this.onFallbackCue?.(event);
  }

  _finish(id) {
    if (id && this.activeId && id !== this.activeId) return;
    const animator = this.activeAnimator;
    const clipName = this.activeClipName;
    this.activeAnimator = null;
    this.activeClipName = null;
    this.usingFallback = false;
    try {
      animator?.cancelOneShot?.(clipName, {
        returnTo: 'idle',
        fadeDuration: 0.12,
      });
    } catch (error) {
      console.warn('[DayOneActionPresenter] Failed to stop action animation.', error);
    }
    if (this.documentRoot?.dataset) delete this.documentRoot.dataset.dayOneAction;
    this.activeId = null;
  }
}

export default DayOneActionPresenter;
