import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BoxGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Vector3,
} from 'three';
import {
  getBuildingBounds,
  getBuildingDoorApproach,
  TOWN_LAYOUT,
} from '../src/config/town.js';
import {
  STORY_ROUTE_GRAMMAR,
  STORY_ROUTES,
  StoryWorld,
} from '../src/visuals/StoryWorld.js';

function expandBounds(bounds, amount) {
  return {
    minX: bounds.minX - amount,
    maxX: bounds.maxX + amount,
    minZ: bounds.minZ - amount,
    maxZ: bounds.maxZ + amount,
  };
}

function segmentIntersectsBounds(start, end, bounds) {
  let tMin = 0;
  let tMax = 1;

  for (const axis of ['x', 'z']) {
    const min = bounds[`min${axis.toUpperCase()}`];
    const max = bounds[`max${axis.toUpperCase()}`];
    const delta = end[axis] - start[axis];

    if (Math.abs(delta) < 1e-9) {
      if (start[axis] < min || start[axis] > max) return false;
      continue;
    }

    const entry = (min - start[axis]) / delta;
    const exit = (max - start[axis]) / delta;
    tMin = Math.max(tMin, Math.min(entry, exit));
    tMax = Math.min(tMax, Math.max(entry, exit));
    if (tMin > tMax) return false;
  }

  return true;
}

function sampleRoute(points, t, target = new Vector3()) {
  const clamped = Math.max(0, Math.min(0.999999, t));
  const lengths = [];
  let totalLength = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const length = points[index].distanceTo(points[index + 1]);
    lengths.push(length);
    totalLength += length;
  }

  let remaining = clamped * totalLength;
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      return target.copy(points[index]).lerp(
        points[index + 1],
        lengths[index] > 0 ? remaining / lengths[index] : 0,
      );
    }
    remaining -= lengths[index];
  }
  return target.copy(points.at(-1));
}

function routeFrameAt(points, t) {
  const center = sampleRoute(points, t);
  const before = sampleRoute(points, Math.max(0, t - 0.0025));
  const after = sampleRoute(points, Math.min(0.999999, t + 0.0025));
  const tangent = after.sub(before).setY(0).normalize();
  const normal = new Vector3(tangent.z, 0, -tangent.x);
  return { center, tangent, normal };
}

