import { DEFAULT_PLAYER_FRIENDSIES_TOKEN_ID } from '../content/friendsies-cast.js';

export const FRIENDSIES_REMOTE_PLAYER_DEPENDENCY_ID = 'friendsies-remote-player-streaming';
export const FRIENDSIES_METADATA_CATALOG_URL = 'https://gist.githubusercontent.com/IntergalacticPizzaLord/a7b0eeac98041a483d715c8320ccf660/raw/ce7d37a94c33c63e2b50d5922e0711e72494c8dd/fRiENDSiES';
export const FRIENDSIES_METADATA_CATALOG_BYTE_LENGTH = 18_489_230;
export const FRIENDSIES_METADATA_CATALOG_SHA256 = '9f1c4e1cf8d848bd2ceaff7cde48c4ecf60a4b1d0afe273e7a5c5b68c2aee3ef';
export const FRIENDSIES_ALLOWED_REMOTE_COMPONENT_ORIGINS = Object.freeze([
  'https://storage.googleapis.com',
]);
export const FRIENDSIES_ALLOWED_REMOTE_COMPONENT_URL_PREFIXES = Object.freeze([
  'https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/',
]);
export const FRIENDSIES_TOKEN_MIN = 1;
export const FRIENDSIES_TOKEN_MAX = 10_000;
export const FRIENDSIES_TOKEN_RANGE = Object.freeze({
  minimum: FRIENDSIES_TOKEN_MIN,
  maximum: FRIENDSIES_TOKEN_MAX,
});

export const FRIENDSIES_REMOTE_PLAYER_POLICY = deepFreeze({
  id: FRIENDSIES_REMOTE_PLAYER_DEPENDENCY_ID,
  metadataCatalog: {
    url: FRIENDSIES_METADATA_CATALOG_URL,
    sha256: FRIENDSIES_METADATA_CATALOG_SHA256,
    bytes: FRIENDSIES_METADATA_CATALOG_BYTE_LENGTH,
  },
  allowedAssetOrigins: [...FRIENDSIES_ALLOWED_REMOTE_COMPONENT_ORIGINS],
  allowedAssetUrlPrefixes: [...FRIENDSIES_ALLOWED_REMOTE_COMPONENT_URL_PREFIXES],
  tokenScope: {
    type: 'inclusive-range',
    ...FRIENDSIES_TOKEN_RANGE,
  },
});

const GENERATOR_HOSTS = new Set(['frienemies.xyz', 'www.frienemies.xyz']);
const ALLOWED_REMOTE_COMPONENT_ORIGINS = new Set(
  FRIENDSIES_ALLOWED_REMOTE_COMPONENT_ORIGINS,
);
const ALLOWED_REMOTE_COMPONENT_URL_PREFIXES = FRIENDSIES_ALLOWED_REMOTE_COMPONENT_URL_PREFIXES;
const QUERY_KEYS = Object.freeze(['friend', 'token']);
const LOCAL_COMPONENT_BASE_URL = 'https://thornvale.invalid';

/**
 * Accept an absolute streamed component URL only when its normalized origin is
 * declared by the external runtime dependency. Curated `/friendsies/` URLs use
 * the separate bundled path below and intentionally do not pass this check.
 */
export function isAllowedFriendsiesRemoteComponentUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    return false;
  }

  try {
    const url = new URL(value);
    return !url.username
      && !url.password
      && ALLOWED_REMOTE_COMPONENT_ORIGINS.has(url.origin)
      && ALLOWED_REMOTE_COMPONENT_URL_PREFIXES.some((prefix) => url.href.startsWith(prefix));
  } catch {
    return false;
  }
}

/**
 * Resolve one component URL at the local/remote trust boundary. Bundled cast
 * entries may use only Thornvale's curated `/friendsies/` deployment paths;
 * streamed entries may use only an explicitly allowed absolute origin.
 */
export function resolveFriendsiesComponentAssetUrl(value, { bundled = false } = {}) {
  if (bundled) return isBundledFriendsiesComponentUrl(value) ? value : null;
  return isAllowedFriendsiesRemoteComponentUrl(value) ? value : null;
}

/**
 * Parse a token ID, a generator /fren/:id path, or a full generator URL.
 * Malformed prefixes, decimals, scientific notation, and out-of-range IDs are
 * rejected instead of being partially accepted by parseInt.
 */
export function parseFriendsiesTokenSelector(value) {
  if (Number.isSafeInteger(value)) return inCollectionRange(value) ? value : null;
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (!normalized) return null;

  const directMatch = normalized.match(/^#?(\d+)$/);
  if (directMatch) return tokenFromDigits(directMatch[1]);

  const pathToken = tokenFromFrenPath(normalized);
  if (pathToken !== null) return pathToken;

  try {
    const url = new URL(normalized);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (!GENERATOR_HOSTS.has(url.hostname.toLowerCase())) return null;
    return tokenFromFrenPath(url.pathname);
  } catch {
    return null;
  }
}

/**
 * Resolve the player selected by a Thornvale URL.
 *
 * `friend` is the canonical query key and `token` is retained as an alias.
 * Query selectors override the route; when no query selector is present,
 * Thornvale mirrors the generator's /fren/:id deep-link contract.
 */
export function resolvePlayerFriendsiesSelection({ search = '', pathname = '/' } = {}) {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search || '').replace(/^\?/, ''));

  let sawQuerySelector = false;
  let firstInvalidQuery = null;

  for (const key of QUERY_KEYS) {
    const values = params.getAll(key);
    if (values.length > 0) sawQuerySelector = true;

    for (const raw of values) {
      const tokenId = parseFriendsiesTokenSelector(raw);
      if (tokenId !== null) return selection(tokenId, `query:${key}`, raw);
      if (firstInvalidQuery === null) firstInvalidQuery = raw;
    }
  }

  if (sawQuerySelector) {
    return selection(
      DEFAULT_PLAYER_FRIENDSIES_TOKEN_ID,
      'default:invalid-query',
      firstInvalidQuery,
    );
  }

  const pathTokenId = tokenFromFrenPath(pathname);
  if (pathTokenId !== null) return selection(pathTokenId, 'path:fren', pathname);

  return selection(DEFAULT_PLAYER_FRIENDSIES_TOKEN_ID, 'default', null);
}

export function resolvePlayerFriendsiesToken(location = {}) {
  return resolvePlayerFriendsiesSelection(location).tokenId;
}

function tokenFromFrenPath(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^\/fren\/(\d+)\/?$/i);
  return match ? tokenFromDigits(match[1]) : null;
}

function tokenFromDigits(value) {
  const tokenId = Number(value);
  return Number.isSafeInteger(tokenId) && inCollectionRange(tokenId)
    ? tokenId
    : null;
}

function inCollectionRange(tokenId) {
  return tokenId >= FRIENDSIES_TOKEN_MIN && tokenId <= FRIENDSIES_TOKEN_MAX;
}

function selection(tokenId, source, raw) {
  return Object.freeze({ tokenId, source, raw });
}

function isBundledFriendsiesComponentUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/friendsies/')) return false;
  try {
    const url = new URL(value, LOCAL_COMPONENT_BASE_URL);
    return url.origin === LOCAL_COMPONENT_BASE_URL
      && url.pathname.startsWith('/friendsies/');
  } catch {
    return false;
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
