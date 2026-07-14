import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';

import {
  CURATED_FRIENDSIES_CAST,
  DEFAULT_PLAYER_FRIENDSIES_TOKEN_ID,
  PLAYER_FRIENDSIES_FALLBACK_TOKEN_IDS,
  getCuratedFriendsiesEntry,
} from '../src/content/friendsies-cast.js';
import {
  applyFriendsiesHeadPresentation,
  CharacterLoader,
  resolveHeadEmissionPresentation,
  resolveHandheldGlowPresentation,
} from '../src/visuals/CharacterLoader.js';

test('curated cast records story role and canonical source token without policy duplication', () => {
  const traitSource = getCuratedFriendsiesEntry(1);
  const player = getCuratedFriendsiesEntry(6602);
  const steward = getCuratedFriendsiesEntry(8914);

  assert.equal(player.role, 'default-player');
  assert.ok(player.storyUse.includes('player-avatar'));
  assert.equal(traitSource.role, 'trait-echo-source');
  assert.equal(traitSource.bundledCharacter, false);
  assert.equal(steward.role, 'steward-lumen');
  assert.ok(steward.storyUse.includes('nighttime-authority'));

  for (const entry of [traitSource, player, steward]) {
    for (const policyField of [
      'licenseStatus',
      'redistributionStatus',
      'runtimeDistributionScope',
      'rawSourceRedistribution',
      'releaseBlocked',
    ]) {
      assert.equal(Object.hasOwn(entry, policyField), false);
    }
    assert.equal(entry.source.collection, 'fRiENDSiES');
    assert.equal(entry.source.tokenId, entry.token_id);
    assert.equal(entry.source.canonicalToken, true);
    assert.equal(Object.isFrozen(entry), true);

    for (const trait of entry.attributes) {
      assert.equal(trait.sourceTokenId, entry.token_id);
      assert.equal(Object.hasOwn(trait, 'licenseStatus'), false);
      assert.equal(Object.hasOwn(trait, 'rightsStatus'), false);
      assert.match(trait.asset_url, /^\/friendsies\/(0001|6602|8914)\//);
    }
  }
});

test('curated cast contains the bounded default, steward, and Trait Echo source', () => {
  assert.deepEqual(Object.keys(CURATED_FRIENDSIES_CAST).sort(), ['1', '6602', '8914']);

  const traitValues = Object.values(CURATED_FRIENDSIES_CAST)
    .flatMap((entry) => entry.attributes)
    .map((trait) => trait.value);

  assert.equal(traitValues.includes('Book Of Ocean'), false);
  assert.equal(traitValues.includes('Friends Key'), false);
  assert.deepEqual(
    getCuratedFriendsiesEntry(6602).attributes.map((trait) => trait.value),
    ['Ghostin', 'Pop', 'Romeo', 'Staffv', 'Deli', 'High Boots Red', 'Totem'],
  );
  assert.deepEqual(
    getCuratedFriendsiesEntry(1).attributes.map((trait) => trait.value),
    ['Flower White'],
  );
  assert.equal(getCuratedFriendsiesEntry(431), null);
});

test('character loader preserves numeric token lookup for the curated cast', () => {
  const loader = new CharacterLoader();
  const traitSource = getCuratedFriendsiesEntry(1);
  const player = getCuratedFriendsiesEntry(6602);
  const steward = getCuratedFriendsiesEntry(8914);

  assert.equal(loader.getEntryById(1), traitSource);
  assert.equal(loader.getEntryById('6602'), player);
  assert.equal(loader.getEntryById(8914), steward);
  assert.equal(loader.getEntryById('8914'), steward);
  assert.equal(loader.hasBundledCharacter('0001'), false);
  assert.equal(loader.hasBundledCharacter(6602), true);
  assert.equal(loader.hasBundledCharacter(8914), true);
  assert.equal(loader.hasBundledCharacter(431), false);

  const streamedOne = { token_id: 1, attributes: [{ trait_type: 'body' }] };
  const streamedEntry = { token_id: 431, attributes: [] };
  loader.metadata = { 1: streamedOne, 431: streamedEntry };
  assert.equal(loader.getEntryById(1), streamedOne);
  assert.equal(loader.getEntryById(431), streamedEntry);

  const adjacent = { id: '8449', attributes: [] };
  const selected = { id: '8448', attributes: [] };
  loader.metadata = [adjacent, selected];
  assert.equal(loader.getEntryById(8448), selected);
});

test('bundled fRiENDSiES attempts stay bounded before code-native recovery', () => {
  assert.equal(DEFAULT_PLAYER_FRIENDSIES_TOKEN_ID, 6602);
  assert.deepEqual(PLAYER_FRIENDSIES_FALLBACK_TOKEN_IDS, [6602, 8914]);
});

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

  const before = {
    color: material.color.getHex(),
    emissive: material.emissive.getHex(),
    emissiveIntensity: material.emissiveIntensity,
    metalness: material.metalness,
    roughness: material.roughness,
  };

  assert.equal(resolveHeadEmissionPresentation({
    trait_type: 'head',
    value: 'Ye',
  }), null);
  assert.equal(applyFriendsiesHeadPresentation(headScene, {
    trait_type: 'head',
    value: 'Ye',
  }), false);
  assert.deepEqual({
    color: material.color.getHex(),
    emissive: material.emissive.getHex(),
    emissiveIntensity: material.emissiveIntensity,
    metalness: material.metalness,
    roughness: material.roughness,
  }, before);

  geometry.dispose();
  material.dispose();
});

