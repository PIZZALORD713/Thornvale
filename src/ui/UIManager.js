/**
 * UIManager - Handles UI interactions
 * 
 * This is a placeholder for PR11 when we integrate the full UI
 * from the original HTML file.
 * 
 * Responsibilities:
 * - Load/Remove character buttons
 * - Character list display
 * - Control/possession buttons
 * - Camera tuning sliders
 * - Status messages
 */

export class UIManager {
  constructor() {
    this.elements = {};
    this.callbacks = {
      onLoadRandom: null,
      onLoadById: null,
      onClear: null,
      onControl: null,
      onRemove: null,
    };
  }

  /**
   * Initialize UI elements
   */
  init() {
    // Cache element references
    this.elements = {
      status: document.getElementById('status'),
      characterList: document.getElementById('characterList'),
      tokenInput: document.getElementById('tokenInput'),
      loadBtn: document.getElementById('loadBtn'),
      randomBtn: document.getElementById('randomBtn'),
      clearBtn: document.getElementById('clearBtn'),
    };
    
    // Setup event listeners
    this._setupListeners();
    
    return this;
  }

  /**
   * Set status message
   */
  setStatus(text, type = 'info') {
    if (this.elements.status) {
      this.elements.status.textContent = text;
      this.elements.status.className = type;
    }
  }

  /**
   * Update character list display
   */
  updateCharacterList(characters, controlledId = null) {
    const listEl = this.elements.characterList;
    if (!listEl) return;
    
    if (characters.size === 0) {
      listEl.innerHTML = '';
      return;
    }
    
    const ids = Array.from(characters.keys());
    
    listEl.innerHTML = `
      <div style="margin-top: 10px; font-weight: 600;">
        Loaded (${ids.length}):
      </div>
      ${ids.map(id => {
        const isControlled = id === controlledId;
        return `
          <div class="character-item ${isControlled ? 'controlled' : ''}">
            <span>${isControlled ? '🎮 ' : ''}#${id}</span>
            <div class="btn-group">
              <button class="secondary ${isControlled ? 'active' : ''}" 
                      data-action="control" data-id="${id}">
                ${isControlled ? 'Controlling' : 'Control'}
              </button>
              <button class="danger" data-action="remove" data-id="${id}">
                Remove
              </button>
            </div>
          </div>
        `;
      }).join('')}
    `;
    
    // Add click handlers
    listEl.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const id = parseInt(btn.dataset.id);
        
        if (action === 'control' && this.callbacks.onControl) {
          this.callbacks.onControl(id);
        } else if (action === 'remove' && this.callbacks.onRemove) {
          this.callbacks.onRemove(id);
        }
      });
    });
  }

  /**
   * Setup event listeners
   */
  _setupListeners() {
    // Random button
    this.elements.randomBtn?.addEventListener('click', () => {
      if (this.callbacks.onLoadRandom) {
        this.callbacks.onLoadRandom();
      }
    });
    
    // Load by ID
    this.elements.loadBtn?.addEventListener('click', () => {
      const tokenId = parseInt(this.elements.tokenInput?.value);
      if (tokenId && this.callbacks.onLoadById) {
        this.callbacks.onLoadById(tokenId);
      }
    });
    
    // Clear
    this.elements.clearBtn?.addEventListener('click', () => {
      if (this.callbacks.onClear) {
        this.callbacks.onClear();
      }
    });
    
    // Enter key in input
    this.elements.tokenInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.elements.loadBtn?.click();
      }
    });
  }
}