function assertNear(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

test('story trails keep player clearance from every cottage collider', () => {
  // CharacterMotor uses a 0.35 m capsule radius; the remaining 0.45 m keeps
  // the glowing markers visibly separated from cottage walls and rooflines.
  for (const [routeId, points] of Object.entries(STORY_ROUTES)) {
    for (const building of TOWN_LAYOUT.buildings) {
      const clearanceBounds = expandBounds(getBuildingBounds(building), 0.8);
      for (let index = 0; index < points.length - 1; index += 1) {
        assert.equal(
          segmentIntersectsBounds(points[index], points[index + 1], clearanceBounds),
          false,
          `${routeId} segment ${index} enters ${building.id} clearance bounds`,
        );
      }
    }
  }
});

test('story-route markers remain a readable continuous trail around the detour', () => {
  const scene = new Scene();
  const storyWorld = new StoryWorld(scene, { reducedMotion: true }).init();
  storyWorld.setRoute('alter');

  const route = scene.getObjectByName('story_route_alter');
  const matrix = new Matrix4();
  const previous = new Vector3();
  const current = new Vector3();

  route.getMatrixAt(0, matrix);
  previous.setFromMatrixPosition(matrix);
  for (let index = 1; index < route.count; index += 1) {
    route.getMatrixAt(index, matrix);
    current.setFromMatrixPosition(matrix);
    const horizontalGap = Math.hypot(current.x - previous.x, current.z - previous.z);
    assert.ok(horizontalGap < 0.95, `route marker gap ${horizontalGap.toFixed(3)} m is too large`);
    previous.copy(current);
  }

  storyWorld.dispose();
});

test('route consequences use distinct witness-stitch and ink-thorn grammars', () => {
  const scene = new Scene();
  const storyWorld = new StoryWorld(scene).init();
  storyWorld.setRoute('comply');

  const comply = scene.getObjectByName('story_route_comply');
  const witness = scene.getObjectByName('story_route_comply_witness_pair');
  const alter = scene.getObjectByName('story_route_alter');
  assert.equal(comply.count, STORY_ROUTE_GRAMMAR.comply.count);
  assert.equal(comply.userData.markerGrammar, 'paired-witness-stitches');
  assert.equal(comply.geometry.type, 'BoxGeometry');
  assert.equal(witness.count, comply.count);
  assert.equal(witness.userData.markerGrammar, 'paired-witness-stitches');
  assert.equal(alter.count, STORY_ROUTE_GRAMMAR.alter.count);
  assert.equal(alter.userData.markerGrammar, 'single-ink-thorns');
  assert.equal(alter.geometry.type, 'ConeGeometry');
  assert.equal(scene.getObjectByName('story_route_alter_witness_pair'), undefined);

  storyWorld.setRoute('alter');
  assert.equal(comply.visible, false);
  assert.equal(witness.visible, false);
  assert.equal(alter.visible, true);
  storyWorld.dispose();
});

test('comply witness stitches straddle the unchanged route sample on its normal', () => {
  const scene = new Scene();
  const storyWorld = new StoryWorld(scene, { reducedMotion: true }).init();
  storyWorld.setRoute('comply');

  const primary = scene.getObjectByName('story_route_comply');
  const witness = scene.getObjectByName('story_route_comply_witness_pair');
  const { width, height, depth } = primary.geometry.parameters;
  assert.ok(width >= 0.32, 'stitch length must remain readable at default framing');
  assert.ok(height >= 0.04, 'stitch height must avoid disappearing into the path');
  assert.ok(depth >= 0.075, 'stitch width must remain readable at default framing');
  assert.ok(primary.material.emissiveIntensity >= 1.35);
  assert.ok(primary.material.opacity >= 0.96);
  assert.ok(witness.material.emissiveIntensity >= 1.08);
  assert.ok(witness.material.opacity >= 0.84);

  const primaryMatrix = new Matrix4();
  const witnessMatrix = new Matrix4();
  const primaryPosition = new Vector3();
  const witnessPosition = new Vector3();
  const primaryOffset = new Vector3();
  const witnessOffset = new Vector3();
  const midpoint = new Vector3();
  const localLongAxis = new Vector3();

  for (const index of [3, 12, 21, 27]) {
    const t = index / (primary.count - 1);
    const { center, tangent, normal } = routeFrameAt(STORY_ROUTES.comply, t);
    primary.getMatrixAt(index, primaryMatrix);
    witness.getMatrixAt(index, witnessMatrix);
    primaryPosition.setFromMatrixPosition(primaryMatrix);
    witnessPosition.setFromMatrixPosition(witnessMatrix);

    primaryOffset.copy(primaryPosition).sub(center).setY(0);
    witnessOffset.copy(witnessPosition).sub(center).setY(0);
    assertNear(primaryOffset.dot(tangent), 0, 1e-5, `primary tangent drift at ${index}`);
    assertNear(witnessOffset.dot(tangent), 0, 1e-5, `witness tangent drift at ${index}`);
    assertNear(primaryOffset.dot(normal), -0.12, 1e-5, `primary normal offset at ${index}`);
    assertNear(witnessOffset.dot(normal), 0.12, 1e-5, `witness normal offset at ${index}`);
    assertNear(
      Math.hypot(
        primaryPosition.x - witnessPosition.x,
        primaryPosition.z - witnessPosition.z,
      ),
      0.24,
      1e-5,
      `witness-pair separation at ${index}`,
    );

    midpoint.copy(primaryPosition).add(witnessPosition).multiplyScalar(0.5);
    assertNear(midpoint.x, center.x, 1e-5, `pair midpoint x at ${index}`);
    assertNear(midpoint.z, center.z, 1e-5, `pair midpoint z at ${index}`);

    localLongAxis.set(
      primaryMatrix.elements[0],
      primaryMatrix.elements[1],
      primaryMatrix.elements[2],
    ).normalize();
    assert.ok(
      Math.abs(localLongAxis.dot(tangent)) >= 0.999,
      `stitch ${index} must run longitudinally so the normal-side pair stays distinct`,
    );
  }

  storyWorld.dispose();
});

test('alter ink-thorns preserve sparse grammar above a minimum visible footprint', () => {
  const scene = new Scene();
  const storyWorld = new StoryWorld(scene, { reducedMotion: true }).init();
  storyWorld.setRoute('alter');

  const route = scene.getObjectByName('story_route_alter');
  assert.equal(route.count, 30);
  assert.equal(
    [...storyWorld.routes.values()].filter((mesh) => mesh.userData.routeId === 'alter').length,
    1,
    'alter must remain exactly one instanced draw',
  );
  assert.equal(storyWorld.routeCompanions.has('alter'), false);
  assert.ok(route.geometry.parameters.radius >= 0.065);
  assert.ok(route.geometry.parameters.height >= 0.42);
  assert.ok(route.material.emissiveIntensity >= 1.05);
  assert.ok(route.material.opacity >= 0.90);

  const matrix = new Matrix4();
  const position = new Vector3();
  const offset = new Vector3();
  const scale = new Vector3();
  const expectedScale = [1, 0.72, 0.52];

  for (let index = 0; index < route.count; index += 1) {
    const t = index / (route.count - 1);
    const { center, tangent, normal } = routeFrameAt(STORY_ROUTES.alter, t);
    route.getMatrixAt(index, matrix);
    position.setFromMatrixPosition(matrix);
    offset.copy(position).sub(center).setY(0);
    assertNear(offset.dot(tangent), 0, 1e-5, `thorn tangent drift at ${index}`);
    assertNear(
      Math.abs(offset.dot(normal)),
      0.07,
      1e-5,
      `thorn lateral jitter at ${index}`,
    );

    scale.setFromMatrixScale(matrix);
    assertNear(scale.x, expectedScale[index % 3], 1e-5, `thorn scale at ${index}`);
    assert.ok(
      route.geometry.parameters.height * scale.x >= 0.218,
      `thorn ${index} falls below the minimum 0.218 m visible stroke`,
    );
  }

  storyWorld.dispose();
});

test('reduced motion route matrices remain still across animation updates', () => {
  const scene = new Scene();
  const storyWorld = new StoryWorld(scene, { reducedMotion: true }).init();
  storyWorld.setRoute('comply');
  const route = scene.getObjectByName('story_route_comply');
  const before = new Matrix4();
  const after = new Matrix4();
  route.getMatrixAt(12, before);
  storyWorld.update(5);
  route.getMatrixAt(12, after);
  assert.deepEqual(after.elements, before.elements);
  storyWorld.dispose();
});

test('restored anomaly state projects false violet ledger treatment', () => {
  const scene = new Scene();
  const boardMesh = new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({ color: 0xffffff }),
  );
  boardMesh.name = 'cozy_ledger_board';
  const sparkleMesh = new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000 }),
  );
  sparkleMesh.name = 'cozy_ledger_sparkle';
  scene.add(boardMesh, sparkleMesh);

  const storyWorld = new StoryWorld(scene).init();
  storyWorld.setStoryState({
    phase: 'night-investigation',
    choices: {},
    eventsSeen: [
      'arrival-letter-seen',
      'steward-lumen-met',
      'community-ledger-signed',
      'dusk-bell-rung',
      'night-bell-rang-itself',
    ],
  });

  assert.equal(storyWorld.ledgerMood, 'false');
  assert.equal(boardMesh.material.color.getHex(), 0x68445f);
  assert.equal(sparkleMesh.material.emissive.getHex(), 0x9785ff);
  assert.equal(storyWorld.activeRoute, null);
  storyWorld.dispose();
  boardMesh.geometry.dispose();
  boardMesh.material.dispose();
  sparkleMesh.geometry.dispose();
  sparkleMesh.material.dispose();
});

