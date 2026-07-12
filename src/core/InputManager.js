/**
 * InputManager - Unified input handling with pointer lock support
 *
 * Responsibilities:
 * - Capture keyboard (WASD, Space, Shift)
 * - Capture mouse with pointer lock
 * - Provide normalized movement axes
 * - Track mouse delta for camera
 */

export class InputManager {
  constructor() {
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

    // Mouse state
    this.mouseDelta = { x: 0, y: 0 };
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

    console.log('[InputManager] Initialized');
    return this;
  }

  /**
   * Request pointer lock
   */
  requestLock() {
    if (!this.canvas?.requestPointerLock) return Promise.resolve(false);

    try {
      const request = this.canvas.requestPointerLock();
      if (request?.catch) {
        return request
          .then(() => true)
          .catch(() => false);
      }
      return Promise.resolve(true);
    } catch (_error) {
      // Keyboard play remains available if an embedded/automated browser
      // refuses pointer lock. Never let that rejection break the game loop.
      return Promise.resolve(false);
    }
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

  /**
   * Get and reset mouse delta (returns reusable object — do not store)
   * @returns {{ x: number, y: number }}
   */
  consumeMouseDelta() {
    if (!this.gameplayEnabled) {
      this.mouseDelta.x = 0;
      this.mouseDelta.y = 0;
      this._deltaResult.x = 0;
      this._deltaResult.y = 0;
      return this._deltaResult;
    }

    this._deltaResult.x = this.mouseDelta.x;
    this._deltaResult.y = this.mouseDelta.y;
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    return this._deltaResult;
  }

  // --- Private handlers ---

  _onKeyDown(e) {
    // Ignore if typing in input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (!this.gameplayEnabled) return;

    if (!this.activeKeys.has(e.code)) {
      this.pressedKeys.add(e.code);
      this.activeKeys.add(e.code);
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
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = true;
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
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = false;
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
      return true;
    }
    return false;
  }

  _onMouseMove(e) {
    if (!this.isLocked || !this.gameplayEnabled) return;

    this.mouseDelta.x += e.movementX * this.sensitivity;
    this.mouseDelta.y += e.movementY * this.sensitivity;
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
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    this.mouseButtons.left = false;
    this.mouseButtons.right = false;
    return this;
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
  }
}
