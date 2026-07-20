import test from 'node:test';
import assert from 'node:assert/strict';

import { TOWN_LAYOUT } from '../src/config/town.js';
import { CORE_HOOK_V03 } from '../src/content/core-hook-v03.js';
import { PhysicsWorld } from '../src/core/PhysicsWorld.js';
import {
  addCottagePhysics,
  addWalkableTerrainPhysics,
} from '../src/game/TownBuilder.js';
import { CharacterMotor } from '../src/physics/CharacterMotor.js';
import {
  createMoundSurfaceGrid,
  sampleMoundHeight,
} from '../src/utils/terrain-surface.js';
import {
  createBellPrecinct,
  createGroundDressing,
} from '../src/visuals/CozyTownKit.js';

test('each cottage installs porch, detail, and garden-fence physics once', () => {
  const boxes = [];
  const physicsWorld = {
    createStaticBox(position, size) {
      boxes.push({ position: { ...position }, size: { ...size } });
    },
  };

  for (const building of TOWN_LAYOUT.buildings) {
    const before = boxes.length;
    addCottagePhysics(physicsWorld, building);
    const expected = 4 + (building.detailColliders?.length || 0);
    assert.equal(
      boxes.length - before,
      expected,
      `${building.id} should add one porch, three fences, and its authored details`,
    );
  }

  const teaHouse = TOWN_LAYOUT.buildings.find((building) => building.id === 'mint-tea-house');
  const teaPorch = boxes.find(({ position, size }) => (
    position.x === teaHouse.position.x
    && position.z === teaHouse.position.z + teaHouse.porchCollider.offsetZ
    && size.x === teaHouse.porchCollider.size.x
  ));
  assert.ok(teaPorch, 'tea-house veranda collider should be installed');
  assert.equal(teaPorch.position.y, teaHouse.porchCollider.size.y);
});

test('the town bell sits on an elevated walkable hill reached by a three-dimensional ritual lane', () => {
  const hill = TOWN_LAYOUT.terrain?.bellHill;
  const bell = TOWN_LAYOUT.landmarks.bell;
  const route = TOWN_LAYOUT.paths.find(({ id }) => id === 'bell-hill-ritual');

  assert.ok(hill?.walkable, 'the rear Bell hill must be an authored walkable terrain feature');
  assert.ok(bell.baseY >= 2, 'the Bell base should sit on the hilltop, not the flat meadow');
  assert.equal(bell.y, bell.baseY + 0.5, 'the Bell interaction height must follow its base elevation');
  assert.ok(route, 'the Bell hill needs a dedicated approach route');
  assert.equal(route.profile, 'ritual-lane');
  assert.ok(route.width >= 1.8, 'the ritual lane must clear the 0.7m player with readable margins');
  assert.ok(route.points.length >= 6, 'the longer Bell journey needs an authored climb');
  assert.ok(route.points.every((point) => point.length === 3), 'the hill route must carry x/y/z');

  const first = route.points[0];
  const last = route.points.at(-1);
  assert.ok(last[1] - first[1] >= 2, 'the route must visibly climb onto the hill');
  assert.equal(last[0], bell.x);
  assert.equal(last[2], bell.z);
  assert.deepEqual(CORE_HOOK_V03.anchors.interactables.bell, {
    x: bell.x,
    y: bell.y,
    z: bell.z,
  });
  assert.ok(
    Math.hypot(bell.x - TOWN_LAYOUT.plaza.x, bell.z - TOWN_LAYOUT.plaza.z) >= 30,
    'ringing the Bell should require a meaningful journey beyond the plaza',
  );
  assert.match(CORE_HOOK_V03.objectives.ringBell.text, /uphill/i);
  assert.match(CORE_HOOK_V03.objectives.returnToLumen.text, /return to Steward Lumen/i);
  assert.notEqual(
    CORE_HOOK_V03.dialogue.firstBell.speaker,
    'Steward Lumen',
    'the summit response should come from the Bell itself, not a distant disembodied villager',
  );

  let maximumGrade = 0;
  for (let z = hill.z + hill.radiusZ; z >= bell.z; z -= 0.1) {
    const before = sampleMoundHeight(hill, bell.x, z - 0.05);
    const after = sampleMoundHeight(hill, bell.x, z + 0.05);
    maximumGrade = Math.max(maximumGrade, Math.abs(after - before) / 0.1);
  }
  assert.ok(maximumGrade <= 0.26, `Bell route grade ${maximumGrade} exceeds 15 degrees`);
});

