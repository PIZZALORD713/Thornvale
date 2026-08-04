import { normalizeTouchStick, TOUCH_CONTROL_TUNING } from '../config/controls.js';

const TOUCH_SOURCE = 'touch';

/**
 * Projects touch gestures into InputManager's semantic control contract.
 * Movement, look, and action pointers are deliberately independent so a
 * player can steer, turn, and jump at the same time.
 */
export class TouchControls {
  constructor(inputManager, {
    documentRef = globalThis.document,
    windowRef = globalThis.window,
    tuning = TOUCH_CONTROL_TUNING,
  } = {}) {
    this.input = inputManager;
    this.document = documentRef;
    this.window = windowRef;
    this.tuning = { ...TOUCH_CONTROL_TUNING, ...tuning };
    this.elements = {};
    this.listeners = [];
    this.enabled = false;
    this.interactionAvailable = false;
    this.interactionLabel = '';
    this.hintAvailable = false;
    this.movePointerId = null;
    this.lookPointerId = null;
    this.jumpPointerId = null;
    this.interactPointerId = null;
    this.hintPointerId = null;
    this.lookPosition = { x: 0, y: 0 };
    this.sprinting = false;
  }

  init() {
    this.elements = {
      root: this.document?.getElementById?.('touchControls'),
      moveZone: this.document?.getElementById?.('touchMoveZone'),
      moveKnob: this.document?.getElementById?.('touchMoveKnob'),
      lookZone: this.document?.getElementById?.('touchLookZone'),
      jumpButton: this.document?.getElementById?.('touchJumpButton'),
      interactButton: this.document?.getElementById?.('touchInteractButton'),
      interactLabel: this.document?.getElementById?.('touchInteractLabel'),
      hintButton: this.document?.getElementById?.('touchHintButton'),
    };

    if (!this.elements.root) return this;

    this.syncVisualState();

    this.listen(this.elements.moveZone, 'pointerdown', (event) => this.onMoveStart(event));
    this.listen(this.elements.moveZone, 'pointermove', (event) => this.onMove(event));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.listen(this.elements.moveZone, type, (event) => this.onMoveEnd(event));
    }

