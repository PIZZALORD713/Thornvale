import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  applyCharacterTraitInspection,
  createTraitInspectionDetail,
} from '../story-archive/runtime/trait-inspection.js';
import {
  readEditableCharacterFields,
  updateEditableCharacterFields,
} from '../story-archive/runtime/character-card-editor.js';
import { parseCharacterCardDocument } from '../story-archive/runtime/character-card.js';
import {
  resizePreviewRenderer,
  resolvePreviewPixelRatio,
} from '../story-archive/runtime/preview-rendering.js';
import { tagFriendsiesTraitRenderables } from '../src/visuals/CharacterLoader.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CARD_PATH = resolve(ROOT, 'story-archive/Characters/Friend 6602.md');

function makeInspectableCharacter() {
  const nodes = [
    { isMesh: true, visible: true, userData: { friendsiesTrait: { traitType: 'body' } } },
    { isSkinnedMesh: true, visible: true, userData: { friendsiesTrait: { traitType: 'head' } } },
    { isMesh: true, visible: true, userData: { friendsiesTrait: { traitType: 'face' } } },
    { isSkinnedMesh: true, visible: true, userData: { friendsiesTrait: { traitType: 'hand' } } },
    { isMesh: true, visible: true, userData: {} },
  ];
  return {
    nodes,
    traverse(callback) {
      nodes.forEach(callback);
    },
  };
}

test('CharacterLoader trait tags survive on every renderable for isolated inspection', () => {
  const nodes = [
    { isMesh: true, userData: {} },
    { isSkinnedMesh: true, userData: {} },
    { userData: {} },
  ];
  const root = {
    userData: {},
    traverse(callback) {
      nodes.forEach(callback);
    },
  };

  assert.equal(tagFriendsiesTraitRenderables(root, {
    trait_type: 'sprout',
    value: 'Totem',
    asset_url: '/friendsies/6602/sprout-totem.glb',
  }), 2);
  assert.deepEqual(root.userData.friendsiesTrait, {
    traitType: 'sprout',
    value: 'Totem',
    assetUrl: '/friendsies/6602/sprout-totem.glb',
  });
  assert.equal(nodes[0].userData.friendsiesTrait.traitType, 'sprout');
  assert.equal(nodes[1].userData.friendsiesTrait.value, 'Totem');
  assert.equal(nodes[2].userData.friendsiesTrait, undefined);
});

test('trait inspection isolates one assembled trait and gives face its head substrate', () => {
  const character = makeInspectableCharacter();

  const hand = applyCharacterTraitInspection(character, 'hand');
  assert.deepEqual(hand.visibleTraitTypes, ['hand']);
  assert.equal(hand.visibleRenderableCount, 1);
  assert.deepEqual(
    character.nodes.map((node) => node.visible),
    [false, false, false, true, false],
  );

  const face = applyCharacterTraitInspection(character, 'face');
  assert.deepEqual(face.visibleTraitTypes, ['head', 'face']);
  assert.equal(face.visibleRenderableCount, 2);
  assert.deepEqual(
    character.nodes.map((node) => node.visible),
    [false, true, true, false, false],
  );

  const full = applyCharacterTraitInspection(character, null);
  assert.equal(full.selectedTraitType, null);
  assert.equal(character.nodes.every((node) => node.visible), true);
});

test('trait details retain canonical asset URLs and explain the preview binding', () => {
  const detail = createTraitInspectionDetail({
    traitType: 'face',
    value: 'Romeo',
    url: '/friendsies/6602/face-romeo.png',
  }, {
    provenancePath: '/friendsies/6602/PROVENANCE.md',
  });

  assert.deepEqual(detail, {
    traitType: 'face',
    label: 'Face',
    value: 'Romeo',
    assetUrl: '/friendsies/6602/face-romeo.png',
    format: 'PNG texture',
    binding: 'Face overlay shown on its head substrate',
    provenancePath: '/friendsies/6602/PROVENANCE.md',
  });
  assert.throws(
    () => createTraitInspectionDetail({ traitType: 'aura', value: 'Nope', url: '/nope.glb' }),
    /Unknown character trait type/,
  );
});

test('Obsidian editor reads all approved authoring slots without exposing identity traits', async () => {
  const source = await readFile(CARD_PATH, 'utf8');
  const fields = readEditableCharacterFields(source, { expectedCardId: 'friend:6602' });

  assert.equal(fields.story_identity, 'Unassigned.');
  assert.equal(fields.open_want, 'Unassigned.');
  assert.equal(fields.private_fear, 'Unassigned.');
  assert.equal(fields.belief_about_thornvale, 'Unassigned.');
  assert.equal(fields.conflicting_memory, 'Unassigned.');
  assert.equal(fields.conditional_action, 'Unassigned.');
  assert.equal(fields.relationships, 'Unassigned.');
  assert.equal(fields.consequences, 'Unassigned.');
  assert.equal(Object.hasOwn(fields, 'trait_body'), false);
});

