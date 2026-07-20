import test from 'node:test';
import assert from 'node:assert/strict';

import { StoryUI } from '../src/ui/StoryUI.js';

const REQUIRED_IDS = [
  'storyObjective',
  'storyObjectiveLabel',
  'storyObjectiveText',
  'storyLayer',
  'storyCard',
  'storyPortrait',
  'storyPortraitText',
  'storyEyebrow',
  'storyTitle',
  'storyBody',
  'storyDetail',
  'storySignaturePanel',
  'storySignatureInput',
  'storySignatureError',
  'storySignatureDisplay',
  'storySignatureText',
  'storyChoices',
  'storyAction',
  'storyActionLabel',
  'storyKeyHint',
];

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...values) {
    values.forEach((value) => this.values.add(value));
  }

  remove(...values) {
    values.forEach((value) => this.values.delete(value));
  }

  toggle(value, force) {
    const shouldAdd = force === undefined ? !this.values.has(value) : Boolean(force);
    if (shouldAdd) this.values.add(value);
    else this.values.delete(value);
    return shouldAdd;
  }
}

class FakeElement {
  constructor(documentRef, id = '', tagName = 'div') {
    this.ownerDocument = documentRef;
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.classList = new FakeClassList();
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = [];
    this.parentElement = null;
    this.hidden = false;
    this.disabled = false;
    this.inert = false;
    this.isConnected = true;
    this.offsetParent = {};
    this.offsetWidth = 1;
    this.textContent = '';
    this.value = '';
  }

  addEventListener(type, handler, options = {}) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push({ handler, once: Boolean(options?.once) });
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, handler) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(type, listeners.filter((entry) => entry.handler !== handler));
  }

  dispatchEvent(event) {
    const listeners = [...(this.listeners.get(event.type) ?? [])];
    for (const entry of listeners) {
      entry.handler.call(this, event);
      if (entry.once) this.removeEventListener(event.type, entry.handler);
    }
    return !event.defaultPrevented;
  }

  click() {
    if (this.disabled) return;
    this.dispatchEvent({ type: 'click', target: this, defaultPrevented: false });
  }

  focus() {
    for (let node = this; node; node = node.parentElement) {
      if (node.inert) return;
    }
    this.ownerDocument.activeElement = this;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  toggleAttribute(name, force) {
    const shouldAdd = force === undefined ? !this.attributes.has(name) : Boolean(force);
    if (shouldAdd) this.attributes.set(name, '');
    else this.attributes.delete(name);
    return shouldAdd;
  }

  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  contains(element) {
    for (let node = element; node; node = node.parentElement) {
      if (node === this) return true;
    }
    return false;
  }

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }
}

class FakeDocument extends FakeElement {
  constructor() {
    super(null, '#document', '#document');
    this.ownerDocument = this;
    this.elements = new Map();
    this.documentElement = new FakeElement(this, 'html', 'html');
    this.body = new FakeElement(this, 'body', 'body');
    this.activeElement = this.body;
    this.hudLayer = new FakeElement(this, 'hudLayer');

    for (const id of REQUIRED_IDS) {
      const tagName = id === 'storyAction'
        ? 'button'
        : id === 'storySignatureInput'
          ? 'input'
          : id === 'storyCard'
            ? 'section'
            : 'div';
      this.elements.set(id, new FakeElement(this, id, tagName));
    }

    this.elements.set('app', new FakeElement(this, 'app'));
    this.elements.set('lockOverlay', new FakeElement(this, 'lockOverlay'));

    const storyLayer = this.getElementById('storyLayer');
    const storyCard = this.getElementById('storyCard');
    storyLayer.append(storyCard);
    storyCard.append(
      this.getElementById('storySignaturePanel'),
      this.getElementById('storySignatureInput'),
      this.getElementById('storySignatureDisplay'),
      this.getElementById('storyDetail'),
      this.getElementById('storyChoices'),
      this.getElementById('storyAction'),
      this.getElementById('storyKeyHint'),
    );
  }

  getElementById(id) {
    return this.elements.get(id) ?? null;
  }

  querySelector(selector) {
    if (selector === '.hud-layer') return this.hudLayer;
    return null;
  }

  createElement(tagName) {
    return new FakeElement(this, '', tagName);
  }

  createTextNode(text) {
    const node = new FakeElement(this, '', '#text');
    node.textContent = String(text);
    return node;
  }
}

function createUI(t) {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => {
    callback(0);
    return 1;
  };
  t.after(() => {
    if (originalRequestAnimationFrame) globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    else delete globalThis.requestAnimationFrame;
  });

  const documentRef = new FakeDocument();
  const previousFocus = documentRef.getElementById('lockOverlay');
  documentRef.activeElement = previousFocus;
  const ui = new StoryUI({ documentRef }).init();
  t.after(() => ui.dispose());
  return { documentRef, previousFocus, ui };
}

function assertKeyHint(documentRef, prefix, key) {
  const hint = documentRef.getElementById('storyKeyHint');
  assert.equal(hint.children.length, 2);
  assert.equal(hint.children[0].textContent, `${prefix} `);
  assert.equal(hint.children[1].textContent, key);
}