    this.listen(this.elements.lookZone, 'pointerdown', (event) => this.onLookStart(event));
    this.listen(this.elements.lookZone, 'pointermove', (event) => this.onLook(event));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.listen(this.elements.lookZone, type, (event) => this.onLookEnd(event));
    }

    this.listen(this.elements.jumpButton, 'pointerdown', (event) => this.onJumpStart(event));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.listen(this.elements.jumpButton, type, (event) => this.onJumpEnd(event));
    }
    this.listen(this.elements.jumpButton, 'click', (event) => this.onJumpClick(event));
    this.listen(this.elements.interactButton, 'pointerdown', (event) => this.onInteractStart(event));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.listen(this.elements.interactButton, type, (event) => this.onInteractEnd(event));
    }
    this.listen(this.elements.interactButton, 'click', (event) => this.onInteractClick(event));
    this.listen(this.elements.hintButton, 'pointerdown', (event) => this.onHintStart(event));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.listen(this.elements.hintButton, type, (event) => this.onHintEnd(event));
    }
    this.listen(this.elements.hintButton, 'click', (event) => this.onHintClick(event));

    for (const type of ['blur', 'pagehide', 'resize', 'orientationchange']) {
      this.listen(this.window, type, () => this.clear());
    }
    this.listen(this.document, 'visibilitychange', () => {
      if (this.document.hidden) this.clear();
    });

    return this.setEnabled(false);
  }

  listen(target, type, handler) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler);
    this.listeners.push({ target, type, handler });
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled && this.elements.root);
    if (!this.enabled) this.clear();

    if (this.elements.root) {
      this.elements.root.hidden = !this.enabled;
      this.elements.root.inert = !this.enabled;
      this.elements.root.setAttribute?.('aria-hidden', String(!this.enabled));
    }
    return this;
  }

  setInteraction(label = 'Interact', available = false) {
    const nextAvailable = Boolean(available);
    const fullLabel = String(label || 'Interact').trim() || 'Interact';
    if (this.interactionAvailable === nextAvailable && this.interactionLabel === fullLabel) {
      this.projectState('interactionAvailable', nextAvailable);
      return this;
    }
    this.interactionAvailable = nextAvailable;
    this.interactionLabel = fullLabel;
    this.projectState('interactionAvailable', nextAvailable);
    if (this.elements.interactLabel) {
      this.elements.interactLabel.textContent = fullLabel.length > 18
        ? fullLabel.split(/\s+/)[0]
        : fullLabel;
    }
    if (this.elements.interactButton) {
      this.elements.interactButton.setAttribute?.('aria-label', fullLabel);
      this.elements.interactButton.disabled = !this.interactionAvailable;
      this.elements.interactButton.hidden = !this.interactionAvailable;
    }
    return this;
  }

  setHintAvailable(available = true) {
    this.hintAvailable = Boolean(available);
    this.projectState('hintAvailable', this.hintAvailable);
    if (this.elements.hintButton) {
      this.elements.hintButton.disabled = !this.hintAvailable;
      this.elements.hintButton.hidden = false;
      this.elements.hintButton.setAttribute?.('aria-disabled', String(!this.hintAvailable));
    }
    return this;
  }

  onMoveStart(event) {
    if (!this.enabled || this.movePointerId !== null) return;
    this.movePointerId = event.pointerId;
    this.projectState('moving', true);
    this.capture(event.currentTarget, event.pointerId);
    this.updateMovement(event);
    this.consumeEvent(event);
  }

  onMove(event) {
    if (!this.enabled || event.pointerId !== this.movePointerId) return;
    this.updateMovement(event);
    this.consumeEvent(event);
  }

  onMoveEnd(event) {
    if (event.pointerId !== this.movePointerId) return;
    this.release(event.currentTarget, event.pointerId);
    this.movePointerId = null;
    this.sprinting = false;
    this.projectState('moving', false);
    this.projectState('sprinting', false);
    this.input?.setMovementInput?.(TOUCH_SOURCE, 0, 0);
    this.input?.setActionHeld?.('sprint', false, TOUCH_SOURCE);
    this.centerMoveKnob();
    this.consumeEvent(event);
  }

  updateMovement(event) {
    const rect = this.elements.moveZone?.getBoundingClientRect?.();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
    const dx = Number(event.clientX) - centerX;
    const dy = Number(event.clientY) - centerY;
    const movement = normalizeTouchStick(dx, dy, radius, this.tuning.deadZone);

    this.input?.setMovementInput?.(TOUCH_SOURCE, movement.x, movement.z);
    if (!this.sprinting && movement.magnitude >= this.tuning.sprintOn) this.sprinting = true;
    if (this.sprinting && movement.magnitude <= this.tuning.sprintOff) this.sprinting = false;
    this.projectState('sprinting', this.sprinting);
    this.input?.setActionHeld?.('sprint', this.sprinting, TOUCH_SOURCE);

    if (this.elements.moveKnob) {
      const distance = Math.hypot(dx, dy);
      const clampedDistance = Math.min(radius * 0.58, distance);
      const scale = distance > 0 ? clampedDistance / distance : 0;
      this.elements.moveKnob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    }
  }

  onLookStart(event) {
    if (!this.enabled || this.lookPointerId !== null) return;
    this.lookPointerId = event.pointerId;
    this.lookPosition.x = Number(event.clientX) || 0;
    this.lookPosition.y = Number(event.clientY) || 0;
    this.capture(event.currentTarget, event.pointerId);
    this.consumeEvent(event);
  }

  onLook(event) {
    if (!this.enabled || event.pointerId !== this.lookPointerId) return;
    const x = Number(event.clientX) || 0;
    const y = Number(event.clientY) || 0;
    this.input?.addLookDelta?.(
      (x - this.lookPosition.x) * this.tuning.lookSensitivity,
      (y - this.lookPosition.y) * this.tuning.lookSensitivity,
      TOUCH_SOURCE,
    );
    this.lookPosition.x = x;
    this.lookPosition.y = y;
    this.consumeEvent(event);
  }

  onLookEnd(event) {
    if (event.pointerId !== this.lookPointerId) return;
    this.release(event.currentTarget, event.pointerId);
    this.lookPointerId = null;
    if (event.type !== 'pointerup') this.input?.clearLookInput?.(TOUCH_SOURCE);
    this.consumeEvent(event);
  }

  onJumpStart(event) {
    if (!this.enabled || this.jumpPointerId !== null) return;
    this.jumpPointerId = event.pointerId;
    this.projectState('jumpActive', true);
    this.capture(event.currentTarget, event.pointerId);
    this.input?.setActionHeld?.('jump', true, TOUCH_SOURCE);
    this.input?.pressAction?.('jump', TOUCH_SOURCE);
    this.consumeEvent(event);
  }

  onJumpEnd(event) {
    if (event.pointerId !== this.jumpPointerId) return;
    this.release(event.currentTarget, event.pointerId);
    this.jumpPointerId = null;
    this.projectState('jumpActive', false);
    this.input?.setActionHeld?.('jump', false, TOUCH_SOURCE);
    this.consumeEvent(event);
  }

  onJumpClick(event) {
    if (!this.enabled || Number(event.detail) !== 0) return;
    this.input?.pressAction?.('jump', TOUCH_SOURCE);
    this.consumeEvent(event);
  }

  onInteractStart(event) {
    if (!this.enabled || !this.interactionAvailable || this.interactPointerId !== null) return;
    this.interactPointerId = event.pointerId;
    this.projectState('interactionActive', true);
    this.capture(event.currentTarget, event.pointerId);
    this.input?.setActionHeld?.('interact', true, TOUCH_SOURCE);
    this.input?.pressAction?.('interact', TOUCH_SOURCE);
    this.consumeEvent(event);
  }

  onInteractEnd(event) {
    if (event.pointerId !== this.interactPointerId) return;
    this.release(event.currentTarget, event.pointerId);
    this.interactPointerId = null;
    this.projectState('interactionActive', false);
    this.input?.setActionHeld?.('interact', false, TOUCH_SOURCE);
    this.consumeEvent(event);
  }

  onInteractClick(event) {
    if (!this.enabled || !this.interactionAvailable || Number(event.detail) !== 0) return;
    this.input?.pressAction?.('interact', TOUCH_SOURCE);
    this.consumeEvent(event);
  }

  onHintStart(event) {
    if (!this.enabled || !this.hintAvailable || this.hintPointerId !== null) return;
    this.hintPointerId = event.pointerId;
    this.projectState('hintActive', true);
    this.capture(event.currentTarget, event.pointerId);
    this.input?.pressAction?.('objective-hint', TOUCH_SOURCE);
    this.consumeEvent(event);
  }

  onHintEnd(event) {
    if (event.pointerId !== this.hintPointerId) return;
    this.release(event.currentTarget, event.pointerId);
    this.hintPointerId = null;
    this.projectState('hintActive', false);
    this.consumeEvent(event);
  }

  onHintClick(event) {
    if (!this.enabled || !this.hintAvailable || Number(event.detail) !== 0) return;
    this.input?.pressAction?.('objective-hint', TOUCH_SOURCE);
    this.consumeEvent(event);
  }

  capture(target, pointerId) {
    try {
      target?.setPointerCapture?.(pointerId);
    } catch (_error) {
      // Pointer ownership still works through pointer ids when capture is not supported.
    }
  }

  release(target, pointerId) {
    try {
      if (target?.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
    } catch (_error) {
      // Losing capture is already a terminal state.
    }
  }

  consumeEvent(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
  }

  centerMoveKnob() {
    if (this.elements.moveKnob) this.elements.moveKnob.style.transform = 'translate(0px, 0px)';
  }

  projectState(name, active) {
    if (this.elements.root?.dataset) {
      this.elements.root.dataset[name] = String(Boolean(active));
    }
  }

  syncVisualState() {
    this.projectState('moving', this.movePointerId !== null);
    this.projectState('sprinting', this.sprinting);
    this.projectState('jumpActive', this.jumpPointerId !== null);
    this.projectState('interactionActive', this.interactPointerId !== null);
    this.projectState('interactionAvailable', this.interactionAvailable);
    this.projectState('hintActive', this.hintPointerId !== null);
    this.projectState('hintAvailable', this.hintAvailable);
    if (this.elements.interactButton) {
      this.elements.interactButton.disabled = !this.interactionAvailable;
      this.elements.interactButton.hidden = !this.interactionAvailable;
    }
    if (this.elements.hintButton) {
      this.elements.hintButton.disabled = !this.hintAvailable;
      this.elements.hintButton.hidden = false;
      this.elements.hintButton.setAttribute?.('aria-disabled', String(!this.hintAvailable));
    }
  }

  clear() {
    this.release(this.elements.moveZone, this.movePointerId);
    this.release(this.elements.lookZone, this.lookPointerId);
    this.release(this.elements.jumpButton, this.jumpPointerId);
    this.release(this.elements.interactButton, this.interactPointerId);
    this.release(this.elements.hintButton, this.hintPointerId);
    this.movePointerId = null;
    this.lookPointerId = null;
    this.jumpPointerId = null;
    this.interactPointerId = null;
    this.hintPointerId = null;
    this.sprinting = false;
    this.interactionAvailable = false;
    this.hintAvailable = false;
    if (this.elements.interactButton) {
      this.elements.interactButton.disabled = true;
      this.elements.interactButton.hidden = true;
    }
    if (this.elements.hintButton) {
      this.elements.hintButton.disabled = true;
      this.elements.hintButton.hidden = false;
      this.elements.hintButton.setAttribute?.('aria-disabled', 'true');
    }
    this.input?.clearInputSource?.(TOUCH_SOURCE);
    this.centerMoveKnob();
    this.syncVisualState();
    return this;
  }

  dispose() {
    this.setEnabled(false);
    for (const { target, type, handler } of this.listeners) {
      target.removeEventListener?.(type, handler);
    }
    this.listeners.length = 0;
  }
}
