import test from 'node:test';
import assert from 'node:assert/strict';

import { HUD } from '../src/ui/HUD.js';

class FakeClassList {
  constructor(...values) {
    this.values = new Set(values);
  }

  add(...values) {
    values.forEach((value) => this.values.add(value));
  }

  remove(...values) {
    values.forEach((value) => this.values.delete(value));
  }

  contains(value) {
    return this.values.has(value);
  }
}

class FakeElement {
  constructor(...classes) {
    this.attributes = new Map();
    this.classList = new FakeClassList(...classes);
    this.style = {};
    this.textAssignments = 0;
    this._textContent = '';
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(value) {
    this._textContent = String(value);
    this.textAssignments += 1;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
}

function createHarness() {
  const hud = new HUD();
  hud.elements = {
    survival: new FakeElement('hidden'),
    nourishmentMeter: new FakeElement(),
    nourishmentFill: new FakeElement(),
    nourishmentLabel: new FakeElement(),
    energyMeter: new FakeElement(),
    energyFill: new FakeElement(),
    energyLabel: new FakeElement(),
    survivalWood: new FakeElement(),
    survivalFish: new FakeElement(),
    survivalSeeds: new FakeElement(),
    survivalAnnouncement: new FakeElement(),
  };
  return hud;
}

test('survival HUD projects supplied labels, essentials, and accessible meter values', () => {
  const hud = createHarness();

  hud.setSurvivalState({
    nourishment: {
      value: 64,
      max: 80,
      label: 'Comfortably fed',
      valueText: 'Comfortably fed, 64 of 80 nourishment',
    },
    energy: {
      value: 36,
      max: 60,
      label: 'Ready for light work',
      valueText: 'Ready for light work, 36 of 60 energy',
    },
    essentials: { wood: 6, fish: 1, seeds: 2 },
    announcement: 'Nourishment 64. Energy 36. Wood 6, fish 1, seeds 2.',
  });

  assert.equal(hud.elements.survival.classList.contains('hidden'), false);
  assert.equal(hud.elements.survival.getAttribute('aria-hidden'), 'false');

  assert.equal(hud.elements.nourishmentLabel.textContent, 'Comfortably fed');
  assert.equal(hud.elements.nourishmentMeter.getAttribute('aria-valuemin'), '0');
  assert.equal(hud.elements.nourishmentMeter.getAttribute('aria-valuemax'), '80');
  assert.equal(hud.elements.nourishmentMeter.getAttribute('aria-valuenow'), '64');
  assert.equal(
    hud.elements.nourishmentMeter.getAttribute('aria-valuetext'),
    'Comfortably fed, 64 of 80 nourishment',
  );
  assert.equal(hud.elements.nourishmentFill.style.width, '80%');

  assert.equal(hud.elements.energyLabel.textContent, 'Ready for light work');
  assert.equal(hud.elements.energyMeter.getAttribute('aria-valuemax'), '60');
  assert.equal(hud.elements.energyMeter.getAttribute('aria-valuenow'), '36');
  assert.equal(hud.elements.energyFill.style.width, '60%');

  assert.equal(hud.elements.survivalWood.textContent, '6');
  assert.equal(hud.elements.survivalFish.textContent, '1');
  assert.equal(hud.elements.survivalSeeds.textContent, '2');
  assert.equal(
    hud.elements.survivalAnnouncement.textContent,
    'Nourishment 64. Energy 36. Wood 6, fish 1, seeds 2.',
  );
});

test('survival HUD clamps meter display without inventing qualitative thresholds', () => {
  const hud = createHarness();

  hud.setSurvivalState({
    nourishment: {
      value: 140,
      max: 100,
      label: 'Director supplied upper state',
      valueText: 'Director supplied upper state',
    },
    energy: {
      value: -12,
      max: 100,
      label: 'Director supplied lower state',
      valueText: 'Director supplied lower state',
    },
    essentials: { wood: -4, fish: Number.NaN, seeds: 3.9 },
  });

  assert.equal(hud.elements.nourishmentMeter.getAttribute('aria-valuenow'), '100');
  assert.equal(hud.elements.nourishmentFill.style.width, '100%');
  assert.equal(hud.elements.nourishmentLabel.textContent, 'Director supplied upper state');
  assert.equal(hud.elements.nourishmentMeter.getAttribute('aria-valuetext'), 'Director supplied upper state');

  assert.equal(hud.elements.energyMeter.getAttribute('aria-valuenow'), '0');
  assert.equal(hud.elements.energyFill.style.width, '0%');
  assert.equal(hud.elements.energyLabel.textContent, 'Director supplied lower state');
  assert.equal(hud.elements.energyMeter.getAttribute('aria-valuetext'), 'Director supplied lower state');

  assert.equal(hud.elements.survivalWood.textContent, '0');
  assert.equal(hud.elements.survivalFish.textContent, '0');
  assert.equal(hud.elements.survivalSeeds.textContent, '3');
});

test('survival HUD announces only discrete supplied changes and hides when state is absent', () => {
  const hud = createHarness();
  const state = {
    nourishment: { value: 50, label: 'Settled' },
    energy: { value: 50, label: 'Steady' },
    essentials: { wood: 2, fish: 0, seeds: 1 },
    announcement: 'You gathered two wood.',
  };

  hud.setSurvivalState(state);
  const assignmentsAfterFirstUpdate = hud.elements.survivalAnnouncement.textAssignments;
  hud.setSurvivalState(state);

  assert.equal(hud.elements.survivalAnnouncement.textAssignments, assignmentsAfterFirstUpdate);

  hud.setSurvivalState({ ...state, announcement: 'You planted one seed.' });
  assert.equal(hud.elements.survivalAnnouncement.textAssignments, assignmentsAfterFirstUpdate + 1);
  assert.equal(hud.elements.survivalAnnouncement.textContent, 'You planted one seed.');

  hud.setSurvivalState(null);
  assert.equal(hud.elements.survival.classList.contains('hidden'), true);
  assert.equal(hud.elements.survival.getAttribute('aria-hidden'), 'true');
});
