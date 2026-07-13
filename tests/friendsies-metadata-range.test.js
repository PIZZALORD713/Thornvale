import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchFriendsiesTokenMetadata } from '../src/visuals/CharacterLoader.js';

test('token metadata lookup ranges into the pinned catalog instead of fetching it whole', async () => {
  const tokenCount = 1_000;
  const catalog = {};
  for (let tokenId = 1; tokenId <= tokenCount; tokenId += 1) {
    catalog[tokenId] = {
      id: String(tokenId),
      attributes: [
        {
          trait_type: 'body',
          value: tokenId === 844 ? 'Lucky { White }' : `Body ${tokenId}`,
          asset_url: `https://assets.example/${tokenId}/body.glb`,
        },
        ...(tokenId <= 500
          ? [{ trait_type: 'padding', value: 'x'.repeat(420) }]
          : []),
      ],
    };
  }

  const bytes = new TextEncoder().encode(JSON.stringify(catalog));
  const requests = [];
  const fetchImpl = async (_url, options = {}) => {
    const range = options.headers?.Range;
    const match = /^bytes=(\d+)-(\d+)$/.exec(range || '');
    assert.ok(match, 'lookup must issue a bounded byte range');
    const start = Number(match[1]);
    const end = Math.min(Number(match[2]), bytes.length - 1);
    requests.push({ start, end });
    return new Response(bytes.slice(start, end + 1), { status: 206 });
  };

  const entry = await fetchFriendsiesTokenMetadata(844, {
    fetchImpl,
    url: 'https://catalog.example/friendsies.json',
    byteLength: bytes.length,
    tokenCount,
    chunkSize: 4_096,
    maxAttempts: 12,
  });

  assert.equal(entry.id, '844');
  assert.equal(entry.attributes[0].value, 'Lucky { White }');
  assert.ok(requests.length > 1, 'skewed fixture should exercise range seeking');
  assert.ok(
    requests.reduce((sum, request) => sum + request.end - request.start + 1, 0)
      < bytes.length,
    'range lookup should transfer less than the complete catalog',
  );
});

test('token metadata lookup rejects malformed and out-of-range selectors before fetch', async () => {
  let fetchCount = 0;
  const fetchImpl = async () => {
    fetchCount += 1;
    throw new Error('unexpected fetch');
  };

  assert.equal(await fetchFriendsiesTokenMetadata('844abc', { fetchImpl }), null);
  assert.equal(await fetchFriendsiesTokenMetadata(10001, { fetchImpl }), null);
  assert.equal(fetchCount, 0);
});
