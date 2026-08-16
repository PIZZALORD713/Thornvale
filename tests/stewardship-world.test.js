import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';

import { GameSession } from '../src/game/GameSession.js';
import { WoodcuttingDirector } from '../src/game/WoodcuttingDirector.js';
import {
  prepareAxeAsset,
  StewardshipWorld,
} from '../src/visuals/StewardshipWorld.js';
import {
  FishingWorld,
  prepareFishingPoleAsset,
} from '../src/visuals/FishingWorld.js';

class FakePhysicsWorld {
  constructor() {
    this.created = [];
    this.removed = [];
  }

  createStaticBox(position, size) {
    const handle = { body: { id: this.created.length + 1 }, position, size };
    this.created.push(handle);
    return handle;
  }

  removeRigidBody(body) {
    this.removed.push(body);
    return true;
  }
}

test('a restored stump projects immediately while a live felling still animates', () => {
  const session = new GameSession({ storage: null });
  const director = new WoodcuttingDirector({ session });
  const matureSnapshot = session.snapshot();
  director.collectAxe();
  director.strikeTree('tree.grove.01');
  director.strikeTree('tree.grove.01');
  director.strikeTree('tree.grove.01');
  const stumpSnapshot = session.snapshot();

  const restoredWorld = new StewardshipWorld({
    axeLoader: async () => new Group(),
  }).init();
  restoredWorld.setState(stumpSnapshot, { animate: false });
  const restoredTree = restoredWorld.treeVisuals.get('tree.grove.01');
  assert.equal(restoredTree.currentStage, 'stump');
  assert.equal(restoredTree.fall, null);
  assert.equal(restoredTree.standing.visible, false);
  assert.equal(restoredTree.stump.visible, true);

  const liveWorld = new StewardshipWorld({
    axeLoader: async () => new Group(),
  }).init();
  liveWorld.setState(matureSnapshot);
  liveWorld.setState(stumpSnapshot);
  const liveTree = liveWorld.treeVisuals.get('tree.grove.01');
  assert.deepEqual(liveTree.fall, { elapsed: 0, duration: 1.15 });
  assert.equal(liveTree.standing.visible, true);
  assert.equal(liveTree.stump.visible, false);

  restoredWorld.dispose();
  liveWorld.dispose();
});

test('the visible final swing commits on contact, then reconciles the stump collider', async () => {
  const session = new GameSession({ storage: null });
  const director = new WoodcuttingDirector({ session });
  const physicsWorld = new FakePhysicsWorld();
  const world = new StewardshipWorld({
    physicsWorld,
    axeLoader: async () => new Group(),
  }).init();
  await Promise.resolve();

  director.collectAxe();
  director.strikeTree('tree.grove.01');
  director.strikeTree('tree.grove.01');
  world.setState(session.snapshot());

  let contacts = 0;
  let completed = 0;
  world.playStrike('tree.grove.01', {
    final: true,
    onContact: () => {
      contacts += 1;
      director.strikeTree('tree.grove.01');
      world.setState(session.snapshot());
    },
    onComplete: () => { completed += 1; },
  });

  world.update(0.1);
  world.update(0.1);
  world.update(0.1);
  assert.equal(contacts, 0);
  assert.equal(session.snapshot().world.trees.byId['tree.grove.01'].stage, 'mature');

  world.update(0.1);
  assert.equal(contacts, 1);
  assert.equal(session.snapshot().world.trees.byId['tree.grove.01'].stage, 'stump');
  assert.equal(world.treeBodies.get('tree.grove.01').kind, 'stump');

  for (let step = 0; step < 6; step += 1) world.update(0.1);
  assert.equal(contacts, 1);
  assert.equal(completed, 1);
  assert.equal(world.actionAxe.visible, false);
  assert.ok(physicsWorld.removed.length >= 1);
  world.dispose();
});

test('the canonical Axe replaces both procedural views without changing gameplay anchors', async () => {
  const template = new Group();
  template.add(new Mesh(new BoxGeometry(0.2, 1, 0.1), new MeshBasicMaterial()));
  const requested = [];
  const world = new StewardshipWorld({
    axeLoader: async (url) => {
      requested.push(url);
      return template;
    },
  }).init();

  assert.equal(await world.axeAssetReady, true);
  assert.deepEqual(requested, ['/friendsies/tools/axe-v1.glb']);
  assert.equal(world.axeAssetStatus, 'canonical');
  assert.equal(world.axePickupFallback.visible, false);
  assert.equal(world.actionAxeFallback.visible, false);
  const pickup = world.axePickup.getObjectByName('friendsies_axe_pickup_canonical');
  const action = world.actionAxe.getObjectByName('friendsies_axe_action_canonical');
  assert.ok(pickup);
  assert.ok(action);
  assert.deepEqual(world.axePickupDisplay.position.toArray(), [-0.72, 0.08, 0]);
  assert.equal(pickup.rotation.y, Math.PI / 2);
  assert.equal(action.rotation.y, Math.PI / 2);
  assert.ok(world.root.getObjectByName('stewardship_axe_station_block'));
  assert.deepEqual(
    world.interactables.map(({ id }) => id),
    [
      'tree.grove.01',
      'tree.grove.02',
      'tree.grove.03',
      'stewardship.axe-pickup',
      'planting.grove.01',
    ],
  );
  world.dispose();
});

