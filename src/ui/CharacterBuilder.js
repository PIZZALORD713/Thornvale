const vibeDescriptions = {
  gentle: 'A soft presence, the kind of calm that makes the town exhale.',
  curious: 'Eyes bright with questions and a patience for strange answers.',
  steadfast: 'Rooted and reliable, you carry quiet certainty into the valley.',
  mischievous: 'A spark of playful defiance, just enough to test the rules.',
};

const totemDescriptions = {
  thistle: 'a thistle tucked behind the ear',
  lantern: 'a lantern that never quite cools',
  rook: 'a rook feather tucked in your sleeve',
  moon: 'a moon charm that glows at dusk',
};

export class CharacterBuilder {
  constructor({ onConfirm, onPreview }) {
    this.elements = {};
    this.onConfirm = onConfirm;
    this.onPreview = onPreview;
  }

  init() {
    this.elements = {
      panel: document.getElementById('characterBuilder'),
      name: document.getElementById('cb-name'),
      pronouns: document.getElementById('cb-pronouns'),
      vibe: document.getElementById('cb-vibe'),
      outfit: document.getElementById('cb-outfit'),
      accent: document.getElementById('cb-accent'),
      totem: document.getElementById('cb-totem'),
      preview: document.getElementById('cb-preview'),
      confirm: document.getElementById('cb-confirm'),
    };

    if (!this.elements.panel) {
      return this;
    }

    const handleChange = () => {
      const config = this.getConfig();
      this.updatePreview(config);
      if (this.onPreview) {
        this.onPreview(config);
      }
    };

    ['name', 'pronouns', 'vibe', 'outfit', 'accent', 'totem'].forEach((key) => {
      const el = this.elements[key];
      if (el) {
        el.addEventListener('input', handleChange);
        el.addEventListener('change', handleChange);
      }
    });

    if (this.elements.confirm) {
      this.elements.confirm.addEventListener('click', () => {
        const config = this.getConfig();
        this.updatePreview(config);
        if (this.onConfirm) {
          this.onConfirm(config);
        }
        this.hide();
      });
    }

    this.updatePreview(this.getConfig());
    return this;
  }

  show() {
    if (this.elements.panel) {
      this.elements.panel.classList.remove('hidden');
    }
  }

  hide() {
    if (this.elements.panel) {
      this.elements.panel.classList.add('hidden');
    }
  }

  getConfig() {
    return {
      name: this.elements.name?.value?.trim() || 'Rowan',
      pronouns: this.elements.pronouns?.value || 'they/them',
      vibe: this.elements.vibe?.value || 'curious',
      outfit: this.elements.outfit?.value || 'cloak',
      accentColor: this.elements.accent?.value || '#f2b266',
      totem: this.elements.totem?.value || 'lantern',
    };
  }

  updatePreview(config) {
    if (!this.elements.preview) {
      return;
    }
    const vibeText = vibeDescriptions[config.vibe] || vibeDescriptions.curious;
    const totemText = totemDescriptions[config.totem] || totemDescriptions.lantern;
    this.elements.preview.textContent = `${config.name} arrives with ${totemText}. ${vibeText}`;
  }
}
