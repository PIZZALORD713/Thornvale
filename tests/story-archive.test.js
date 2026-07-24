import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { getCuratedFriendsiesEntry } from '../src/content/friendsies-cast.js';
import {
  CharacterCardError,
  parseCharacterCardDocument,
  parseCharacterDirective,
  resolveCharacterCard,
  validateCardAgainstCuratedEntry,
  validateCharacterCard,
} from '../story-archive/runtime/character-card.js';
import {
  SAFE_PREVIEW_ACTION_IDS,
  filterSafePreviewClips,
  validateInvocationAction,
} from '../story-archive/runtime/preview-actions.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CARD_PATH = resolve(ROOT, 'story-archive/Characters/Friend 6602.md');
const INVOCATION_PATH = resolve(ROOT, 'story-archive/Invocations/Preview Friend 6602.md');

async function loadCard() {
  return parseCharacterCardDocument(await readFile(CARD_PATH, 'utf8'));
}

test('Friend 6602 card keeps the minimum identity contract and exact curated traits', async () => {
  const { frontmatter: card, body } = await loadCard();
  assert.equal(validateCharacterCard(card), card);
  assert.equal(card.schema, 'thornvale.character-card/v1');
  assert.equal(card.card_id, 'friend:6602');
  assert.equal(card.token_id, 6602);
  assert.equal(card.story_role, 'default-player');
  assert.equal(card.story_identity, 'unassigned');
  assert.equal(card.asset_root, '/friendsies/6602');
  assert.equal(card.rig, 'friendsies-humanoid-v1');
  assert.deepEqual(card.action_packs, ['story-actions-v1']);
  assert.deepEqual(
    [
      card.trait_backpiece,
      card.trait_body,
      card.trait_face,
      card.trait_hand,
      card.trait_head,
      card.trait_shoe,
      card.trait_sprout,
    ],
    ['Ghostin', 'Pop', 'Romeo', 'Staffv', 'Deli', 'High Boots Red', 'Totem'],
  );
  assert.match(
    body,
    /does not assign this Friend a personal name, pronouns, personality,\s*>\s*memory, relationship, or dialogue/,
  );
  assert.doesNotMatch(body, /\blumen\.(acknowledging|happy|thoughtful|relieved)/i);
});

test('card reconciliation derives all seven assets from the curated cast entry', async () => {
  const { frontmatter: card } = await loadCard();
  const assets = validateCardAgainstCuratedEntry(card, getCuratedFriendsiesEntry(6602));
  assert.equal(assets.length, 7);
  assert.deepEqual(
    assets.map((asset) => asset.traitType).sort(),
    ['backpiece', 'body', 'face', 'hand', 'head', 'shoe', 'sprout'],
  );
  for (const asset of assets) {
    assert.match(asset.url, /^\/friendsies\/6602\//);
    await access(resolve(ROOT, 'public', asset.url.slice(1)));
  }
});

test('machine invocation resolves by card_id and rejects unknown cards or modes', async () => {
  const card = await loadCard();
  const directive = parseCharacterDirective(await readFile(INVOCATION_PATH, 'utf8'));
  assert.deepEqual(directive, { id: 'friend:6602', mode: 'play' });
  assert.equal(resolveCharacterCard([card], directive).card.card_id, 'friend:6602');

  assert.throws(
    () => resolveCharacterCard([card], { id: 'friend:8914', mode: 'play' }),
    (error) => error instanceof CharacterCardError && error.code === 'unknown-card',
  );
  assert.throws(
    () => resolveCharacterCard([card], { id: 'friend:6602', mode: 'dossier' }),
    (error) => error instanceof CharacterCardError && error.code === 'unknown-mode',
  );
});

test('safe preview actions exclude Steward Lumen gestures and reject unknown actions', () => {
  assert.deepEqual(SAFE_PREVIEW_ACTION_IDS, [
    'idle',
    'walk',
    'jump',
    'joy',
    'dance',
    'day-one.plant-seed',
    'day-one.water-seed',
  ]);
  assert.equal(SAFE_PREVIEW_ACTION_IDS.some((id) => id.startsWith('lumen.')), false);
  assert.throws(
    () => validateInvocationAction({ id: 'friend:6602', mode: 'play', action: 'lumen.acknowledging' }),
    /Unknown or unavailable Friend 6602 action/,
  );

  const clips = [
    { name: 'walk-low-arms' },
    { name: 'story-actions-v1-day-one-plant-seed' },
    { name: 'story-actions-v1-lumen-acknowledging' },
  ];
  assert.deepEqual(
    filterSafePreviewClips(clips).map((clip) => clip.name),
    ['walk-low-arms', 'story-actions-v1-day-one-plant-seed'],
  );
});

test('vault includes reusable template, schema, preview, and honest HTTP boundary', async () => {
  const paths = [
    'story-archive/.obsidian/app.json',
    'story-archive/Story Archive.md',
    'story-archive/Schemas/Character Card v1.md',
    'story-archive/Templates/Character Card.md',
    'story-archive/Preview/index.html',
    'story-archive/Preview/main.js',
    'story-archive/Preview/styles.css',
  ];
  await Promise.all(paths.map((path) => access(resolve(ROOT, path))));

  const home = await readFile(resolve(ROOT, 'story-archive/Story Archive.md'), 'utf8');
  const card = await readFile(CARD_PATH, 'utf8');
  const preview = await readFile(resolve(ROOT, 'story-archive/Preview/main.js'), 'utf8');
  const viteConfig = await readFile(resolve(ROOT, 'vite.story-archive.config.js'), 'utf8');
  assert.match(home, /npm run story-archive:dev/);
  assert.match(home, /Raw `file:\/\/` viewing is unsupported/);
  assert.match(card, /mode=play/);
  assert.match(
    preview,
    /new URL\('\.\.\/Characters\/Friend 6602\.md', import\.meta\.url\)\.href/,
  );
  assert.match(preview, /loadCharacter\(card\.token_id, \{ instanceId: 'preview' \}\)/);
  assert.match(preview, /writesAuthoritativeState: false/);
  assert.doesNotMatch(preview, /loadCharacter\((8914|['"]friend:8914)/);
  assert.match(viteConfig, /resolve\('story-archive\/Preview\/index\.html'\)/);
  assert.match(viteConfig, /outDir: 'dist-story-archive'/);
});