test('every ledger mood reaches isolated baseline and authored pilot materials', () => {
  const scene = new Scene();
  const sharedBoardMaterial = new MeshStandardMaterial({ color: 0xf2d19c });
  sharedBoardMaterial.name = 'TV_Cream';
  const sharedGlowMaterial = new MeshStandardMaterial({
    color: 0xffdc83,
    emissive: 0xffb956,
    emissiveIntensity: 0.18,
  });
  sharedGlowMaterial.name = 'TV_Window_Glow';

  const baselineBoard = new Mesh(new BoxGeometry(1, 1, 1), sharedBoardMaterial);
  baselineBoard.name = 'cozy_ledger_board';
  const baselineSparkle = new Mesh(new BoxGeometry(1, 1, 1), sharedGlowMaterial);
  baselineSparkle.name = 'cozy_ledger_sparkle';
  const authoredBoard = new Mesh(new BoxGeometry(1, 1, 1), sharedBoardMaterial);
  authoredBoard.name = 'CommunityLedger_Cream';
  const authoredSparkle = new Mesh(new BoxGeometry(1, 1, 1), sharedGlowMaterial);
  authoredSparkle.name = 'CommunityLedger_Window_Glow';

  // The pilot loader remaps TV_Window_Glow to a town-wide shared material;
  // the procedural kit shares its cream and glow materials too. Ledger moods
  // must never tint unrelated windows or structures through those references.
  const unrelatedBoard = new Mesh(new BoxGeometry(1, 1, 1), sharedBoardMaterial);
  unrelatedBoard.name = 'unrelated_cream_structure';
  const unrelatedWindow = new Mesh(new BoxGeometry(1, 1, 1), sharedGlowMaterial);
  unrelatedWindow.name = 'unrelated_town_window';
  scene.add(
    baselineBoard,
    baselineSparkle,
    authoredBoard,
    authoredSparkle,
    unrelatedBoard,
    unrelatedWindow,
  );

  const storyWorld = new StoryWorld(scene).init();
  const palettes = {
    normal: { sparkle: 0xffc6df, board: 0x7f5148, intensity: 1.05 },
    signed: { sparkle: 0xffef9d, board: 0x7f5148, intensity: 1.05 },
    false: { sparkle: 0x9785ff, board: 0x68445f, intensity: 1.8 },
    comply: { sparkle: 0xffd28c, board: 0x86503f, intensity: 1.05 },
    alter: { sparkle: 0xb8c7ff, board: 0x58466f, intensity: 1.05 },
  };

  for (const [mood, palette] of Object.entries(palettes)) {
    storyWorld.setLedgerMood(mood);
    for (const board of [baselineBoard, authoredBoard]) {
      assert.equal(board.material.color.getHex(), palette.board, `${mood} ${board.name}`);
      assert.notStrictEqual(board.material, sharedBoardMaterial);
    }
    for (const sparkle of [baselineSparkle, authoredSparkle]) {
      assert.equal(sparkle.material.color.getHex(), palette.sparkle, `${mood} ${sparkle.name}`);
      assert.equal(sparkle.material.emissive.getHex(), palette.sparkle);
      assert.equal(sparkle.material.emissiveIntensity, palette.intensity);
      assert.notStrictEqual(sparkle.material, sharedGlowMaterial);
    }
    assert.equal(unrelatedBoard.material.color.getHex(), 0xf2d19c);
    assert.equal(unrelatedWindow.material.color.getHex(), 0xffdc83);
    assert.equal(unrelatedWindow.material.emissive.getHex(), 0xffb956);
    assert.equal(unrelatedWindow.material.emissiveIntensity, 0.18);
  }

  storyWorld.dispose();
  assert.strictEqual(baselineBoard.material, sharedBoardMaterial);
  assert.strictEqual(authoredBoard.material, sharedBoardMaterial);
  assert.strictEqual(baselineSparkle.material, sharedGlowMaterial);
  assert.strictEqual(authoredSparkle.material, sharedGlowMaterial);

  for (const mesh of [
    baselineBoard,
    baselineSparkle,
    authoredBoard,
    authoredSparkle,
    unrelatedBoard,
    unrelatedWindow,
  ]) {
    mesh.geometry.dispose();
  }
  sharedBoardMaterial.dispose();
  sharedGlowMaterial.dispose();
});