test('head emission is limited to exact known or declarative exceptions', () => {
  const greyCloud = resolveHeadEmissionPresentation({
    trait_type: 'head',
    value: 'Grey Cloud',
  });
  assert.deepEqual(greyCloud, {
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

  const stewardHead = getCuratedFriendsiesEntry(8914).attributes
    .find((trait) => trait.trait_type === 'head');
  assert.equal(stewardHead.value, 'White Elephant');
  assert.deepEqual(resolveHeadEmissionPresentation(stewardHead), {
    color: 0xffffff,
    emissiveIntensity: 0.22,
    softWhite: true,
  });

  const playerHead = getCuratedFriendsiesEntry(6602).attributes
    .find((trait) => trait.trait_type === 'head');
  assert.equal(resolveHeadEmissionPresentation(playerHead), null);
});

test('known head emission exceptions apply the bounded white material treatment', () => {
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
  assert.equal(material.color.getHex(), 0xffffff);
  assert.equal(material.emissive.getHex(), 0xffffff);
  assert.equal(material.emissiveIntensity, 0.22);
  assert.equal(material.metalness, 0.02);
  assert.equal(material.roughness, 0.92);

  geometry.dispose();
  material.dispose();
});

test('handheld glow prefers declarative behavior and retains legacy metadata fallback', () => {
  const torch = getCuratedFriendsiesEntry(8914).attributes
    .find((trait) => trait.trait_type === 'hand');
  const curatedGlow = resolveHandheldGlowPresentation(torch);

  assert.equal(curatedGlow.color, 0xffb35c);
  assert.equal(curatedGlow.emissiveIntensity, 0.48);
  assert.equal(curatedGlow.lightIntensity, 0.34);

  const namedSomethingElse = resolveHandheldGlowPresentation({
    trait_type: 'hand',
    value: 'Guiding Bloom',
    presentation: {
      handheldGlow: {
        color: 0x88ccff,
        lightIntensity: 0.2,
      },
    },
  });
  assert.equal(namedSomethingElse.color, 0x88ccff);
  assert.equal(namedSomethingElse.lightIntensity, 0.2);
  assert.equal(namedSomethingElse.lightDistance, 2.6);

  const legacyLantern = resolveHandheldGlowPresentation({
    trait_type: 'hand',
    value: 'Paper Lantern',
  });
  assert.equal(legacyLantern.color, 0xffb35c);

  assert.equal(resolveHandheldGlowPresentation({
    trait_type: 'hand',
    value: 'Torch',
    presentation: { handheldGlow: false },
  }), null);
  assert.equal(resolveHandheldGlowPresentation({
    trait_type: 'sprout',
    value: 'Torch Crown',
  }), null);
});
