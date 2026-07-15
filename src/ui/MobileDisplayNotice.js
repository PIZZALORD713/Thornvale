import { shouldShowAppleRotationNotice } from '../config/display-mode.js';

/**
 * Explains iPhone Home Screen app mode after the first in-play rotation.
 * It never owns viewport sizing or input; those remain with main and
 * TouchControls respectively.
 */
export class MobileDisplayNotice {
  constructor({
    eligible = false,
    getWorldEntered = () => false,
    getStoryBlocking = () => false,
    documentRef = globalThis.document,
    windowRef = globalThis.window,
  } = {}) {
    this.eligible = Boolean(eligible);
    this.getWorldEntered = getWorldEntered;
    this.getStoryBlocking = getStoryBlocking;
    this.document = documentRef;
    this.window = windowRef;
    this.root = null;
    this.dismissButton = null;
    this.pending = false;
    this.shown = false;
    this.onOrientationChange = this.onOrientationChange.bind(this);
    this.dismiss = this.dismiss.bind(this);
  }

  init() {
    this.root = this.document?.getElementById?.('mobileDisplayNotice') || null;
    this.dismissButton = this.document?.getElementById?.('mobileDisplayNoticeDismiss') || null;
    if (!this.root) return this;
    this.root.hidden = true;
    this.window?.addEventListener?.('orientationchange', this.onOrientationChange);
    this.dismissButton?.addEventListener?.('click', this.dismiss);
    return this;
  }

  onOrientationChange() {
    if (!this.eligible || this.shown || !this.getWorldEntered()) return;
    if (this.getStoryBlocking()) {
      this.pending = true;
      return;
    }
    this.show();
  }

  setStoryBlocking(blocking) {
    if (blocking) {
      if (this.root) this.root.hidden = true;
      return this;
    }
    if (this.pending) this.show();
    return this;
  }

  show() {
    const allowed = shouldShowAppleRotationNotice({
      appModeHintEligible: this.eligible,
      worldEntered: this.getWorldEntered(),
      storyBlocking: this.getStoryBlocking(),
      alreadyShown: this.shown,
    });
    if (!allowed) return this;
    this.pending = false;
    this.shown = true;
    if (this.root) this.root.hidden = false;
    return this;
  }

  dismiss() {
    this.pending = false;
    this.shown = true;
    if (this.root) this.root.hidden = true;
    return this;
  }

  dispose() {
    this.window?.removeEventListener?.('orientationchange', this.onOrientationChange);
    this.dismissButton?.removeEventListener?.('click', this.dismiss);
    if (this.root) this.root.hidden = true;
  }
}