test('StoryWorld disposes every primary and companion route resource', () => {
  const scene = new Scene();
  const storyWorld = new StoryWorld(scene).init();
  const resources = new Set();
  for (const mesh of [...storyWorld.routes.values(), ...storyWorld.routeCompanions.values()]) {
    resources.add(mesh.geometry);
    resources.add(mesh.material);
  }
  const disposed = new Set();
  for (const resource of resources) {
    resource.dispose = () => disposed.add(resource);
  }

  storyWorld.dispose();
  assert.equal(disposed.size, resources.size);
  assert.equal(scene.getObjectByName('story_world_consequences'), undefined);
});

test('the compliant cottage route ends on the expanded tea-house doorstep', () => {
  const teaHouse = TOWN_LAYOUT.buildings.find((building) => building.id === 'mint-tea-house');
  const teaHouseBounds = getBuildingBounds('mint-tea-house');
  const approach = getBuildingDoorApproach('mint-tea-house');
  const destination = STORY_ROUTES.comply.at(-1);
  assert.equal(destination.x, approach.x);
  assert.equal(destination.z, approach.z);
  assert.ok(destination.z < teaHouseBounds.minZ);
  assert.ok(teaHouseBounds.minZ - destination.z >= 0.35);
  const porch = teaHouse.porchCollider;
  const porchCenterZ = teaHouse.position.z + porch.offsetZ;
  assert.ok(Math.abs(destination.x - teaHouse.position.x) <= porch.size.x * 0.5);
  assert.ok(Math.abs(destination.z - porchCenterZ) <= porch.size.z * 0.5);
  assert.ok(
    destination.y > porch.size.y * 1.5,
    'final route marker should float above the veranda surface',
  );
});

