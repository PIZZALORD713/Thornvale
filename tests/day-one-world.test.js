import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Scene, Vector3 } from 'three';
import { DAY_ONE_V01 } from '../src/content/day-one-v01.js';
import { getBuildingBounds, TOWN_LAYOUT } from '../src/config/town.js';
import {
  createDayOneWorld,
  DAY_ONE_WORLD_INTERACTIONS,
} from '../src/visuals/DayOneWorld.js';

test('Day One world exposes the authored resource stations at their visible anchors', () => {
  const world = createDayOneWorld({ reducedMotion: true });
  const expectedIds = Object.values(DAY_ONE_V01.ids);

  assert.deepEqual(DAY_ONE_WORLD_INTERACTIONS.map(({ id }) => id), expectedIds);
  assert.deepEqual(world.interactables.map(({ id }) => id), expectedIds);
  assert.equal(new Set(world.interactables.map(({ id }) => id)).size, expectedIds.length);

  for (const contract of DAY_ONE_WORLD_INTERACTIONS) {
    const interactable = world.interactables.find(({ id }) => id === contract.id);
    const anchor = DAY_ONE_V01.anchors[contract.site];
    assert.ok(interactable.position instanceof Vector3);
    assert.deepEqual(interactable.position.toArray(), [anchor.x, anchor.y, anchor.z]);
    assert.ok(interactable.radius >= 2);
    assert.equal(typeof interactable.prompt, 'string');
  }

  assert.equal(TOWN_LAYOUT.dayOne, DAY_ONE_V01.anchors);
  assert.ok(TOWN_LAYOUT.paths.some(({ id }) => id === 'forest-edge-camp'));
  assert.equal(
    TOWN_LAYOUT.paths.some(({ id }) => id === 'provisional-camp-clearing'),
    false,
  );
  assert.equal(world.root.userData.cameraCollision, false);
  assert.equal(world.root.userData.physicsCollision, false);
  world.dispose();
});

function distanceToBounds(point, bounds) {
  const dx = Math.max(bounds.minX - point.x, 0, point.x - bounds.maxX);
  const dz = Math.max(bounds.minZ - point.z, 0, point.z - bounds.maxZ);
  return Math.hypot(dx, dz);
}

