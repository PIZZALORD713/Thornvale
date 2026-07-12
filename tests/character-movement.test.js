import test from 'node:test';
import assert from 'node:assert/strict';

import { CharacterMotor } from '../src/physics/CharacterMotor.js';
import { PlayerController } from '../src/controllers/PlayerController.js';
import { PhysicsWorld } from '../src/core/PhysicsWorld.js';

class FakeBody {
  constructor() {
    this.current = { x: 0, y: 0, z: 0 };
    this.next = { ...this.current };
  }

  translation() {
    return this.current;
  }

  setNextKinematicTranslation(value) {
    this.next = { x: value.x, y: value.y, z: value.z };
  }

  setTranslation(value) {
    this.current = { x: value.x, y: value.y, z: value.z };
  }

  applyStep() {
    this.current = { ...this.next };
  }
}

class FakeCharacterController {
  constructor() {
    this.grounded = true;
    this.requested = { x: 0, y: 0, z: 0 };
    this.corrected = { x: 0, y: 0, z: 0 };
  }

  computeColliderMovement(_collider, movement) {
    this.requested = { x: movement.x, y: movement.y, z: movement.z };
    this.corrected = {
      x: movement.x,
      y: this.grounded ? 0 : movement.y,
      z: movement.z,
    };
  }

  computedMovement() {
    return this.corrected;
  }

  computedGrounded() {
    return this.grounded;
  }
}

function createMotorHarness() {
  const motor = new CharacterMotor({});
  const body = new FakeBody();
  const controller = new FakeCharacterController();

  motor.body = body;
  motor.collider = {};
  motor.controller = controller;
  motor.isGrounded = true;
  motor.rawGrounded = true;
  motor.groundedTimer = motor.coyoteTime;
  motor._groundContactTimer = motor.groundContactGrace;
  motor._groundedLastUpdate = true;
  motor._hasUpdated = true;
  motor._targetPosition.set(0, 0, 0);
  motor._hasTargetPosition = true;

  return { body, controller, motor };
}

function simulateTravel(renderHz, seconds = 2) {
  const harness = createMotorHarness();
  const dt = 1 / renderHz;
  const fixedDt = 1 / 60;
  let accumulator = 0;

  for (let frame = 0; frame < renderHz * seconds; frame += 1) {
    // Mirrors main.js: fixed physics runs before the render-rate motor update.
    accumulator += dt;
    while (accumulator + 1e-10 >= fixedDt) {
      harness.body.applyStep();
      accumulator -= fixedDt;
    }
    harness.motor.update(dt, { x: 1, z: 0 }, 0, {
      targetSpeed: harness.motor.walkSpeed,
      jumpHeld: true,
    });
  }

  return harness.motor.getPosition().x;
}

test('motor accumulates pending KCC displacement between fixed physics steps', () => {
  const { controller, motor } = createMotorHarness();
  const dt = 1 / 120;

  motor.update(dt, { x: 1, z: 0 }, 0, { targetSpeed: motor.walkSpeed });
  const firstTarget = motor.getPosition().x;

  // Deliberately do not apply a physics step before the next update.
  motor.update(dt, { x: 1, z: 0 }, 0, { targetSpeed: motor.walkSpeed });

  assert.ok(firstTarget > 0);
  assert.ok(controller.requested.x > motor.velocity.x * dt);
  assert.ok(Math.abs(motor.getPosition().x - controller.requested.x) < 1e-9);
});

test('walk travel is consistent at 60, 120, and 144 Hz', () => {
  const distance60 = simulateTravel(60);
  const distance120 = simulateTravel(120);
  const distance144 = simulateTravel(144);

  assert.ok(distance60 > 7.5, `expected useful 4.2 m/s travel, got ${distance60}`);
  assert.ok(Math.abs(distance120 - distance60) < 0.03);
  assert.ok(Math.abs(distance144 - distance60) < 0.03);
});

test('bounded horizontal acceleration cannot overshoot target speed on slow frames', () => {
  const { body, motor } = createMotorHarness();

  for (let frame = 0; frame < 12; frame += 1) {
    body.applyStep();
    motor.update(0.075, { x: 1, z: 0 }, 0, { targetSpeed: motor.walkSpeed });
    assert.ok(motor.velocity.x <= motor.walkSpeed + 1e-9);
  }

  assert.equal(motor.velocity.x, motor.walkSpeed);
});