test('the Bell hill belongs to a playable precinct instead of terminating at the world edge', () => {
  const hill = TOWN_LAYOUT.terrain.bellHill;
  const precinct = TOWN_LAYOUT.terrain.bellPrecinct;
  const rearHillZ = hill.z - hill.radiusZ;
  const rearLandMargin = TOWN_LAYOUT.meadowRadius - Math.hypot(hill.x, rearHillZ);

  assert.ok(rearLandMargin >= 8, `Bell hill needs 8m of rear meadow, received ${rearLandMargin}`);
  assert.ok(
    TOWN_LAYOUT.physicsGroundHalfExtent >= TOWN_LAYOUT.meadowRadius + 8,
    'collision ground must include the visible meadow plus camera clearance',
  );
  assert.ok(TOWN_LAYOUT.natureRadius <= 38, 'map expansion must not hollow out the town dressing');
  assert.equal(precinct.witnessStones.length, 5);
  assert.equal(precinct.lanterns.length, 2);
  assert.ok(precinct.groveTrees.length >= 7);
  assert.ok(
    precinct.groveTrees.every(({ x }) => Math.abs(x - TOWN_LAYOUT.landmarks.bell.x) >= 4),
    'the rear grove must preserve the Bell sightline through its center',
  );

  const visual = createBellPrecinct({
    registerSway() {},
    registerGlow() {},
  }, TOWN_LAYOUT);
  assert.equal(visual.name, 'cozy_bell_precinct');
  assert.equal(visual.getObjectByName('cozy_bell_witness_stones')?.count, 5);
  assert.equal(visual.children.filter(({ name }) => name.startsWith('cozy_bell_lantern_')).length, 2);
  assert.equal(
    visual.children.filter(({ name }) => name.startsWith('particle_bell_grove_tree_')).length,
    precinct.groveTrees.length,
  );
  visual.traverse((object) => {
    assert.notEqual(object.userData.cameraCollision, true, `${object.name} became a camera blocker`);
  });
});

test('the visible Bell hill and physics collider share one finite authored surface', () => {
  const hill = TOWN_LAYOUT.terrain.bellHill;
  const expected = createMoundSurfaceGrid(hill);
  const positionTolerance = 1e-5;
  let boundaryVertexCount = 0;
  for (let offset = 0; offset < expected.vertices.length; offset += 3) {
    const x = expected.vertices[offset];
    const y = expected.vertices[offset + 1];
    const z = expected.vertices[offset + 2];
    const normalizedRadius = Math.hypot(
      (x - hill.x) / hill.radiusX,
      (z - hill.z) / hill.radiusZ,
    );
    assert.ok(
      normalizedRadius <= 1 + positionTolerance,
      `Bell hill vertex ${normalizedRadius} escapes the oval footprint`,
    );
    if (Math.abs(normalizedRadius - 1) <= positionTolerance) {
      boundaryVertexCount += 1;
      assert.ok(
        Math.abs(y - hill.baseY) <= positionTolerance,
        `Bell hill boundary must meet the meadow at ${hill.baseY}m, received ${y}m`,
      );
    }
  }
  assert.ok(boundaryVertexCount >= 32, 'the Bell hill needs a continuous sculpted oval boundary');
  const calls = [];
  const physicsWorld = {
    createStaticTrimesh(position, vertices, indices, options) {
      calls.push({ position, vertices, indices, options });
      return { id: 'bell-hill-collider' };
    },
  };

  assert.deepEqual(addWalkableTerrainPhysics(physicsWorld, hill), {
    id: 'bell-hill-collider',
  });
  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.deepEqual(call.position, { x: 0, y: 0, z: 0 });
  assert.ok(call.vertices instanceof Float32Array);
  assert.ok(call.indices instanceof Uint32Array);
  assert.deepEqual(call.vertices, expected.vertices);
  assert.deepEqual(call.indices, expected.indices);
  assert.equal(call.options.friction, 0.95);
  assert.ok([...call.vertices].every(Number.isFinite));
  assert.ok([...call.indices].every(Number.isInteger));

  const visualRoot = createGroundDressing({
    registerBob() {},
    registerSway() {},
  }, TOWN_LAYOUT, { assetVariant: 'baseline' });
  const visualHill = visualRoot.getObjectByName('cozy_walkable_bell_hill');
  assert.ok(visualHill?.isMesh);
  assert.equal(visualHill.userData.walkable, true);
  assert.equal(visualHill.userData.cameraCollision, true);
  assert.deepEqual(
    visualHill.geometry.getAttribute('position').array,
    call.vertices,
    'rendering and Rapier must consume the same sampled surface',
  );
  assert.deepEqual(
    [...visualHill.geometry.index.array],
    [...call.indices],
    'rendering and Rapier must consume the same triangle topology',
  );

  const summit = sampleMoundHeight(hill, hill.x, hill.z);
  assert.ok(Math.abs(summit - TOWN_LAYOUT.landmarks.bell.baseY) < 1e-9);
});