test('Obsidian editor updates approved body sections while preserving canon frontmatter', async () => {
  const source = await readFile(CARD_PATH, 'utf8');
  const original = parseCharacterCardDocument(source);
  const updatedSource = updateEditableCharacterFields(source, {
    story_identity: 'The second witness',
    open_want: 'To learn why the Bell remembers them.',
    relationships: '- Steward Lumen: politely guarded\n- The Ledger: distrustful',
  }, {
    expectedCardId: 'friend:6602',
  });
  const updated = parseCharacterCardDocument(updatedSource);

  assert.equal(updated.frontmatter.story_identity, 'unassigned');
  assert.match(updated.body, /## Story identity\n\nThe second witness\n/);
  assert.match(updated.body, /## Open want\n\nTo learn why the Bell remembers them\.\n/);
  assert.match(
    updated.body,
    /## Relationships\n\n- Steward Lumen: politely guarded\n- The Ledger: distrustful\n/,
  );
  assert.equal(
    readEditableCharacterFields(updatedSource).relationships,
    '- Steward Lumen: politely guarded\n- The Ledger: distrustful',
  );

  for (const key of [
    'schema',
    'card_id',
    'kind',
    'token_id',
    'label',
    'canon_status',
    'story_role',
    'story_identity',
    'asset_root',
    'rig',
    'trait_backpiece',
    'trait_body',
    'trait_face',
    'trait_hand',
    'trait_head',
    'trait_shoe',
    'trait_sprout',
  ]) {
    assert.deepEqual(updated.frontmatter[key], original.frontmatter[key], key);
  }
  assert.match(updated.body, /## Safe action surface/);
  assert.match(updated.body, /## Sources/);
});

test('Obsidian editor preserves unrelated external changes and rejects same-field conflicts', async () => {
  const source = await readFile(CARD_PATH, 'utf8');
  const latestSource = source.replace(
    '## Sources\n',
    '## Writer note\n\nA concurrent note outside the editable slots.\n\n## Sources\n',
  );
  const merged = updateEditableCharacterFields(source, {
    open_want: 'To hear the Bell answer honestly.',
  }, {
    expectedCardId: 'friend:6602',
    latestSource,
  });

  assert.match(merged, /## Writer note\n\nA concurrent note outside the editable slots\./);
  assert.match(merged, /## Open want\n\nTo hear the Bell answer honestly\./);

  const conflictingSource = updateEditableCharacterFields(source, {
    open_want: 'An external author changed this field.',
  });
  assert.throws(
    () => updateEditableCharacterFields(source, {
      open_want: 'The browser draft changed it differently.',
    }, {
      latestSource: conflictingSource,
    }),
    /changed outside this editor/,
  );

  const sameDesiredSource = updateEditableCharacterFields(source, {
    open_want: 'An external author changed this field.',
  }, {
    latestSource: conflictingSource,
  });
  assert.equal(sameDesiredSource, conflictingSource);

  const unchangedLocal = updateEditableCharacterFields(source, {
    story_identity: 'A careful witness.',
    open_want: 'Unassigned.',
  }, {
    latestSource: conflictingSource,
  });
  assert.equal(
    readEditableCharacterFields(unchangedLocal).open_want,
    'An external author changed this field.',
  );
});

test('Obsidian editor preserves CRLF and supports deliberately empty authoring slots', async () => {
  const source = (await readFile(CARD_PATH, 'utf8')).replaceAll('\n', '\r\n');
  const frontmatterEnd = source.indexOf('\r\n---\r\n', 5) + '\r\n---\r\n'.length;
  const updated = updateEditableCharacterFields(source, {
    story_identity: '',
    relationships: '- Lumen: guarded\r\n- The Bell: curious',
  });

  assert.equal(updated.slice(0, frontmatterEnd), source.slice(0, frontmatterEnd));
  assert.equal(/(?<!\r)\n/.test(updated), false);
  assert.equal(readEditableCharacterFields(updated).story_identity, '');
  assert.equal(
    readEditableCharacterFields(updated).relationships,
    '- Lumen: guarded\r\n- The Bell: curious',
  );
});

test('Obsidian editor rejects wrong cards, unknown fields, and heading injection', async () => {
  const source = await readFile(CARD_PATH, 'utf8');

  assert.throws(
    () => readEditableCharacterFields(source, { expectedCardId: 'friend:8914' }),
    /Expected character card friend:8914/,
  );
  assert.throws(
    () => updateEditableCharacterFields(source, { trait_body: 'Changed' }),
    /Unknown or protected character field/,
  );
  assert.throws(
    () => updateEditableCharacterFields(source, {
      open_want: 'A harmless line.\n## Sources\n- invented',
    }),
    /level-two headings/,
  );
  assert.throws(
    () => updateEditableCharacterFields(source, {
      open_want: 'A hidden\0character',
    }),
    /NUL characters/,
  );
});

test('preview resize refreshes the capped device pixel ratio before sizing the buffer', () => {
  const calls = [];
  const renderer = {
    setPixelRatio(value) {
      calls.push(['pixelRatio', value]);
    },
    setSize(width, height, updateStyle) {
      calls.push(['size', width, height, updateStyle]);
    },
  };
  const camera = {
    aspect: 0,
    updateProjectionMatrix() {
      calls.push(['projection', this.aspect]);
    },
  };

  assert.equal(resolvePreviewPixelRatio(0), 1);
  assert.equal(resolvePreviewPixelRatio(1.5), 1.5);
  assert.equal(resolvePreviewPixelRatio(3), 2);
  const first = resizePreviewRenderer({
    renderer,
    camera,
    width: 784,
    height: 418,
    devicePixelRatio: 1,
  });
  const second = resizePreviewRenderer({
    renderer,
    camera,
    width: 784,
    height: 418,
    devicePixelRatio: 2,
  });

  assert.deepEqual(first, { width: 784, height: 418, pixelRatio: 1 });
  assert.deepEqual(second, { width: 784, height: 418, pixelRatio: 2 });
  assert.equal(camera.aspect, 784 / 418);
  assert.deepEqual(calls, [
    ['projection', 784 / 418],
    ['pixelRatio', 1],
    ['size', 784, 418, false],
    ['projection', 784 / 418],
    ['pixelRatio', 2],
    ['size', 784, 418, false],
  ]);
});
