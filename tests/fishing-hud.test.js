import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FISHING_GUIDE_STEPS,
  projectFishingGuidance,
} from '../src/ui/FishingHUD.js';

function state(phase, overrides = {}) {
  return {
    phase,
    active: !['landed', 'escaped'].includes(phase),
    tension: 0,
    landingProgress: 0,
    pulling: false,
    outcome: null,
    ...overrides,
  };
}

test('first-cast guidance exposes the complete four-step rhythm before the false nibble', () => {
  const guidance = projectFishingGuidance(state('cast'), { controlMode: 'desktop' });

  assert.equal(FISHING_GUIDE_STEPS.length, 4);
  assert.equal(guidance.stepIndex, 0);
  assert.match(guidance.instruction, /WAIT/i);
  assert.match(guidance.detail, /small nibble/i);
  assert.deepEqual(
    guidance.steps.map((step) => step.input),
    ['WAIT', 'TAP E', 'HOLD / RELEASE E', 'TAP E'],
  );
});

test('the false nibble and true bite are explicitly distinguished', () => {
  const nibble = projectFishingGuidance(state('false-nibble'));
  const bite = projectFishingGuidance(state('bite'));

  assert.equal(nibble.stepIndex, 0);
  assert.equal(nibble.tone, 'wait');
  assert.match(nibble.instruction, /small nibble/i);
  assert.match(nibble.detail, /do not press/i);
  assert.equal(bite.stepIndex, 1);
  assert.equal(bite.tone, 'action');
  assert.match(bite.instruction, /TAP E.*HOOK/i);
});

test('struggle guidance switches from hold to release before the line reaches red', () => {
  const reel = projectFishingGuidance(state('struggle', { tension: 0.32 }));
  const ease = projectFishingGuidance(state('struggle', { tension: 0.72, pulling: true }));

  assert.equal(reel.stepIndex, 2);
  assert.match(reel.instruction, /HOLD E/i);
  assert.equal(reel.danger, false);
  assert.match(ease.instruction, /RELEASE E/i);
  assert.equal(ease.danger, true);
  assert.match(ease.detail, /let the tension fall/i);
});

test('touch guidance names the visible action control and explains the final landing tap', () => {
  const bite = projectFishingGuidance(state('bite'), { controlMode: 'touch' });
  const landing = projectFishingGuidance(state('landing'), { controlMode: 'touch' });

  assert.match(bite.instruction, /TAP ACTION/i);
  assert.match(landing.instruction, /TAP ACTION.*LAND/i);
  assert.match(landing.detail, /final tap/i);
});

test('an escape explains the failed rule instead of only asking for another cast', () => {
  const guidance = projectFishingGuidance(state('escaped', {
    outcome: { kind: 'escaped', reason: 'line-broke' },
  }));

  assert.equal(guidance.tone, 'retry');
  assert.match(guidance.instruction, /line broke/i);
  assert.match(guidance.detail, /release .*before.*red/i);
});
