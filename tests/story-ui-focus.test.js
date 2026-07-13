import test from 'node:test';
import assert from 'node:assert/strict';

import { InputManager } from '../src/core/InputManager.js';
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

  contains(value) {
    return this.values.has(value);
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
    this.dispatchEvent(createEvent('click', { target: this }));
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

  closest(selector) {
    if (selector === 'button' && this.tagName === 'BUTTON') return this;
    return this.parentElement?.closest?.(selector) ?? null;
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

function createEvent(type, values = {}) {
  return {
    type,
    target: values.target ?? null,
    key: values.key ?? '',
    code: values.code ?? '',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    ...values,
  };
}

function pressEnter(documentRef) {
  const target = documentRef.activeElement;
  const event = createEvent('keydown', { target, key: 'Enter', code: 'Enter' });
  documentRef.dispatchEvent(event);
  if (!event.defaultPrevented && target?.tagName === 'BUTTON') target.click();
}

test('StoryUI reclaims initial focus after pointer-lock settles for keyboard and click entry', async (t) => {
  const animationFrames = [];
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => {
    animationFrames.push(callback);
    return animationFrames.length;
  };
  t.after(() => {
    if (originalRequestAnimationFrame) globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    else delete globalThis.requestAnimationFrame;
  });

  const flushAnimationFrames = () => {
    for (const callback of animationFrames.splice(0)) callback(0);
  };

  for (const entryMethod of ['keyboard', 'click']) {
    for (const pointerEvent of ['pointerlockchange', 'pointerlockerror']) {
      const documentRef = new FakeDocument();
      const previousFocus = entryMethod === 'keyboard'
        ? documentRef.getElementById('lockOverlay')
        : documentRef.body;
      documentRef.activeElement = previousFocus;

      const ui = new StoryUI({ documentRef }).init();
      const result = ui.showLetter({ body: `Entered by ${entryMethod}` });
      flushAnimationFrames();

      assert.equal(documentRef.activeElement, documentRef.getElementById('storyAction'));
      assert.equal(documentRef.getElementById('lockOverlay').inert, true);

      // Chromium can move focus away when the pointer-lock request settles
      // after the modal's first focus frame, including when the request fails.
      documentRef.activeElement = documentRef.body;
      documentRef.dispatchEvent(createEvent(pointerEvent, { target: documentRef }));
      flushAnimationFrames();

      assert.equal(
        documentRef.activeElement,
        documentRef.getElementById('storyAction'),
        `${entryMethod} entry returns focus after ${pointerEvent}`,
      );

      const focusedAction = documentRef.activeElement;
      documentRef.activeElement = documentRef.body;
      documentRef.dispatchEvent(createEvent('focusout', {
        target: focusedAction,
        relatedTarget: documentRef.body,
      }));
      flushAnimationFrames();
      assert.equal(
        documentRef.activeElement,
        documentRef.getElementById('storyAction'),
        `${entryMethod} entry contains a late focus escape after ${pointerEvent}`,
      );

      pressEnter(documentRef);
      assert.equal(await result, 'continue');
      assert.equal(ui.isBlocking(), false);
      assert.equal(documentRef.getElementById('lockOverlay').inert, false);
      assert.equal(documentRef.activeElement, previousFocus);
      ui.dispose();
    }
  }
});

test('InputManager waits for legacy pointer-lock lifecycle events before entering the story', async (t) => {
  const originalDocument = globalThis.document;
  const documentRef = new FakeDocument();
  globalThis.document = documentRef;
  t.after(() => {
    if (originalDocument) globalThis.document = originalDocument;
    else delete globalThis.document;
  });

  const canvas = new FakeElement(documentRef, 'canvas', 'canvas');
  canvas.requestPointerLock = () => undefined;
  const input = new InputManager();
  input.canvas = canvas;

  let settled = false;
  const denied = input.requestLock().then((locked) => {
    settled = true;
    return locked;
  });
  await Promise.resolve();
  assert.equal(settled, false, 'a legacy void return is not treated as immediate success');
  documentRef.dispatchEvent(createEvent('pointerlockerror', { target: documentRef }));
  assert.equal(await denied, false);

  const granted = input.requestLock();
  documentRef.pointerLockElement = canvas;
  documentRef.dispatchEvent(createEvent('pointerlockchange', { target: documentRef }));
  assert.equal(await granted, true);
});
