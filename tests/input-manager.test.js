import assert from 'node:assert/strict';
import test from 'node:test';

import { InputManager } from '../src/core/InputManager.js';

test('semantic input merges keyboard and touch movement without losing analog magnitude', () => {
  const input = new InputManager();
  input.keys.forward = true;
  input.setMovementInput('touch', 0.5, 0);

  const movement = input.getMovementInput();
  assert.ok(Math.abs(movement.x - 0.4472135955) < 0.000001);
  assert.ok(Math.abs(movement.z + 0.894427191) < 0.000001);

  input.clearInputSource('touch');
  assert.deepEqual({ ...input.getMovementInput() }, { x: 0, z: -1 });
});

test('semantic look and actions preserve hold state and consume presses exactly once', () => {
  const input = new InputManager();

  input.addLookDelta(0.24, -0.12, 'touch');
  assert.deepEqual({ ...input.consumeLookDelta() }, { x: 0.24, y: -0.12 });
  assert.deepEqual({ ...input.consumeLookDelta() }, { x: 0, y: 0 });

  input.setActionHeld('jump', true, 'touch');
  input.pressAction('jump', 'touch');
  input.pressAction('jump', 'touch');
  assert.equal(input.isActionHeld('jump'), true);
  assert.equal(input.consumeActionPress('jump'), true);
  assert.equal(input.consumeActionPress('jump'), false);

  input.addLookDelta(0.3, 0.1, 'touch');
  input.clearInputSource('touch');
  assert.equal(input.isActionHeld('jump'), false);
  assert.deepEqual({ ...input.consumeLookDelta() }, { x: 0, y: 0 });
});

test('semantic keyboard consumption cannot leave a stale physical action edge', () => {
  const input = new InputManager();
  input._onKeyDown({ code: 'Space', target: { tagName: 'BODY' } });
  input._onKeyDown({ code: 'KeyE', target: { tagName: 'BODY' } });
  input._onKeyDown({ code: 'KeyH', target: { tagName: 'BODY' } });

  assert.equal(input.consumeActionPress('jump'), true);
  assert.equal(input.consumeKeyPress('Space'), false);
  assert.equal(input.consumeActionPress('interact'), true);
  assert.equal(input.consumeKeyPress('KeyE'), false);
  assert.equal(input.consumeActionPress('objective-hint'), true);
  assert.equal(input.consumeKeyPress('KeyH'), false);
});

test('legacy keyboard consumption cannot leave a stale semantic action edge', () => {
  const input = new InputManager();
  input._onKeyDown({ code: 'Space', target: { tagName: 'BODY' } });
  input._onKeyDown({ code: 'KeyE', target: { tagName: 'BODY' } });
  input._onKeyDown({ code: 'KeyH', target: { tagName: 'BODY' } });

  assert.equal(input.consumeKeyPress('Space'), true);
  assert.equal(input.consumeActionPress('jump'), false);
  assert.equal(input.consumeKeyPress('KeyE'), true);
  assert.equal(input.consumeActionPress('interact'), false);
  assert.equal(input.consumeKeyPress('KeyH'), true);
  assert.equal(input.consumeActionPress('objective-hint'), false);
});

test('KeyH produces one objective-hint edge per physical key depression', () => {
  const input = new InputManager();
  const event = { code: 'KeyH', target: { tagName: 'BODY' } };

  input._onKeyDown(event);
  input._onKeyDown(event);
  assert.equal(input.consumeActionPress('objective-hint'), true);
  assert.equal(input.consumeActionPress('objective-hint'), false);

  input._onKeyDown(event);
  assert.equal(input.consumeActionPress('objective-hint'), false);
  input._onKeyUp(event);
  input._onKeyDown(event);
  assert.equal(input.consumeActionPress('objective-hint'), true);
  assert.equal(input.consumeActionPress('objective-hint'), false);
});

test('disabling gameplay clears every external source and rejects stale touch input', () => {
  const input = new InputManager();
  input.setMovementInput('touch', 0.75, -0.25);
  input.setActionHeld('sprint', true, 'touch');
  input.pressAction('interact', 'touch');
  input._onKeyDown({ code: 'KeyH', target: { tagName: 'BODY' } });
  input.addLookDelta(0.2, 0.1, 'touch');

  input.setGameplayEnabled(false);
  input.setMovementInput('touch', 1, -1);
  input.setActionHeld('jump', true, 'touch');
  input.pressAction('jump', 'touch');
  input.addLookDelta(1, 1, 'touch');

  assert.deepEqual({ ...input.getMovementInput() }, { x: 0, z: 0 });
  assert.deepEqual({ ...input.consumeLookDelta() }, { x: 0, y: 0 });
  assert.equal(input.isActionHeld('sprint'), false);
  assert.equal(input.isActionHeld('jump'), false);
  assert.equal(input.consumeActionPress('interact'), false);
  assert.equal(input.consumeActionPress('jump'), false);
  assert.equal(input.consumeActionPress('objective-hint'), false);
});
