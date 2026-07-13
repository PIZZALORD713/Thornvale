import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';

import {
  applyFriendsiesHeadPresentation,
  CharacterLoader,
  resolveHeadEmissionPresentation,
} from '../src/visuals/CharacterLoader.js';

test('ordinary heads preserve authored materials unless emission is explicitly opted in', () => {
  const material = new MeshStandardMaterial({
    color: 0x7a2c25,
    emissive: 0x132435,
    emissiveIntensity: 0.7,
    metalness: 0.64,
    roughness: 0.31,
  });
  const geometry = new BoxGeometry(1, 1, 1);
  const headScene = new Group();
  headScene.add(new Mesh(geometry, material));
  const before = materialSnapshot(material);

  const ye = { trait_type: 'head', value: 'Ye' };
  assert.equal(resolveHeadEmissionPresentation(ye), null);
  assert.equal(applyFriendsiesHeadPresentation(headScene, ye), false);
  assert.deepEqual(materialSnapshot(material), before);

  geometry.dispose();
  material.dispose();
});

test('only exact or declarative head emission exceptions receive an override', () => {
  assert.deepEqual(resolveHeadEmissionPresentation({
    trait_type: 'head',
    value: 'Grey Cloud',
  }), {
    color: 0xffffff,
    emissiveIntensity: 0.22,
    softWhite: true,
  });

  for (const value of ['Dark Grey Cloud', 'Ye', 'Deli', 'Unknown Head']) {
    assert.equal(resolveHeadEmissionPresentation({
      trait_type: 'head',
      value,
    }), null, value);
  }
  assert.equal(resolveHeadEmissionPresentation({
    trait_type: 'head',
    value: 'Grey Cloud',
    presentation: { headEmission: false },
  }), null);

  const stewardHead = new CharacterLoader().getEntryById(8914).attributes
    .find((trait) => trait.trait_type === 'head');
  assert.equal(stewardHead.value, 'White Elephant');
  assert.deepEqual(resolveHeadEmissionPresentation(stewardHead), {
    color: 0xffffff,
    emissiveIntensity: 0.22,
    softWhite: true,
  });
});

test('known head emission exceptions retain the reviewed soft-white treatment', () => {
  const material = new MeshStandardMaterial({
    color: 0x6c7584,
    emissive: 0x000000,
    emissiveIntensity: 1,
    metalness: 0.8,
    roughness: 0.25,
  });
  const geometry = new BoxGeometry(1, 1, 1);
  const headScene = new Group();
  headScene.add(new Mesh(geometry, material));

  assert.equal(applyFriendsiesHeadPresentation(headScene, {
    trait_type: 'head',
    value: 'Grey Cloud',
  }), true);
  assert.deepEqual(materialSnapshot(material), {
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.22,
    metalness: 0.02,
    roughness: 0.92,
  });

  geometry.dispose();
  material.dispose();
});

function materialSnapshot(material) {
  return {
    color: material.color.getHex(),
    emissive: material.emissive.getHex(),
    emissiveIntensity: material.emissiveIntensity,
    metalness: material.metalness,
    roughness: material.roughness,
  };
}