test('camera-relative reversals turn through velocity instead of snapping facing', () => {
  const { body, motor } = createMotorHarness();

  for (let frame = 0; frame < 20; frame += 1) {
    body.applyStep();
    motor.update(1 / 60, { x: 1, z: 0 }, 0, { targetSpeed: motor.walkSpeed });
  }
  assert.equal(motor.velocity.x, motor.walkSpeed);

  body.applyStep();
  motor.update(1 / 60, { x: -1, z: 0 }, 0, { targetSpeed: motor.walkSpeed });

  assert.ok(motor.velocity.x > 0, 'one input frame should not snap through a 180-degree turn');
  assert.ok(Math.abs(motor.getFacingYaw() - Math.PI / 2) < 1e-9);
});

test('motor emits one-frame jump and landing transitions with impact speed', () => {
  const { body, controller, motor } = createMotorHarness();

  assert.equal(motor.jump(8), true);
  controller.grounded = true; // Simulate a stale takeoff contact from Rapier.
  motor.update(1 / 60, { x: 0, z: 0 }, 0, { jumpHeld: true });
  assert.equal(motor.justJumped, true);
  assert.equal(motor.isGrounded, false);
  assert.equal(motor.phase, 'rising');
  assert.ok(motor.getMotionState().verticalVelocity > 0);

  body.applyStep();
  controller.grounded = false;
  motor.update(1 / 60, { x: 0, z: 0 }, 0, { jumpHeld: true });
  assert.equal(motor.justJumped, false);
  assert.equal(motor.justLanded, false);

  body.applyStep();
  motor.velocity.y = -7;
  controller.grounded = true;
  motor.update(1 / 60, { x: 0, z: 0 }, 0, { jumpHeld: true });
  assert.equal(motor.justLanded, true);
  assert.equal(motor.phase, 'landing');
  assert.ok(motor.landingSpeed > 7);
});

test('one-frame raw ground gaps do not emit false airborne/landing transitions', () => {
  const { body, controller, motor } = createMotorHarness();

  controller.grounded = false;
  motor.update(1 / 120, { x: 1, z: 0 }, 0, { targetSpeed: motor.walkSpeed });
  assert.equal(motor.rawGrounded, false);
  assert.equal(motor.isGrounded, true);
  assert.equal(motor.justLeftGround, false);

  body.applyStep();
  controller.grounded = true;
  motor.update(1 / 120, { x: 1, z: 0 }, 0, { targetSpeed: motor.walkSpeed });
  assert.equal(motor.isGrounded, true);
  assert.equal(motor.justLanded, false);
});

test('held jump input does not automatically consume the air jump', () => {
  let jumpCalls = 0;
  let firstPress = true;
  const input = {
    keys: { jump: true, sprint: false },
    consumeMouseDelta: () => ({ x: 0, y: 0 }),
    consumeKeyPress: () => {
      const pressed = firstPress;
      firstPress = false;
      return pressed;
    },
    getMovementInput: () => ({ x: 0, z: 0 }),
  };
  const motor = {
    walkSpeed: 4.2,
    sprintSpeed: 5.6,
    collider: {},
    isGrounded: true,
    velocity: { x: 0, y: 0, z: 0 },
    canJump() {
      return this.isGrounded;
    },
    jump() {
      jumpCalls += 1;
      this.isGrounded = false;
      return true;
    },
    setPlatformVelocity() {},
    update() {},
    getPosition: () => ({ x: 0, y: 0, z: 0 }),
    getFacingYaw: () => null,
  };
  const cameraRig = {
    applyInput() {},
    getYaw: () => 0,
    setTarget() {},
  };
  const visualRig = { update() {} };
  const player = new PlayerController(input, motor, cameraRig, visualRig);

  for (let frame = 0; frame < 60; frame += 1) player.update(1 / 60);

  assert.equal(jumpCalls, 1);
  assert.equal(player.airJumpsRemaining, 1);
});