test('collecting the Axe clears the tool but leaves its readable station behind', () => {
  const session = new GameSession({ storage: null });
  const director = new WoodcuttingDirector({ session });
  const world = new StewardshipWorld({
    axeLoader: async () => new Group(),
  }).init();

  world.setState(session.snapshot(), { animate: false });
  assert.equal(world.axePickup.visible, true);
  assert.equal(world.axeStation.visible, true);

  director.collectAxe();
  world.setState(session.snapshot());
  assert.equal(world.axePickup.visible, false);
  assert.equal(world.axeStation.visible, true);
  world.dispose();
});

test('Axe normalization bakes an offset source into centered static equipment', () => {
  const source = new Group();
  const mesh = new Mesh(new BoxGeometry(0.2, 1.2, 0.1), new MeshBasicMaterial());
  mesh.position.set(3, 4, 5);
  source.add(mesh);

  const prepared = prepareAxeAsset(source);
  prepared.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(prepared, true);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());

  assert.equal(prepared.name, 'friendsies_axe_frame_zero');
  assert.ok(center.length() < 1e-8, `normalized center drifted to ${center.toArray()}`);
  assert.ok(Math.abs(Math.max(size.x, size.y, size.z) - 1.08) < 1e-6);
  assert.equal(prepared.children[0].isSkinnedMesh, undefined);
  assert.equal(prepared.children[0].isMesh, true);
  mesh.material.dispose();
  mesh.geometry.dispose();
  prepared.children[0].geometry.dispose();
});

test('Axe load failure remains local and preserves both procedural tool views', async () => {
  const warnings = [];
  const world = new StewardshipWorld({
    axeLoader: async () => { throw new Error('forced Axe failure'); },
    onAssetWarning: (...args) => warnings.push(args),
  }).init();

  assert.equal(await world.axeAssetReady, false);
  assert.equal(world.axeAssetStatus, 'fallback');
  assert.equal(world.axePickupFallback.visible, true);
  assert.equal(world.actionAxeFallback.visible, true);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0][0], /procedural fallback/i);
  assert.ok(world.interactables.some(({ id }) => id === 'stewardship.axe-pickup'));
  world.dispose();
});

test('the fishing presentation contributes the real pond interaction anchor', () => {
  const world = new FishingWorld();
  assert.deepEqual(world.interactables.map(({ id }) => id), ['day-one-fishing-spot']);
  assert.deepEqual(world.interactables[0].position.toArray(), [16.4, 0.25, 4]);
  world.dispose();
});

test('fishing-pole normalization bakes an offset source into centered static equipment', () => {
  const source = new Group();
  const mesh = new Mesh(new BoxGeometry(0.1, 2, 0.1), new MeshBasicMaterial());
  mesh.position.set(3, 4, 5);
  source.add(mesh);

  const prepared = prepareFishingPoleAsset(source);
  prepared.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(prepared, true);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());

  assert.ok(center.length() < 1e-8, `normalized center drifted to ${center.toArray()}`);
  assert.ok(Math.abs(size.y - 2.25) < 1e-8, `normalized length was ${size.y}`);
  assert.ok(size.y > size.x * 10);
  assert.ok(size.y > size.z * 10);
  assert.equal(prepared.children[0].isSkinnedMesh, undefined);
  assert.equal(prepared.children[0].isMesh, true);
  mesh.material.dispose();
  mesh.geometry.dispose();
  prepared.children[0].geometry.dispose();
});

test('the canonical fishing pole replaces the procedural rod without moving the pond anchor', async () => {
  const template = new Group();
  template.add(new Mesh(new BoxGeometry(0.1, 1, 0.1), new MeshBasicMaterial()));
  const requested = [];
  const world = new FishingWorld({
    poleLoader: async (url) => {
      requested.push(url);
      return template;
    },
  }).init();

  assert.equal(await world.poleAssetReady, true);
  assert.deepEqual(requested, ['/friendsies/tools/fishing-pole-v1.glb']);
  assert.equal(world.poleAssetStatus, 'canonical');
  assert.equal(world.rodFallback.visible, false);
  assert.equal(world.canonicalPole, template);
  assert.deepEqual(world.root.position.toArray(), [16.4, 0.25, 4]);
  world.dispose();
});

test('fishing-pole load failure remains local and preserves the procedural rod', async () => {
  const warnings = [];
  const world = new FishingWorld({
    poleLoader: async () => { throw new Error('forced fishing-pole failure'); },
    onAssetWarning: (...args) => warnings.push(args),
  }).init();

  assert.equal(await world.poleAssetReady, false);
  assert.equal(world.poleAssetStatus, 'fallback');
  assert.equal(world.rodFallback.visible, true);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0][0], /procedural fallback/i);
  assert.deepEqual(world.interactables.map(({ id }) => id), ['day-one-fishing-spot']);
  world.dispose();
});