test('real Rapier walk and sprint stay grounded across the Bell hill', async () => {
  const physics = new PhysicsWorld();
  await physics.init();
  physics.createGround(55);
  addWalkableTerrainPhysics(physics);
  const hill = TOWN_LAYOUT.terrain.bellHill;
  const startZ = -18;
  const footOffset = 0.9;
  const motor = new CharacterMotor(physics).init({
    x: hill.x,
    y: Math.max(0, sampleMoundHeight(hill, hill.x, startZ)) + footOffset,
    z: startZ,
  });
  const dt = 1 / 120;

  try {
    let phase = 'climb';
    let summitPauseFrames = 0;
    let falseTransitions = 0;
    let maximumWalkFootError = 0;
    let maximumSprintFootError = 0;
    let maximumPhysicsFootError = 0;

    for (let frame = 0; frame < 1800; frame += 1) {
      const z = motor.getPosition().z;
      if (phase === 'climb' && z <= TOWN_LAYOUT.landmarks.bell.z + 0.45) {
        phase = 'summit';
        summitPauseFrames = 120;
      } else if (phase === 'summit') {
        summitPauseFrames -= 1;
        if (summitPauseFrames <= 0) phase = 'descent';
      }
      const sprinting = phase === 'climb' && z < -27;
      physics.step(dt);
      motor.update(dt, {
        x: 0,
        z: phase === 'climb' ? 1 : (phase === 'descent' ? -1 : 0),
      }, 0, {
        targetSpeed: sprinting ? motor.sprintSpeed : motor.walkSpeed,
        sprinting,
        jumpHeld: false,
      });

      if (frame >= 90 && phase !== 'summit') {
        if (motor.justLeftGround || motor.justLanded) falseTransitions += 1;
        const position = motor.getPosition();
        const terrainY = Math.max(0, sampleMoundHeight(hill, position.x, position.z));
        const renderError = Math.abs(position.y - footOffset - terrainY);
        if (sprinting) {
          maximumSprintFootError = Math.max(maximumSprintFootError, renderError);
        } else {
          maximumWalkFootError = Math.max(maximumWalkFootError, renderError);
        }

        const physicsPosition = motor.getPhysicsPosition();
        const physicsTerrainY = Math.max(
          0,
          sampleMoundHeight(hill, physicsPosition.x, physicsPosition.z),
        );
        maximumPhysicsFootError = Math.max(
          maximumPhysicsFootError,
          Math.abs(physicsPosition.y - footOffset - physicsTerrainY),
        );
      }

      if (phase === 'descent' && motor.getPosition().z >= startZ) break;
    }

    assert.equal(falseTransitions, 0, 'the slope must not manufacture airborne/landing events');
    assert.ok(maximumPhysicsFootError <= 0.03, `physics foot error ${maximumPhysicsFootError}`);
    // The render pose intentionally filters KCC steps. Keep its slope lag
    // below a small fraction of the 1.8m character while physical contact is
    // held to the stricter three-centimetre invariant above.
    assert.ok(maximumWalkFootError <= 0.10, `walk render-foot error ${maximumWalkFootError}`);
    assert.ok(maximumSprintFootError <= 0.07, `sprint render-foot error ${maximumSprintFootError}`);
    assert.equal(motor.isGrounded, true);
  } finally {
    physics.world?.free();
  }
});
