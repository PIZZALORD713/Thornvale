export class HUD {
  constructor() {
    this.elements = {};
  }

  init() {
    this.elements = {
      status: document.getElementById('statusLine'),
      dayNightBadge: document.getElementById('dayNightBadge'),
      prompt: document.getElementById('interactionPrompt'),
      kindness: document.getElementById('kindnessCounter'),
      lockOverlay: document.getElementById('lockOverlay'),
      debugPanel: document.getElementById('debug'),
      fps: document.getElementById('fps'),
      pos: document.getElementById('pos'),
      vel: document.getElementById('vel'),
      grounded: document.getElementById('grounded'),
      platform: document.getElementById('platform'),
    };

    this.hidePrompt();
    this.hideKindness();
    this.setDebugVisible(false);
    return this;
  }

  setStatus(text) {
    if (this.elements.status) {
      this.elements.status.textContent = text;
    }
  }

  setDayNight(mode) {
    if (this.elements.dayNightBadge) {
      this.elements.dayNightBadge.textContent = mode;
      this.elements.dayNightBadge.dataset.mode = mode.toLowerCase();
    }
  }

  showPrompt(text) {
    if (this.elements.prompt) {
      this.elements.prompt.textContent = text;
      this.elements.prompt.classList.remove('hidden');
    }
  }

  hidePrompt() {
    if (this.elements.prompt) {
      this.elements.prompt.classList.add('hidden');
    }
  }

  showKindness(value) {
    if (this.elements.kindness) {
      this.elements.kindness.textContent = `Kindness: ${value}`;
      this.elements.kindness.classList.remove('hidden');
    }
  }

  hideKindness() {
    if (this.elements.kindness) {
      this.elements.kindness.classList.add('hidden');
    }
  }

  setDebugVisible(visible) {
    if (this.elements.debugPanel) {
      this.elements.debugPanel.style.display = visible ? 'block' : 'none';
    }
  }

  updateFPS(fps) {
    if (this.elements.fps) {
      this.elements.fps.textContent = fps;
    }
  }

  updateDebug(info) {
    if (this.elements.pos) this.elements.pos.textContent = info.position;
    if (this.elements.vel) this.elements.vel.textContent = info.velocity;
    if (this.elements.grounded) this.elements.grounded.textContent = info.grounded ? 'YES' : 'NO';
    if (this.elements.platform) this.elements.platform.textContent = info.platform;
  }
}
