import test from 'node:test';
import assert from 'node:assert/strict';

import { TOWN_LAYOUT } from '../src/config/town.js';
import { addCottagePhysics } from '../src/game/TownBuilder.js';

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
