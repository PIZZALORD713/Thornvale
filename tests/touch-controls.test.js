import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveControlMode } from '../src/config/controls.js';
import { InputManager } from '../src/core/InputManager.js';
import { TouchControls } from '../src/ui/TouchControls.js';

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(value, force) {
    if (force) this.values.add(value);
    else this.values.delete(value);
  }
}

class FakeTarget {
  constructor(rect = { left: 0, top: 0, width: 120, height: 120 }) {
    this.rect = rect;
    this.listeners = new Map();
    this.style = {};
    this.classList = new FakeClassList();
    this.hidden = false;
    this.inert = false;
    this.disabled = false;
    this.textContent = '';
    this.attributes = new Map();
    this.captured = new Set();
  }

  addEventListener(type, handler) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(handler);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, handler) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((entry) => entry !== handler));
  }

  dispatch(type, values = {}) {
    const event = {
      type,
      currentTarget: this,
      target: this,
      pointerId: values.pointerId ?? 1,
      clientX: values.clientX ?? 0,
      clientY: values.clientY ?? 0,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() {},
      ...values,
    };
    for (const handler of [...(this.listeners.get(type) ?? [])]) handler(event);
    return event;
  }

  setPointerCapture(pointerId) { this.captured.add(pointerId); }
  releasePointerCapture(pointerId) { this.captured.delete(pointerId); }
  hasPointerCapture(pointerId) { return this.captured.has(pointerId); }
  getBoundingClientRect() { return this.rect; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
}

function createHarness() {
  const ids = [
    'touchControls',
    'touchMoveZone',
    'touchMoveKnob',
    'touchLookZone',
    'touchJumpButton',
    'touchInteractButton',
    'touchInteractLabel',
    'touchHintButton',
  ];
  const elements = new Map(ids.map((id) => [id, new FakeTarget()]));
  elements.get('touchMoveZone').rect = { left: 0, top: 0, width: 120, height: 120 };
  const documentRef = new FakeTarget();
  documentRef.hidden = false;
  documentRef.getElementById = (id) => elements.get(id) ?? null;
  const windowRef = new FakeTarget();
  return { documentRef, windowRef, elements };
}

test('control mode uses explicit overrides and coarse touch capability', () => {
  assert.equal(resolveControlMode({ requested: 'touch' }), 'touch');
  assert.equal(resolveControlMode({ requested: 'desktop', maxTouchPoints: 5, coarsePointer: true }), 'desktop');
  assert.equal(resolveControlMode({ requested: 'auto', maxTouchPoints: 5, coarsePointer: true }), 'touch');
  assert.equal(resolveControlMode({ requested: 'auto', maxTouchPoints: 0, coarsePointer: true }), 'desktop');
  assert.equal(resolveControlMode({ requested: 'auto', maxTouchPoints: 5, coarsePointer: false }), 'desktop');
});

test('touch controls own move and look pointers independently and clear terminal state', () => {
  const { documentRef, windowRef, elements } = createHarness();
  const input = new InputManager();
  const controls = new TouchControls(input, { documentRef, windowRef }).init().setEnabled(true);
  const move = elements.get('touchMoveZone');
  const look = elements.get('touchLookZone');

  move.dispatch('pointerdown', { pointerId: 11, clientX: 120, clientY: 60 });
  look.dispatch('pointerdown', { pointerId: 22, clientX: 240, clientY: 160 });
  look.dispatch('pointermove', { pointerId: 22, clientX: 270, clientY: 145 });

  const movement = input.getMovementInput();
  assert.ok(movement.x > 0.99);
  assert.ok(Math.abs(movement.z) < 0.000001);
  assert.equal(input.isActionHeld('sprint'), true);
  const lookDelta = input.consumeLookDelta();
  assert.ok(lookDelta.x > 0);
  assert.ok(lookDelta.y < 0);

  move.dispatch('pointercancel', { pointerId: 11 });
  assert.deepEqual({ ...input.getMovementInput() }, { x: 0, z: 0 });
  assert.equal(input.isActionHeld('sprint'), false);

  controls.setEnabled(false);
  assert.equal(elements.get('touchControls').hidden, true);
  assert.equal(elements.get('touchControls').inert, true);
});

test('jump and interaction emit one semantic edge and interruption clears held state', () => {
  const { documentRef, windowRef, elements } = createHarness();
  const input = new InputManager();
  const controls = new TouchControls(input, { documentRef, windowRef }).init().setEnabled(true);
  const jump = elements.get('touchJumpButton');
  const interact = elements.get('touchInteractButton');

  jump.dispatch('pointerdown', { pointerId: 7 });
  jump.dispatch('pointerdown', { pointerId: 7 });
  assert.equal(input.isActionHeld('jump'), true);
  assert.equal(input.consumeActionPress('jump'), true);
  assert.equal(input.consumeActionPress('jump'), false);
  jump.dispatch('pointerup', { pointerId: 7 });
  assert.equal(input.isActionHeld('jump'), false);
  jump.dispatch('click', { detail: 1 });
  assert.equal(input.consumeActionPress('jump'), false);
  jump.dispatch('click', { detail: 0 });
  assert.equal(input.consumeActionPress('jump'), true);
  assert.equal(input.consumeActionPress('jump'), false);

  controls.setInteraction('Gather wood', true);
  assert.equal(interact.disabled, false);
  assert.equal(elements.get('touchInteractLabel').textContent, 'Gather wood');
  interact.dispatch('pointerdown', { pointerId: 17 });
  assert.equal(input.isActionHeld('interact'), true);
  assert.equal(input.consumeActionPress('interact'), true);
  assert.equal(input.consumeActionPress('interact'), false);
  interact.dispatch('pointerup', { pointerId: 17 });
  assert.equal(input.isActionHeld('interact'), false);

  interact.dispatch('click', { detail: 0 });
  assert.equal(input.consumeActionPress('interact'), true);
  assert.equal(input.consumeActionPress('interact'), false);

  jump.dispatch('pointerdown', { pointerId: 8 });
  interact.dispatch('pointerdown', { pointerId: 18 });
  windowRef.dispatch('blur');
  assert.equal(input.isActionHeld('jump'), false);
  assert.equal(input.isActionHeld('interact'), false);
  assert.deepEqual({ ...input.getMovementInput() }, { x: 0, z: 0 });

  controls.dispose();
});