test('controller selects sprint speed without mutating InputManager movement output', () => {
  const rawMovement = { x: 1, z: 0 };
  let captured = null;
  const input = {
    keys: { jump: false, sprint: true },
    consumeMouseDelta: () => ({ x: 0, y: 0 }),
    consumeKeyPress: () => false,
    getMovementInput: () => rawMovement,
  };
  const motor = {
    walkSpeed: 4.2,
    sprintSpeed: 5.6,
    collider: {},
    isGrounded: true,
    velocity: { x: 0, y: 0, z: 0 },
    canJump: () => false,
    jump: () => false,
    setPlatformVelocity() {},
    update(_dt, movement, _yaw, intent) {
      captured = { movement: { ...movement }, intent: { ...intent } };
    },
    getPosition: () => ({ x: 0, y: 0, z: 0 }),
    getFacingYaw: () => null,
  };
  const player = new PlayerController(input, motor, {
    applyInput() {},
    getYaw: () => 0,
    setTarget() {},
  }, { update() {} });

  player.update(1 / 60);

  assert.equal(rawMovement.x, 1);
  assert.deepEqual(captured.movement, { x: -1, z: 0 });
  assert.equal(captured.intent.targetSpeed, 5.6);
  assert.equal(captured.intent.sprinting, true);
});

test('real Rapier walk and jump stay vertically stable at 120 Hz', async () => {
  const physics = new PhysicsWorld();
  await physics.init();
  physics.createGround(50);
  const motor = new CharacterMotor(physics).init({ x: 0, y: 0.9, z: 0 });
  const dt = 1 / 120;

  try {
    let minRenderY = Number.POSITIVE_INFINITY;
    let maxRenderY = Number.NEGATIVE_INFINITY;
    let maxRenderStep = 0;
    let maxBodyStep = 0;
    let previousRenderY = null;
    let previousBodyY = null;
    let falseTransitions = 0;

    for (let frame = 0; frame < 480; frame += 1) {
      physics.step(dt);
      motor.update(dt, { x: 0, z: -1 }, Math.sin(frame * dt) * 0.8, {
        targetSpeed: motor.walkSpeed,
        jumpHeld: true,
      });

      if (frame <= 120) continue;
      const renderY = motor.getPosition().y;
      const bodyY = motor.body.translation().y;
      minRenderY = Math.min(minRenderY, renderY);
      maxRenderY = Math.max(maxRenderY, renderY);
      if (previousRenderY !== null) {
        maxRenderStep = Math.max(maxRenderStep, Math.abs(renderY - previousRenderY));
        maxBodyStep = Math.max(maxBodyStep, Math.abs(bodyY - previousBodyY));
      }
      previousRenderY = renderY;
      previousBodyY = bodyY;
      if (motor.justLeftGround || motor.justLanded) falseTransitions += 1;
    }

    assert.ok(maxRenderY - minRenderY < 0.02, `render Y range ${maxRenderY - minRenderY}`);
    assert.ok(maxRenderStep < 0.006, `render Y step ${maxRenderStep}`);
    // Rapier's KCC skin can correct the physical capsule by up to ~3 cm on a
    // query boundary; the render pose/state filter above is the user-facing
    // invariant and must stay below 6 mm without false transitions.
    assert.ok(maxBodyStep < 0.035, `body Y step ${maxBodyStep}`);
    assert.equal(falseTransitions, 0);
    assert.ok(Number.isFinite(motor.computeHoverMeters()));

    let leftGroundCount = 0;
    let landingCount = 0;
    let landingSpeed = 0;
    assert.equal(motor.jump(8), true);

    for (let frame = 0; frame < 360; frame += 1) {
      physics.step(dt);
      motor.update(dt, { x: 0, z: -1 }, 0, {
        targetSpeed: motor.walkSpeed,
        jumpHeld: frame < 30,
      });
      if (motor.justLeftGround) leftGroundCount += 1;
      if (motor.justLanded) {
        landingCount += 1;
        landingSpeed = motor.landingSpeed;
      }
    }

    assert.equal(leftGroundCount, 1);
    assert.equal(landingCount, 1);
    assert.ok(landingSpeed > 5);
    assert.equal(motor.isGrounded, true);
  } finally {
    physics.world?.free();
  }
});
