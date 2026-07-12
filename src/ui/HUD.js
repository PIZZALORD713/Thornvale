export class HUD {
  constructor() {
    this.elements = {};
    this.statusIdleTimer = null;
    this.overlayKeyboardHandler = null;
  }

  init() {
    this.elements = {
      status: document.getElementById('statusLine'),
      statusToast: document.querySelector('.status-toast'),
      dayNightBadge: document.getElementById('dayNightBadge'),
      phaseLabel: document.querySelector('#dayNightBadge .phase-label'),
      celestialIcon: document.querySelector('#dayNightBadge .celestial-icon'),
      prompt: document.getElementById('interactionPrompt'),
      resumeLook: document.getElementById('resumeLookButton'),
      kindness: document.getElementById('kindnessCounter'),
      kindnessValue: document.querySelector('#kindnessCounter .kindness-value'),
      lockOverlay: document.getElementById('lockOverlay'),
      debugPanel: document.getElementById('debug'),
      fps: document.getElementById('fps'),
      pos: document.getElementById('pos'),
      vel: document.getElementById('vel'),
      grounded: document.getElementById('grounded'),
      movementPhase: document.getElementById('movementPhase'),
      platform: document.getElementById('platform'),
      hover: document.getElementById('hover'),
      visOffsetY: document.getElementById('visOffsetY'),
    };

    this.hidePrompt();
    this.hideKindness();
    this.setDebugVisible(false);
    this.setDayNight(this.elements.dayNightBadge?.dataset.mode || 'day', false);
    this.enableOverlayKeyboardAccess();

    return this;
  }

  /**
   * Surface a short town update. The copy remains plain text so status messages
   * from gameplay are safe to display, while the surrounding card supplies the
   * animation and visual tone.
   */
  setStatus(text) {
    if (!this.elements.status) return;

    const message = String(text ?? '');
    this.elements.status.textContent = message;

    if (this.elements.statusToast) {
      const tone = /fail|error|unable/i.test(message)
        ? 'danger'
        : /ready|kindness recorded|heard you/i.test(message)
          ? 'ready'
          : 'info';

      this.elements.statusToast.dataset.tone = tone;
      this.restartAnimation(this.elements.statusToast, 'is-updating');

      window.clearTimeout(this.statusIdleTimer);
      this.statusIdleTimer = window.setTimeout(() => {
        this.elements.statusToast?.classList.remove('is-updating');
      }, 900);
    }
  }

  setDayNight(mode, animate = true) {
    if (!this.elements.dayNightBadge) return;

    const requestedMode = String(mode || 'day').toLowerCase();
    const normalizedMode = ['day', 'dusk', 'night'].includes(requestedMode)
      ? requestedMode
      : 'day';
    const label = normalizedMode === 'night'
      ? 'Night'
      : normalizedMode === 'dusk'
        ? 'Dusk'
        : 'Day';

    this.elements.dayNightBadge.dataset.mode = normalizedMode;
    this.elements.dayNightBadge.setAttribute('aria-label', `Current time: ${label}`);
    document.documentElement.dataset.phase = normalizedMode;

    if (this.elements.phaseLabel) {
      this.elements.phaseLabel.textContent = label;
    } else {
      // Maintains compatibility if the richer badge markup is not present.
      this.elements.dayNightBadge.textContent = label.toUpperCase();
    }

    if (this.elements.celestialIcon) {
      this.elements.celestialIcon.textContent = normalizedMode === 'night'
        ? '☾'
        : normalizedMode === 'dusk'
          ? '◐'
          : '☀';
    }

    if (animate) {
      this.restartAnimation(this.elements.dayNightBadge, 'is-changing');
    }
  }

  showPrompt(text) {
    if (!this.elements.prompt) return;

    const message = String(text ?? 'Interact');
    const match = message.match(/^Press\s+([^\s]+)\s*[—–-]\s*(.+)$/i);
    const key = match?.[1] || 'E';
    const action = match?.[2] || message;

    const spark = document.createElement('span');
    spark.className = 'prompt-spark';
    spark.setAttribute('aria-hidden', 'true');
    spark.textContent = '✦';

    const keyShell = document.createElement('span');
    keyShell.className = 'prompt-key-shell';

    const pressLabel = document.createElement('span');
    pressLabel.textContent = 'Press';

    const keycap = document.createElement('kbd');
    keycap.textContent = key;

    const actionLabel = document.createElement('span');
    actionLabel.className = 'prompt-action';
    actionLabel.textContent = action;

    keyShell.append(pressLabel, keycap);
    this.elements.prompt.replaceChildren(spark, keyShell, actionLabel);
    this.elements.prompt.setAttribute('aria-label', `Press ${key} to ${action}`);
    this.elements.prompt.setAttribute('aria-hidden', 'false');
    this.elements.prompt.classList.remove('hidden');
    this.restartAnimation(this.elements.prompt, 'is-changing');
  }

  hidePrompt() {
    if (!this.elements.prompt) return;
    this.elements.prompt.classList.add('hidden');
    this.elements.prompt.classList.remove('is-changing');
    this.elements.prompt.setAttribute('aria-hidden', 'true');
  }

  showKindness(value) {
    if (!this.elements.kindness) return;

    const displayValue = String(value ?? 0);
    const valueElement = this.elements.kindnessValue
      || this.elements.kindness.querySelector('.kindness-value');

    if (valueElement) {
      valueElement.textContent = displayValue;
      this.elements.kindnessValue = valueElement;
    } else {
      this.elements.kindness.textContent = `Kindness: ${displayValue}`;
    }

    this.elements.kindness.setAttribute('aria-label', `Kindness: ${displayValue}`);
    this.elements.kindness.classList.remove('hidden');
    this.restartAnimation(this.elements.kindness, 'is-changing');
  }

  hideKindness() {
    if (!this.elements.kindness) return;
    this.elements.kindness.classList.add('hidden');
    this.elements.kindness.classList.remove('is-changing');
  }

  setDebugVisible(visible) {
    if (!this.elements.debugPanel) return;

    const shouldShow = Boolean(visible);
    this.elements.debugPanel.style.removeProperty('display');
    this.elements.debugPanel.classList.toggle('is-visible', shouldShow);
    this.elements.debugPanel.setAttribute('aria-hidden', String(!shouldShow));
  }

  updateFPS(fps) {
    if (this.elements.fps) {
      this.elements.fps.textContent = String(fps ?? 0);
    }
  }

  updateDebug(info = {}) {
    if (this.elements.pos) this.elements.pos.textContent = info.position ?? '—';
    if (this.elements.vel) this.elements.vel.textContent = info.velocity ?? '—';
    if (this.elements.grounded) this.elements.grounded.textContent = info.grounded ? 'YES' : 'NO';
    if (this.elements.movementPhase) this.elements.movementPhase.textContent = info.phase ?? '—';
    if (this.elements.platform) this.elements.platform.textContent = info.platform ?? 'none';
    if (this.elements.hover) this.elements.hover.textContent = info.hover ?? '—';
    if (this.elements.visOffsetY) this.elements.visOffsetY.textContent = info.visOffsetY ?? '0.000';
  }

  enableOverlayKeyboardAccess() {
    if (!this.elements.lockOverlay || this.overlayKeyboardHandler) return;

    this.overlayKeyboardHandler = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      this.elements.lockOverlay.click();
    };

    this.elements.lockOverlay.addEventListener('keydown', this.overlayKeyboardHandler);
  }

  restartAnimation(element, className) {
    if (!element) return;
    element.classList.remove(className);
    // Reading offsetWidth flushes the style change so repeated game events
    // still receive their small piece of tactile UI feedback.
    void element.offsetWidth;
    element.classList.add(className);
  }
}
