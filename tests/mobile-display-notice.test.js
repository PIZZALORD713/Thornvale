import assert from 'node:assert/strict';
import test from 'node:test';

import { MobileDisplayNotice } from '../src/ui/MobileDisplayNotice.js';

class FakeEventTarget {
  constructor() {
    this.hidden = true;
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) || []) listener({ type });
  }
}

function createHarness({ eligible = true } = {}) {
  const windowRef = new FakeEventTarget();
  const root = new FakeEventTarget();
  const dismiss = new FakeEventTarget();
  const elements = new Map([
    ['mobileDisplayNotice', root],
    ['mobileDisplayNoticeDismiss', dismiss],
  ]);
  let worldEntered = false;
  let storyBlocking = false;
  const notice = new MobileDisplayNotice({
    eligible,
    getWorldEntered: () => worldEntered,
    getStoryBlocking: () => storyBlocking,
    documentRef: { getElementById: (id) => elements.get(id) || null },
    windowRef,
  }).init();
  return {
    notice,
    windowRef,
    root,
    dismiss,
    setWorldEntered(value) { worldEntered = value; },
    setStoryBlocking(value) { storyBlocking = value; },
  };
}

test('rotation guidance waits for play, defers across story blocking, and shows once', () => {
  const harness = createHarness();
  harness.windowRef.dispatch('orientationchange');
  assert.equal(harness.root.hidden, true);

  harness.setWorldEntered(true);
  harness.setStoryBlocking(true);
  harness.windowRef.dispatch('orientationchange');
  assert.equal(harness.notice.pending, true);
  assert.equal(harness.root.hidden, true);

  harness.setStoryBlocking(false);
  harness.notice.setStoryBlocking(false);
  assert.equal(harness.notice.shown, true);
  assert.equal(harness.root.hidden, false);

  harness.dismiss.dispatch('click');
  assert.equal(harness.root.hidden, true);
  harness.windowRef.dispatch('orientationchange');
  assert.equal(harness.root.hidden, true);
});

test('standalone and non-Apple sessions never expose rotation guidance', () => {
  const harness = createHarness({ eligible: false });
  harness.setWorldEntered(true);
  harness.windowRef.dispatch('orientationchange');
  assert.equal(harness.root.hidden, true);
  assert.equal(harness.notice.shown, false);
});

test('disposal removes lifecycle listeners and hides the notice', () => {
  const harness = createHarness();
  harness.setWorldEntered(true);
  harness.windowRef.dispatch('orientationchange');
  assert.equal(harness.root.hidden, false);
  harness.notice.dispose();
  assert.equal(harness.root.hidden, true);
  assert.equal(harness.windowRef.listeners.get('orientationchange')?.size, 0);
  assert.equal(harness.dismiss.listeners.get('click')?.size, 0);
});
