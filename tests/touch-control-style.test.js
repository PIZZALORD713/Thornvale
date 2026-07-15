import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { InputManager } from '../src/core/InputManager.js';
import { TouchControls } from '../src/ui/TouchControls.js';

class FakeTarget {
  constructor(rect = { left: 0, top: 0, width: 120, height: 120 }) {
    this.rect = rect;
    this.listeners = new Map();
    this.style = {};
    this.dataset = {};
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
  ];
  const elements = new Map(ids.map((id) => [id, new FakeTarget()]));
  const documentRef = new FakeTarget();
  documentRef.hidden = false;
  documentRef.getElementById = (id) => elements.get(id) ?? null;
  const windowRef = new FakeTarget();
  return { documentRef, windowRef, elements };
}

function buttonMarkup(html, id) {
  const idIndex = html.indexOf(`id="${id}"`);
  assert.notEqual(idIndex, -1, `Expected #${id} in index.html`);
  const start = html.lastIndexOf('<button', idIndex);
  const end = html.indexOf('</button>', idIndex);
  assert.ok(start >= 0 && end > idIndex, `Expected complete #${id} button markup`);
  return html.slice(start, end + '</button>'.length);
}

function matchingMediaBlocks(source, queryPattern) {
  const blocks = [];
  const mediaPattern = /@media\s*([^\{]+)\{/g;
  for (const match of source.matchAll(mediaPattern)) {
    if (!queryPattern.test(match[1])) continue;
    const openIndex = match.index + match[0].lastIndexOf('{');
    let depth = 1;
    let cursor = openIndex + 1;
    while (cursor < source.length && depth > 0) {
      if (source[cursor] === '{') depth += 1;
      if (source[cursor] === '}') depth -= 1;
      cursor += 1;
    }
    blocks.push(source.slice(openIndex + 1, cursor - 1));
  }
  return blocks;
}

function assertProjectedState(root, expected) {
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(root.dataset[key], String(value), `Expected data-${key}=${value}`);
  }
}

test('touch-control style defaults safely to modern and exposes classic only by explicit request', async () => {
  const controlsConfig = await import('../src/config/controls.js');
  assert.equal(
    typeof controlsConfig.resolveTouchControlStyle,
    'function',
    'controls config must export resolveTouchControlStyle',
  );

  const resolve = controlsConfig.resolveTouchControlStyle;
  assert.equal(resolve(), 'modern');
  assert.equal(resolve({}), 'modern');
  assert.equal(resolve({ requested: 'modern' }), 'modern');
  assert.equal(resolve({ requested: 'unknown-pilot' }), 'modern');
  assert.equal(resolve({ requested: 'classic' }), 'classic');
  assert.equal(resolve({ requested: 'CLASSIC' }), 'classic');
});

test('mobile action markup provides themed rollback, inline icons, and interaction-first vertical order', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const modernSelector = /html\[data-touch-style\s*=\s*["']modern["']\][^\{]*\.touch-[^\{]*\{[^\}]*:[^\}]*\}/s;
  const classicSelector = /html\[data-touch-style\s*=\s*["']classic["']\][^\{]*\.touch-[^\{]*\{[^\}]*:[^\}]*\}/s;

  assert.ok(
    modernSelector.test(html),
    'modern touch styling must be explicitly keyed by data-touch-style',
  );
  assert.ok(
    classicSelector.test(html),
    'classic rollback styling must be explicitly keyed by data-touch-style',
  );

  const interactMarkup = buttonMarkup(html, 'touchInteractButton');
  const jumpMarkup = buttonMarkup(html, 'touchJumpButton');
  assert.match(interactMarkup, /<svg\b[\s\S]*<\/svg>/, 'Interact must include an inline SVG icon');
  assert.match(jumpMarkup, /<svg\b[\s\S]*<\/svg>/, 'Jump must include an inline SVG icon');

  const controlsStart = html.indexOf('id="touchControls"');
  const controlsEnd = html.indexOf('id="debug"', controlsStart);
  const controlsMarkup = html.slice(controlsStart, controlsEnd);
  assert.ok(
    controlsMarkup.indexOf('id="touchInteractButton"') < controlsMarkup.indexOf('id="touchJumpButton"'),
    'Interaction must precede Jump in the action stack',
  );

  const actionRules = [...html.matchAll(/[^\{\}]*\.touch-actions[^\{\}]*\{([^\{\}]*)\}/g)]
    .map((match) => match[1]);
  const hasVerticalStack = actionRules.some((rule) => (
    /flex-direction\s*:\s*column\s*(?:;|$)/.test(rule)
    || /flex-flow\s*:\s*column(?:\s|;|$)/.test(rule)
    || (/display\s*:\s*grid\s*(?:;|$)/.test(rule) && !/grid-template-columns\s*:[^;]*\s2\b/.test(rule))
  ));
  assert.equal(hasVerticalStack, true, 'Touch actions must form a vertical stack');
});

test('premium touch controls retain reduced-motion and high-contrast affordances', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const touchSelector = /\.touch-(?:controls|move|stick|actions?|action)/;
  const reducedMotion = matchingMediaBlocks(html, /prefers-reduced-motion\s*:\s*reduce/);
  const highContrast = matchingMediaBlocks(
    html,
    /(?:prefers-contrast\s*:\s*more|forced-colors\s*:\s*active)/,
  );

  assert.ok(
    reducedMotion.some((block) => touchSelector.test(block)),
    'Reduced-motion media coverage must include a touch-control selector',
  );
  assert.ok(
    highContrast.some((block) => touchSelector.test(block)),
    'High-contrast media coverage must include a touch-control selector',
  );
});

test('touch controls project movement, sprint, jump, and interaction state onto their root', () => {
  const { documentRef, windowRef, elements } = createHarness();
  const input = new InputManager();
  const controls = new TouchControls(input, { documentRef, windowRef }).init().setEnabled(true);
  const root = elements.get('touchControls');
  const move = elements.get('touchMoveZone');
  const jump = elements.get('touchJumpButton');

  assertProjectedState(root, {
    moving: false,
    sprinting: false,
    jumpActive: false,
    interactionAvailable: false,
  });

  move.dispatch('pointerdown', { pointerId: 11, clientX: 120, clientY: 60 });
  assertProjectedState(root, { moving: true, sprinting: true });
  move.dispatch('pointermove', { pointerId: 11, clientX: 80, clientY: 60 });
  assertProjectedState(root, { moving: true, sprinting: false });
  move.dispatch('pointerup', { pointerId: 11 });
  assertProjectedState(root, { moving: false, sprinting: false });

  jump.dispatch('pointerdown', { pointerId: 12 });
  assertProjectedState(root, { jumpActive: true });
  jump.dispatch('pointerup', { pointerId: 12 });
  assertProjectedState(root, { jumpActive: false });

  controls.setInteraction('Gather wood', true);
  assertProjectedState(root, { interactionAvailable: true });
  controls.setInteraction('Gather wood', false);
  assertProjectedState(root, { interactionAvailable: false });
});

test('terminal lifecycle resets clear every projected touch-control state', () => {
  const { documentRef, windowRef, elements } = createHarness();
  const input = new InputManager();
  const controls = new TouchControls(input, { documentRef, windowRef }).init().setEnabled(true);
  const root = elements.get('touchControls');
  const move = elements.get('touchMoveZone');
  const jump = elements.get('touchJumpButton');

  const armAllStates = (pointerBase) => {
    move.dispatch('pointerdown', { pointerId: pointerBase, clientX: 120, clientY: 60 });
    jump.dispatch('pointerdown', { pointerId: pointerBase + 1 });
    controls.setInteraction('Talk', true);
    assertProjectedState(root, {
      moving: true,
      sprinting: true,
      jumpActive: true,
      interactionAvailable: true,
    });
  };

  const assertReset = () => assertProjectedState(root, {
    moving: false,
    sprinting: false,
    jumpActive: false,
    interactionAvailable: false,
  });

  armAllStates(20);
  windowRef.dispatch('blur');
  assertReset();

  armAllStates(30);
  controls.setEnabled(false);
  assertReset();

  controls.setEnabled(true);
  armAllStates(40);
  controls.dispose();
  assertReset();
});