test('the touch Hint button emits the same semantic objective-hint action as desktop H', () => {
  const { documentRef, windowRef, elements } = createHarness();
  const input = new InputManager();
  const controls = new TouchControls(input, { documentRef, windowRef }).init().setEnabled(true);
  const hint = elements.get('touchHintButton');

  assert.equal(hint.disabled, true);
  assert.equal(hint.hidden, false, 'Hint keeps a stable place in the touch action stack');
  controls.setHintAvailable(true);
  assert.equal(hint.disabled, false);
  assert.equal(hint.hidden, false);

  hint.dispatch('pointerdown', { pointerId: 31 });
  hint.dispatch('pointerdown', { pointerId: 31 });
  assert.equal(input.consumeActionPress('objective-hint'), true);
  assert.equal(input.consumeActionPress('objective-hint'), false);
  hint.dispatch('pointerup', { pointerId: 31 });
  hint.dispatch('click', { detail: 1 });
  assert.equal(input.consumeActionPress('objective-hint'), false);
  hint.dispatch('click', { detail: 0 });
  assert.equal(input.consumeActionPress('objective-hint'), true);
  assert.equal(input.consumeActionPress('objective-hint'), false);

  hint.dispatch('pointerdown', { pointerId: 32 });
  windowRef.dispatch('blur');
  assert.equal(hint.captured.size, 0);
  assert.equal(controls.hintPointerId, null);
  assert.equal(controls.hintAvailable, false, 'lifecycle cleanup clears stale projected availability');

  controls.setHintAvailable(true);
  controls.setHintAvailable(false);
  assert.equal(hint.disabled, true);
  assert.equal(hint.hidden, false);
  assert.equal(hint.attributes.get('aria-disabled'), 'true');
  controls.dispose();
});

test('every lifecycle interruption releases captured pointers and returns touch to neutral', () => {
  const { documentRef, windowRef, elements } = createHarness();
  const input = new InputManager();
  const controls = new TouchControls(input, { documentRef, windowRef }).init().setEnabled(true);
  const move = elements.get('touchMoveZone');
  const look = elements.get('touchLookZone');
  const jump = elements.get('touchJumpButton');
  const hint = elements.get('touchHintButton');
  controls.setHintAvailable(true);
  let pointerId = 40;

  const arm = () => {
    pointerId += 1;
    move.dispatch('pointerdown', { pointerId, clientX: 120, clientY: 60 });
    look.dispatch('pointerdown', { pointerId: pointerId + 50, clientX: 200, clientY: 200 });
    look.dispatch('pointermove', { pointerId: pointerId + 50, clientX: 220, clientY: 190 });
    jump.dispatch('pointerdown', { pointerId: pointerId + 100 });
    hint.dispatch('pointerdown', { pointerId: pointerId + 150 });
    assert.ok(input.getMovementInput().x > 0.99);
    assert.equal(input.isActionHeld('jump'), true);
  };
  const assertNeutral = () => {
    assert.deepEqual({ ...input.getMovementInput() }, { x: 0, z: 0 });
    assert.equal(input.isActionHeld('jump'), false);
    assert.deepEqual({ ...input.consumeLookDelta() }, { x: 0, y: 0 });
    assert.equal(move.captured.size, 0);
    assert.equal(look.captured.size, 0);
    assert.equal(jump.captured.size, 0);
    assert.equal(hint.captured.size, 0);
  };

  for (const type of ['resize', 'orientationchange', 'pagehide']) {
    arm();
    windowRef.dispatch(type);
    assertNeutral();
  }

  arm();
  documentRef.hidden = true;
  documentRef.dispatch('visibilitychange');
  assertNeutral();
  documentRef.hidden = false;

  arm();
  move.dispatch('lostpointercapture', { pointerId });
  assert.deepEqual({ ...input.getMovementInput() }, { x: 0, z: 0 });
  look.dispatch('lostpointercapture', { pointerId: pointerId + 50 });
  assert.deepEqual({ ...input.consumeLookDelta() }, { x: 0, y: 0 });
  jump.dispatch('lostpointercapture', { pointerId: pointerId + 100 });
  hint.dispatch('lostpointercapture', { pointerId: pointerId + 150 });
  assertNeutral();

  arm();
  controls.dispose();
  assertNeutral();
});
