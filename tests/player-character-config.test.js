import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FRIENDSIES_ALLOWED_REMOTE_COMPONENT_ORIGINS,
  FRIENDSIES_METADATA_CATALOG_BYTE_LENGTH,
  FRIENDSIES_METADATA_CATALOG_SHA256,
  FRIENDSIES_METADATA_CATALOG_URL,
  FRIENDSIES_REMOTE_PLAYER_DEPENDENCY_ID,
  FRIENDSIES_REMOTE_PLAYER_POLICY,
  FRIENDSIES_TOKEN_MAX,
  FRIENDSIES_TOKEN_MIN,
  FRIENDSIES_TOKEN_RANGE,
  isAllowedFriendsiesRemoteComponentUrl,
  parseFriendsiesTokenSelector,
  resolveFriendsiesComponentAssetUrl,
  resolvePlayerFriendsiesSelection,
  resolvePlayerFriendsiesToken,
} from '../src/config/player-character.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('remote player runtime policy matches the manifest dependency exactly', async () => {
  const manifest = JSON.parse(await readFile(
    resolve(ROOT, 'assets-src/asset-manifest.json'),
    'utf8',
  ));
  const dependency = manifest.externalRuntimeDependencies.find(
    ({ id }) => id === FRIENDSIES_REMOTE_PLAYER_DEPENDENCY_ID,
  );

  assert.ok(dependency);
  assert.deepEqual(FRIENDSIES_REMOTE_PLAYER_POLICY, {
    id: dependency.id,
    metadataCatalog: dependency.metadataCatalog,
    allowedAssetOrigins: dependency.allowedAssetOrigins,
    tokenScope: dependency.tokenScope,
  });
  assert.equal(FRIENDSIES_METADATA_CATALOG_URL, dependency.metadataCatalog.url);
  assert.equal(FRIENDSIES_METADATA_CATALOG_BYTE_LENGTH, dependency.metadataCatalog.bytes);
  assert.equal(FRIENDSIES_METADATA_CATALOG_SHA256, dependency.metadataCatalog.sha256);
  assert.deepEqual(FRIENDSIES_ALLOWED_REMOTE_COMPONENT_ORIGINS, dependency.allowedAssetOrigins);
  assert.deepEqual(FRIENDSIES_TOKEN_RANGE, {
    minimum: dependency.tokenScope.minimum,
    maximum: dependency.tokenScope.maximum,
  });
  assert.equal(Object.isFrozen(FRIENDSIES_REMOTE_PLAYER_POLICY), true);
  assert.equal(Object.isFrozen(FRIENDSIES_REMOTE_PLAYER_POLICY.metadataCatalog), true);
});

test('component URL policy separates curated local assets from allowed remote streaming', () => {
  const validRemote = 'https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/body.glb';
  assert.equal(isAllowedFriendsiesRemoteComponentUrl(validRemote), true);
  assert.equal(resolveFriendsiesComponentAssetUrl(validRemote), validRemote);
  assert.equal(resolveFriendsiesComponentAssetUrl('/friendsies/6602/body.glb'), null);
  assert.equal(
    resolveFriendsiesComponentAssetUrl('/friendsies/6602/body.glb', { bundled: true }),
    '/friendsies/6602/body.glb',
  );

  for (const invalid of [
    'http://storage.googleapis.com/friendsies/body.glb',
    'https://storage.googleapis.com.evil.example/friendsies/body.glb',
    'https://storage.googleapis.com@evil.example/friendsies/body.glb',
    'https://evil.example/body.glb?next=https://storage.googleapis.com',
    '//storage.googleapis.com/friendsies/body.glb',
    'data:model/gltf-binary;base64,AAAA',
    'javascript:alert(1)',
  ]) {
    assert.equal(isAllowedFriendsiesRemoteComponentUrl(invalid), false, invalid);
    assert.equal(resolveFriendsiesComponentAssetUrl(invalid), null, invalid);
  }
});

test('player token selector accepts canonical query, alias, and generator links', () => {
  assert.deepEqual(
    resolvePlayerFriendsiesSelection({ search: '?friend=8448' }),
    { tokenId: 8448, source: 'query:friend', raw: '8448' },
  );
  assert.deepEqual(
    resolvePlayerFriendsiesSelection({ search: '?token=8448' }),
    { tokenId: 8448, source: 'query:token', raw: '8448' },
  );
  assert.deepEqual(
    resolvePlayerFriendsiesSelection({
      search: '?assets=baseline&traits=off&story=reset&friend=8448',
    }),
    { tokenId: 8448, source: 'query:friend', raw: '8448' },
  );
  assert.deepEqual(
    resolvePlayerFriendsiesSelection({ pathname: '/fren/8448' }),
    { tokenId: 8448, source: 'path:fren', raw: '/fren/8448' },
  );

  const generatorUrl = 'https://www.frienemies.xyz/fren/8448';
  assert.deepEqual(
    resolvePlayerFriendsiesSelection({
      search: `?friend=${encodeURIComponent(generatorUrl)}`,
    }),
    { tokenId: 8448, source: 'query:friend', raw: generatorUrl },
  );
  assert.equal(parseFriendsiesTokenSelector('https://frienemies.xyz/fren/8448/'), 8448);
  assert.equal(parseFriendsiesTokenSelector('#8448'), 8448);
});

test('player token selector is strict and stays inside the collection range', () => {
  assert.equal(FRIENDSIES_TOKEN_MIN, 1);
  assert.equal(FRIENDSIES_TOKEN_MAX, 10_000);

  for (const invalid of [
    undefined,
    null,
    '',
    '0',
    '-1',
    '8448abc',
    '8448.9',
    '1e4',
    '10001',
    '/fren/8448/more',
    'https://example.com/fren/8448',
  ]) {
    assert.equal(parseFriendsiesTokenSelector(invalid), null, String(invalid));
  }

  assert.deepEqual(
    resolvePlayerFriendsiesSelection({ search: '?friend=8448abc' }),
    { tokenId: 6602, source: 'default:invalid-query', raw: '8448abc' },
  );
  assert.equal(resolvePlayerFriendsiesToken({ search: '?friend=10001' }), 6602);
  assert.equal(resolvePlayerFriendsiesToken(), 6602);
});

test('canonical friend query wins while a valid token alias can recover an invalid friend value', () => {
  assert.equal(resolvePlayerFriendsiesToken({
    search: '?friend=8448&token=713',
  }), 8448);
  assert.deepEqual(
    resolvePlayerFriendsiesSelection({ search: '?friend=nope&token=713' }),
    { tokenId: 713, source: 'query:token', raw: '713' },
  );
  assert.equal(resolvePlayerFriendsiesToken({
    search: '?friend=nope',
    pathname: '/fren/8448',
  }), 6602);
});
