/**
 * InputManager - Unified semantic input with keyboard/mouse support
 *
 * Responsibilities:
 * - Capture keyboard (WASD, Space, Shift)
 * - Capture mouse with pointer lock
 * - Merge normalized movement and action intent from multiple sources
 * - Track pointer deltas for camera look
 */

export class InputManager {
  constructor({ controlMode = 'desktop' } = {}) {
    this.controlMode = controlMode;

    // Keyboard state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
    };

    this.activeKeys = new Set();
    this.pressedKeys = new Set();
    this.movementSources = new Map();
    this.lookSources = new Map();
    this.heldActionSources = new Map();
    this.pressedActionSources = new Map();

    // Mouse state
    this.mouseButtons = { left: false, right: false };
    this.sensitivity = 0.002;
    this.gameplayEnabled = true;

    // Pointer lock state
    this.isLocked = false;
    this.canvas = null;

    // Callbacks
    this.onLockChange = null;

    // Pre-allocated reusable return objects
    this._moveResult = { x: 0, z: 0 };
    this._deltaResult = { x: 0, y: 0 };

    // Bind handlers
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onInputInterrupted = this._onInputInterrupted.bind(this);
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
  }

  /**
   * Initialize input handling
   * @param {HTMLCanvasElement} canvas - The canvas element for pointer lock
   */
  init(canvas) {
    this.canvas = canvas;

    // Keyboard
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);

    // Mouse
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);

    // Pointer lock
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    window.addEventListener('blur', this._onInputInterrupted);
    window.addEventListener('pagehide', this._onInputInterrupted);

    console.log('[InputManager] Initialized');
    return this;
  }

  /**
   * Request pointer lock
   */
  requestLock() {
    if (!this.canvas?.requestPointerLock) return Promise.resolve(false);

    return new Promise((resolve) => {
      let settled = false;
      const finish = (locked) => {
        if (settled) return;
        settled = true;
        document.removeEventListener('pointerlockchange', onChange);
        document.removeEventListener('pointerlockerror', onError);
        resolve(Boolean(locked));
      };
      const onChange = () => finish(document.pointerLockElement === this.canvas);
      const onError = () => finish(false);

      document.addEventListener('pointerlockchange', onChange);
      document.addEventListener('pointerlockerror', onError);

      try {
        const request = this.canvas.requestPointerLock();
        if (request?.then) {
          request
            .then(() => finish(document.pointerLockElement === this.canvas))
            .catch(onError);
        }
      } catch (_error) {
        // Keyboard play remains available if an embedded/automated browser
        // refuses pointer lock. Never let that rejection break the game loop.
        finish(false);
      }
    });
  }

  /**
   * Exit pointer lock
   */
  exitLock() {
    document.exitPointerLock();
  }

  /**
   * Get normalized movement direction (returns reusable object — do not store)
   * @returns {{ x: number, z: number }} - Movement input (-1 to 1)
   */
  getMovementInput() {
    if (!this.gameplayEnabled) {
      this._moveResult.x = 0;
      this._moveResult.z = 0;
      return this._moveResult;
    }

    let x = 0;
    let z = 0;

    if (this.keys.forward) z -= 1;
    if (this.keys.backward) z += 1;
    if (this.keys.left) x -= 1;
    if (this.keys.right) x += 1;

    for (const movement of this.movementSources.values()) {
      x += movement.x;
      z += movement.z;
    }

    // Normalize diagonal movement
    const length = Math.sqrt(x * x + z * z);
    if (length > 1) {
      x /= length;
      z /= length;
    }

    this._moveResult.x = x;
    this._moveResult.z = z;
    return this._moveResult;
  }

  /** Set one device/source's analog movement contribution. */
  setMovementInput(source, x, z) {
    const key = String(source || 'external');
    if (!this.gameplayEnabled) {
      this.movementSources.delete(key);
      return this;
    }
    const nextX = Number.isFinite(Number(x)) ? Number(x) : 0;
    const nextZ = Number.isFinite(Number(z)) ? Number(z) : 0;
    const movement = this.movementSources.get(key) || { x: 0, z: 0 };
    movement.x = nextX;
    movement.z = nextZ;
    this.movementSources.set(key, movement);
    return this;
  }

  /** Add a device/source's already-scaled camera look delta in radians. */
  addLookDelta(x, y, source = 'external') {
    if (!this.gameplayEnabled) return this;
    const key = String(source || 'external');
    const delta = this.lookSources.get(key) || { x: 0, y: 0 };
    delta.x += Number.isFinite(Number(x)) ? Number(x) : 0;
    delta.y += Number.isFinite(Number(y)) ? Number(y) : 0;
    this.lookSources.set(key, delta);
    return this;
  }

  clearLookInput(source) {
    this.lookSources.delete(String(source || 'external'));
    return this;
  }

  setActionHeld(action, held, source = 'external') {
    const sourceKey = String(source || 'external');
    let actions = this.heldActionSources.get(sourceKey);
    if (!this.gameplayEnabled || !held) {
      actions?.delete(action);
      if (actions?.size === 0) this.heldActionSources.delete(sourceKey);
      return this;
    }
    if (!actions) {
      actions = new Set();
      this.heldActionSources.set(sourceKey, actions);
    }
    actions.add(action);
    return this;
  }

  isActionHeld(action) {
    if (!this.gameplayEnabled) return false;
    for (const actions of this.heldActionSources.values()) {
      if (actions.has(action)) return true;
    }
    return false;
  }

  pressAction(action, source = 'external') {
    if (!this.gameplayEnabled) return false;
    let sources = this.pressedActionSources.get(action);
    if (!sources) {
      sources = new Set();
      this.pressedActionSources.set(action, sources);
    }
    sources.add(String(source || 'external'));
    return true;
  }

  consumeActionPress(action) {
    if (!this.gameplayEnabled) return false;
    const sources = this.pressedActionSources.get(action);
    if (!sources?.size) return false;
    this.pressedActionSources.delete(action);
    if (action === 'jump') this.pressedKeys.delete('Space');
    if (action === 'interact') this.pressedKeys.delete('KeyE');
    return true;
  }

  /** Clear only one source so hybrid keyboard/touch state remains independent. */
  clearInputSource(source) {
    const key = String(source || 'external');
    this.movementSources.delete(key);
    this.clearLookInput(key);
    this.heldActionSources.delete(key);
    for (const [action, sources] of this.pressedActionSources) {
      sources.delete(key);
      if (sources.size === 0) this.pressedActionSources.delete(action);
    }
    return this;
  }

  /**
   * Get and reset mouse delta (returns reusable object — do not store)
   * @returns {{ x: number, y: number }}
   */
  consumeLookDelta() {
    if (!this.gameplayEnabled) {
      this.lookSources.clear();
      this._deltaResult.x = 0;
      this._deltaResult.y = 0;
      return this._deltaResult;
    }

    this._deltaResult.x = 0;
    this._deltaResult.y = 0;
    for (const delta of this.lookSources.values()) {
      this._deltaResult.x += delta.x;
      this._deltaResult.y += delta.y;
    }
    this.lookSources.clear();
    return this._deltaResult;
  }

  /** Backward-compatible alias while consumers migrate to semantic naming. */
  consumeMouseDelta() {
    return this.consumeLookDelta();
  }

  // --- Private handlers ---

  _onKeyDown(e) {
    // Ignore if typing in input field
    if (['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(e.target.tagName)) return;

    if (!this.gameplayEnabled) return;

    if (!this.activeKeys.has(e.code)) {
      this.pressedKeys.add(e.code);
      this.activeKeys.add(e.code);
      if (e.code === 'Space') this.pressAction('jump', 'keyboard');
      if (e.code === 'KeyE') this.pressAction('interact', 'keyboard');
    }

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = true;
        break;
      case 'Space':
        this.keys.jump = true;
        this.setActionHeld('jump', true, 'keyboard');
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = true;
        this.setActionHeld('sprint', true, 'keyboard');
        break;
    }
  }

  _onKeyUp(e) {
    this.activeKeys.delete(e.code);
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = false;
        break;
      case 'Space':
        this.keys.jump = false;
        this.setActionHeld('jump', false, 'keyboard');
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = false;
        this.setActionHeld('sprint', false, 'keyboard');
        break;
    }
  }

  /**
   * Consume a single key press event
   * @param {string} code - KeyboardEvent.code
   */
  consumeKeyPress(code) {
    if (!this.gameplayEnabled) return false;
    if (this.pressedKeys.has(code)) {
      this.pressedKeys.delete(code);
      if (code === 'Space') this.pressedActionSources.delete('jump');
      if (code === 'KeyE') this.pressedActionSources.delete('interact');
      return true;
    }
    return false;
  }

  _onMouseMove(e) {
    if (!this.isLocked || !this.gameplayEnabled) return;

    this.addLookDelta(e.movementX * this.sensitivity, e.movementY * this.sensitivity, 'mouse');
  }

  _onMouseDown(e) {
    if (e.button === 0) this.mouseButtons.left = true;
    if (e.button === 2) this.mouseButtons.right = true;
  }

  _onMouseUp(e) {
    if (e.button === 0) this.mouseButtons.left = false;
    if (e.button === 2) this.mouseButtons.right = false;
  }

  /** Pause or resume world controls while story cards own the keyboard. */
  setGameplayEnabled(enabled) {
    this.gameplayEnabled = Boolean(enabled);
    if (!this.gameplayEnabled) this.clearGameplayState();
    return this;
  }

  clearGameplayState() {
    Object.keys(this.keys).forEach((key) => {
      this.keys[key] = false;
    });
    this.activeKeys.clear();
    this.pressedKeys.clear();
    this.movementSources.clear();
    this.lookSources.clear();
    this.heldActionSources.clear();
    this.pressedActionSources.clear();
    this.mouseButtons.left = false;
    this.mouseButtons.right = false;
    return this;
  }

  _onInputInterrupted() {
    this.clearGameplayState();
  }

  _onVisibilityChange() {
    if (document.hidden) this.clearGameplayState();
  }

  _onPointerLockChange() {
    this.isLocked = document.pointerLockElement === this.canvas;

    if (this.onLockChange) {
      this.onLockChange(this.isLocked);
    }
  }

  /**
   * Clean up
   */
  dispose() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    window.removeEventListener('blur', this._onInputInterrupted);
    window.removeEventListener('pagehide', this._onInputInterrupted);
    this.clearGameplayState();
  }
}