test('StoryUI.say renders authored beats one at a time and resolves after the last', async (t) => {
  const { documentRef, previousFocus, ui } = createUI(t);
  const beats = [
    'There you are.',
    { text: 'The Ledger says you rang early.' },
    { body: 'Thornvale remembers together.' },
    { message: 'Put this little worry behind us.' },
  ];
  const changes = [];
  let settled = false;

  const result = ui.say({
    speaker: 'Steward Lumen',
    body: 'The fallback should not be rendered.',
    beats,
    onBeatChange: (beat, index, metadata) => changes.push({ beat, index, metadata }),
  });
  result.then(() => {
    settled = true;
  });

  assert.equal(documentRef.getElementById('storyBody').textContent, 'There you are.');
  assert.equal(documentRef.getElementById('storyActionLabel').textContent, 'Next');
  assertKeyHint(documentRef, 'Next with', 'Enter');
  assert.equal(documentRef.getElementById('storyAction'), documentRef.activeElement);
  assert.equal(documentRef.getElementById('lockOverlay').inert, true);
  assert.deepEqual(changes, [{ beat: beats[0], index: 0, metadata: { total: 4 } }]);

  documentRef.getElementById('storyAction').click();
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(documentRef.getElementById('storyBody').textContent, 'The Ledger says you rang early.');
  assert.equal(documentRef.getElementById('storyActionLabel').textContent, 'Next');

  documentRef.getElementById('storyAction').click();
  assert.equal(documentRef.getElementById('storyBody').textContent, 'Thornvale remembers together.');
  assert.equal(documentRef.getElementById('storyActionLabel').textContent, 'Next');

  documentRef.getElementById('storyAction').click();
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(documentRef.getElementById('storyBody').textContent, 'Put this little worry behind us.');
  assert.equal(documentRef.getElementById('storyActionLabel').textContent, 'Continue');
  assertKeyHint(documentRef, 'Continue with', 'Enter');
  assert.equal(changes.length, 4);
  assert.equal(changes[3].beat, beats[3]);
  assert.equal(changes[3].index, 3);
  assert.deepEqual(changes[3].metadata, { total: 4 });

  documentRef.getElementById('storyAction').click();
  assert.equal(await result, 'continue');
  assert.equal(ui.isBlocking(), false);
  assert.equal(documentRef.getElementById('lockOverlay').inert, false);
  assert.equal(documentRef.activeElement, previousFocus);
});

test('StoryUI.say isolates synchronous beat callback failures from progression', async (t) => {
  const { documentRef, ui } = createUI(t);
  const originalConsoleError = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args);
  t.after(() => {
    console.error = originalConsoleError;
  });

  const seen = [];
  const result = ui.say({
    beats: ['Kindness first.', 'Correction second.'],
    onBeatChange(beat, index, metadata) {
      seen.push({ beat, index, metadata });
      throw new Error(`performance cue ${index} failed`);
    },
  });

  assert.equal(documentRef.getElementById('storyBody').textContent, 'Kindness first.');
  assert.equal(ui.isBlocking(), true);
  documentRef.getElementById('storyAction').click();
  assert.equal(documentRef.getElementById('storyBody').textContent, 'Correction second.');
  assert.equal(ui.isBlocking(), true);
  documentRef.getElementById('storyAction').click();

  assert.equal(await result, 'continue');
  assert.deepEqual(seen.map(({ index, metadata }) => ({ index, metadata })), [
    { index: 0, metadata: { total: 2 } },
    { index: 1, metadata: { total: 2 } },
  ]);
  assert.equal(errors.length, 2);
  assert.equal(errors[0][0], '[StoryUI] onBeatChange callback failed.');
});

test('StoryUI.say preserves legacy fallback content, custom final labels, and disposal', async (t) => {
  const { documentRef, ui } = createUI(t);
  const fallbackChanges = [];
  const fallback = ['One legacy paragraph.', 'Another legacy paragraph.'];
  const legacyResult = ui.say({
    speaker: 'A ribbon tied to the Bell',
    body: fallback,
    actionLabel: 'Return to Lumen',
    keyHint: 'Return with',
    key: 'Space',
    onBeatChange: (beat, index, metadata) => fallbackChanges.push({ beat, index, metadata }),
  });

  assert.equal(
    documentRef.getElementById('storyBody').textContent,
    'One legacy paragraph.\n\nAnother legacy paragraph.',
  );
  assert.equal(documentRef.getElementById('storyActionLabel').textContent, 'Return to Lumen');
  assertKeyHint(documentRef, 'Return with', 'Space');
  assert.deepEqual(fallbackChanges, [{ beat: fallback, index: 0, metadata: { total: 1 } }]);
  documentRef.getElementById('storyAction').click();
  assert.equal(await legacyResult, 'continue');

  const pending = ui.say('Steward Lumen', 'This dialogue is interrupted safely.');
  assert.equal(ui.isBlocking(), true);
  ui.dispose();
  assert.equal(await pending, null);
  assert.equal(ui.isBlocking(), false);
  assert.equal(documentRef.getElementById('lockOverlay').inert, false);
});