function distanceBetweenXZ(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

test('Day One camp reads as a separate, reachable forest-edge clearing', () => {
  const anchors = DAY_ONE_V01.anchors;
  const coreSites = ['campfire', 'garden', 'shelter'];
  const footprintRadius = {
    camp: 1.5,
    campfire: 0.7,
    garden: 1.4,
    shelter: 1.8,
    woodlot: 1.4,
  };

  const coreCentroidX = coreSites.reduce((sum, site) => sum + anchors[site].x, 0)
    / coreSites.length;
  assert.ok(coreCentroidX <= -27, 'the working camp should sit near the western map edge');
  assert.ok(anchors.shelter.x <= -31, 'the shelter should establish the clearing edge');
  for (const site of coreSites) {
    const point = anchors[site];
    for (const building of TOWN_LAYOUT.buildings) {
      const clearance = distanceToBounds(point, getBuildingBounds(building));
      assert.ok(
        clearance >= 5,
        `${site} should clear ${building.id} by at least 5m; received ${clearance.toFixed(2)}m`,
      );
    }
  }

  for (let left = 0; left < coreSites.length; left += 1) {
    for (let right = left + 1; right < coreSites.length; right += 1) {
      const leftSite = coreSites[left];
      const rightSite = coreSites[right];
      const leftPoint = anchors[leftSite];
      const rightPoint = anchors[rightSite];
      const openGround = Math.hypot(
        leftPoint.x - rightPoint.x,
        leftPoint.z - rightPoint.z,
      ) - footprintRadius[leftSite] - footprintRadius[rightSite];
      assert.ok(
        openGround >= 1.25,
        `${leftSite} and ${rightSite} should have 1.25m of open ground; received ${openGround.toFixed(2)}m`,
      );
    }
  }

  const interactionRadius = Object.fromEntries(
    DAY_ONE_WORLD_INTERACTIONS.map(({ site, radius }) => [site, radius]),
  );
  for (let left = 0; left < coreSites.length; left += 1) {
    for (let right = left + 1; right < coreSites.length; right += 1) {
      const leftSite = coreSites[left];
      const rightSite = coreSites[right];
      const leftPoint = anchors[leftSite];
      const rightPoint = anchors[rightSite];
      const promptGap = Math.hypot(
        leftPoint.x - rightPoint.x,
        leftPoint.z - rightPoint.z,
      ) - interactionRadius[leftSite] - interactionRadius[rightSite];
      assert.ok(
        promptGap >= 0.2,
        `${leftSite} and ${rightSite} prompts should not compete; received ${promptGap.toFixed(2)}m`,
      );
    }
  }

  for (const [site, radius] of Object.entries(footprintRadius)) {
    const point = anchors[site];
    const boundaryClearance = TOWN_LAYOUT.meadowRadius - Math.hypot(point.x, point.z) - radius;
    assert.ok(
      boundaryClearance >= 4,
      `${site} should retain a 4m meadow-edge margin; received ${boundaryClearance.toFixed(2)}m`,
    );
  }

  const route = TOWN_LAYOUT.paths.find(({ id }) => id === 'forest-edge-camp');
  assert.ok(route);
  for (let index = 1; index < route.points.length; index += 1) {
    assert.ok(
      distanceBetweenXZ(route.points[index - 1], route.points[index]) <= 5,
      'camp path segments should remain continuous and readable',
    );
  }
  const destination = route.points.at(-1);
  assert.ok(
    distanceBetweenXZ(destination, [anchors.campRecovery.x, anchors.campRecovery.z]) <= 1.5,
    'the narrow town approach should reach the safe recovery point',
  );
  for (const site of ['camp', 'campRecovery', 'campfire', 'garden', 'shelter', 'woodlot']) {
    assert.equal(
      TOWN_LAYOUT.grassExclusions.filter((exclusion) => exclusion.site === site).length,
      1,
      `${site} should have one local grass exclusion rather than a shared dirt pad`,
    );
  }
  const alterDestination = TOWN_LAYOUT.storyRoutes.alter.at(-1);
  assert.ok(
    route.points.some((point) => distanceBetweenXZ(
      point,
      [alterDestination[0], alterDestination[2]],
    ) <= 0.05),
    'the altered story route should join a control point on the visible camp approach',
  );
});

test('Day One world projects progress without owning gameplay state', () => {
  const world = createDayOneWorld({ reducedMotion: true });

  assert.ok(world.shelterCollapsed, 'the unfinished shelter needs a collapsed projection');
  assert.ok(world.shelterErected, 'the repaired shelter needs a standing projection');
  assert.equal(world.shelterCollapsed.visible, true);
  assert.equal(world.shelterErected.visible, false);
  const collapsedBounds = new Box3().setFromObject(world.shelterCollapsed);
  const erectedBounds = new Box3().setFromObject(world.shelterErected);
  assert.ok(collapsedBounds.max.y <= 0.65, 'collapsed shelter silhouette stays near the ground');
  assert.ok(erectedBounds.max.y >= 1.35, 'repaired shelter restores a standing roofline');
  assert.ok(
    erectedBounds.max.y - collapsedBounds.max.y >= 0.7,
    'repair creates a legible silhouette change',
  );
  assert.equal(world.fireFlame.visible, false);
  assert.equal(world.shelterRepair.visible, false);
  assert.equal(world.shelterTear.visible, true);
  assert.equal(world.plantedSeeds.visible, false);
  assert.equal(world.wateredGlints.visible, false);
  assert.equal(world.fishingBobber.visible, true);
  assert.equal(world.fishCatch.visible, false);
  assert.equal(world._woodPieces.filter(({ visible }) => visible).length, 5);

  const snapshot = {
    dayOne: {
      camp: { fireLit: true, shelterRepaired: true },
      garden: { planted: true, watered: true },
      inventory: { cookedFish: 1 },
      activity: { woodGathered: 6, fishCaught: 1 },
    },
  };
  world.setState(snapshot);

  assert.equal(world._state, snapshot.dayOne);
  assert.equal(world.fireFlame.visible, true);
  assert.equal(world.cookedFishVisual.visible, true);
  assert.equal(world.shelterCollapsed.visible, false);
  assert.equal(world.shelterErected.visible, true);
  assert.equal(world.shelterRepair.visible, true);
  assert.equal(world.shelterTear.visible, false);
  assert.equal(world.plantedSeeds.visible, true);
  assert.equal(world.wateredGlints.visible, true);
  assert.ok(world._soilMeshes.every(({ material }) => material === world.wetSoilMaterial));
  assert.equal(world._woodPieces.filter(({ visible }) => visible).length, 2);
  assert.equal(world.fishingBobber.visible, false);
  assert.equal(world.fishCatch.visible, true);

  // A later or reset snapshot deterministically restores the projection; the
  // visual never mutates the supplied snapshot in order to get there.
  world.setState(null);
  assert.deepEqual(snapshot.dayOne, {
    camp: { fireLit: true, shelterRepaired: true },
    garden: { planted: true, watered: true },
    inventory: { cookedFish: 1 },
    activity: { woodGathered: 6, fishCaught: 1 },
  });
  assert.equal(world.fireFlame.visible, false);
  assert.equal(world.shelterCollapsed.visible, true);
  assert.equal(world.shelterErected.visible, false);
  assert.equal(world._woodPieces.filter(({ visible }) => visible).length, 5);
  world.dispose();
});

test('clipless chores animate truthful code-native props and restore them on completion', () => {
  const world = createDayOneWorld();
  world.setState({
    camp: { fireLit: true, shelterRepaired: false },
    garden: { planted: true, watered: false },
    inventory: { cookedFish: 1 },
    activity: { woodGathered: 0, fishCaught: 0 },
  });
  const probes = {
    chopWood: () => world.woodlotAxe.quaternion.toArray(),
    catchFish: () => world.fishingRod.quaternion.toArray(),
    lightFire: () => world.campfireVisual.scale.toArray(),
    cookFish: () => world.fishRotor.quaternion.toArray(),
    eatFish: () => world.cookedFishVisual.scale.toArray(),
    repairShelter: () => world.shelterVisual.quaternion.toArray(),
  };

  for (const [index, [actionKey, probe]] of Object.entries(probes).entries()) {
    const action = DAY_ONE_V01.actions[actionKey];
    const event = (type, progress) => ({
      type,
      id: action.id,
      action,
      duration: action.duration,
      commitTime: action.commitTime,
      progress,
    });
    const before = probe();
    assert.equal(world.handleAction(event('start', 0)), true, actionKey);
    assert.equal(world.handleAction(event('progress', 0.45)), true, actionKey);
    world.update(1 / 60);
    assert.notDeepEqual(probe(), before, `${actionKey} should visibly move its world prop`);
    const terminalType = index % 2 === 0 ? 'complete' : 'cancel';
    assert.equal(world.handleAction(event(terminalType, 1)), true, actionKey);
    assert.deepEqual(probe(), before, `${actionKey} should restore its transient transform`);
  }

  world.dispose();
});

test('cooking turns the meal around the horizontal spit without rotating its supports', () => {
  const world = createDayOneWorld();
  const action = DAY_ONE_V01.actions.cookFish;
  const event = (type, progress) => ({
    type,
    id: action.id,
    action,
    duration: action.duration,
    commitTime: action.commitTime,
    progress,
  });
  const authoredRootPosition = world.cookedFishVisual.position.toArray();
  const authoredRootRotation = world.cookedFishVisual.quaternion.toArray();
  const supports = world.cookedFishVisual.children.filter(
    ({ name }) => name === 'day_one_cooking_spit_support',
  );
  const authoredSupports = supports.map(({ quaternion }) => quaternion.toArray());

  assert.ok(world.fishRotor, 'the rod and meal need a dedicated rotisserie pivot');
  world.handleAction(event('start', 0));
  world.handleAction(event('progress', 0.25));
  world.update(1 / 60);

  const rotatedAxis = new Vector3(1, 0, 0).applyQuaternion(
    world.fishRotor.quaternion,
  );
  assert.ok(Math.abs(rotatedAxis.x - 1) < 1e-9);
  assert.ok(Math.abs(rotatedAxis.y) < 1e-9);
  assert.ok(Math.abs(rotatedAxis.z) < 1e-9);
  assert.ok(Math.abs(world.fishRotor.rotation.x - Math.PI / 2) < 1e-9);
  assert.deepEqual(world.cookedFishVisual.position.toArray(), authoredRootPosition);
  assert.deepEqual(world.cookedFishVisual.quaternion.toArray(), authoredRootRotation);
  assert.deepEqual(
    supports.map(({ quaternion }) => quaternion.toArray()),
    authoredSupports,
  );

  world.handleAction(event('complete', 1));
  assert.ok(Math.abs(world.fishRotor.rotation.x) < 1e-9);
  world.dispose();
});

test('the repair commit swaps shelter states without a terminal-frame flash', () => {
  const world = createDayOneWorld();
  const action = DAY_ONE_V01.actions.repairShelter;
  const event = (type, progress) => ({
    type,
    id: action.id,
    action,
    duration: action.duration,
    commitTime: action.commitTime,
    progress,
  });
  const authoredRotation = world.shelterVisual.quaternion.toArray();

  world.handleAction(event('start', 0));
  world.handleAction(event('progress', 0.6));
  world.update(1 / 60);
  assert.notDeepEqual(world.shelterVisual.quaternion.toArray(), authoredRotation);

  world.setState({ camp: { shelterRepaired: true } });
  world.handleAction(event('progress', 0.9));
  world.update(1 / 60);
  world.handleAction(event('complete', 1));

  assert.equal(world.shelterCollapsed.visible, false);
  assert.equal(world.shelterErected.visible, true);
  assert.deepEqual(world.shelterVisual.quaternion.toArray(), authoredRotation);
  world.dispose();
});

test('reduced motion preserves native state cues without moving props', () => {
  const world = createDayOneWorld({ reducedMotion: true });
  const action = DAY_ONE_V01.actions.chopWood;
  const before = world.woodlotAxe.quaternion.toArray();
  world.handleAction({ type: 'start', id: action.id, action, progress: 0 });
  world.handleAction({
    type: 'progress',
    id: action.id,
    action,
    duration: action.duration,
    commitTime: action.commitTime,
    progress: 0.5,
  });
  world.update(1 / 60);
  assert.deepEqual(world.woodlotAxe.quaternion.toArray(), before);

  world.setState({ camp: { fireLit: true } });
  assert.equal(world.fireFlame.visible, true, 'authoritative state projection remains visible');
  world.handleAction({ type: 'cancel', id: action.id, action, progress: 0.5 });
  assert.equal(world._actionCue, null);
  world.dispose();
});

test('disposing during a native cue restores and clears its transient state', () => {
  const world = createDayOneWorld();
  const action = DAY_ONE_V01.actions.chopWood;
  const before = world.woodlotAxe.quaternion.toArray();
  world.handleAction({ type: 'start', id: action.id, action, progress: 0 });
  world.handleAction({
    type: 'progress',
    id: action.id,
    action,
    duration: action.duration,
    commitTime: action.commitTime,
    progress: 0.45,
  });
  world.update(1 / 60);
  assert.notDeepEqual(world.woodlotAxe.quaternion.toArray(), before);

  world.dispose();

  assert.deepEqual(world.woodlotAxe.quaternion.toArray(), before);
  assert.equal(world._actionCue, null);
  assert.equal(world._actionTransforms.size, 0);
});

test('Day One world releases its code-native GPU resources', () => {
  const world = createDayOneWorld({ reducedMotion: true });
  const scene = new Scene();
  scene.add(world.root);
  const geometry = [...world._geometries][0];
  const material = [...world._materials][0];
  let geometryDisposed = false;
  let materialDisposed = false;
  geometry.addEventListener('dispose', () => { geometryDisposed = true; });
  material.addEventListener('dispose', () => { materialDisposed = true; });

  world.dispose();

  assert.equal(world.root.parent, null);
  assert.equal(world.interactables.length, 0);
  assert.equal(geometryDisposed, true);
  assert.equal(materialDisposed, true);
});
