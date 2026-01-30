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
    
    // Mouse state
    this.mouseDelta = { x: 0, y: 0 };
    this.mouseButtons = { left: false, right: false };
    this.sensitivity = 0.002;
    
    // Pointer lock state
    this.isLocked = false;
    this.canvas = null;
    
    // Callbacks
    this.onLockChange = null;
    
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
    if (this.canvas) {
      this.canvas.requestPointerLock();
    }
  }

  /**
   * Exit pointer lock
   */
  exitLock() {
    document.exitPointerLock();
  }

  /**
   * Get normalized movement direction
   * @returns {{ x: number, z: number }} - Movement input (-1 to 1)
   */
  getMovementInput() {
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
    
    return { x, z };
  }

  /**
   * Get and reset mouse delta
   * @returns {{ x: number, y: number }}
   */
  consumeMouseDelta() {
    const delta = { ...this.mouseDelta };
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    return delta;
  }

  // --- Private handlers ---

  _onKeyDown(e) {
    // Ignore if typing in input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
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

  _onMouseMove(e) {
    if (!this.isLocked) return;
    
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