test('expanded cottages leave a generous ring around the story plaza', () => {
  for (const building of TOWN_LAYOUT.buildings) {
    const bounds = getBuildingBounds(building);
    const nearestX = Math.max(bounds.minX, Math.min(TOWN_LAYOUT.plaza.x, bounds.maxX));
    const nearestZ = Math.max(bounds.minZ, Math.min(TOWN_LAYOUT.plaza.z, bounds.maxZ));
    const plazaClearance = Math.hypot(
      nearestX - TOWN_LAYOUT.plaza.x,
      nearestZ - TOWN_LAYOUT.plaza.z,
    ) - TOWN_LAYOUT.plaza.radius;
    assert.ok(
      plazaClearance >= 4,
      `${building.id} leaves only ${plazaClearance.toFixed(2)} m beyond the plaza edge`,
    );
  }
});

test('the authored garden arch clears the tea-house render envelope', () => {
  const teaHouseBounds = getBuildingBounds('mint-tea-house');
  const arch = TOWN_LAYOUT.authoredProps.gardenArch;
  const nearestX = Math.max(teaHouseBounds.minX, Math.min(arch.x, teaHouseBounds.maxX));
  const nearestZ = Math.max(teaHouseBounds.minZ, Math.min(arch.z, teaHouseBounds.maxZ));
  const centerClearance = Math.hypot(arch.x - nearestX, arch.z - nearestZ);
  assert.ok(
    centerClearance >= 2.5,
    `garden arch center leaves only ${centerClearance.toFixed(2)} m from tea-house walls`,
  );
});
