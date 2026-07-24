export const CHARACTER_CARD_SCHEMA = 'thornvale.character-card/v1';
export const CHARACTER_CARD_MODES = Object.freeze(['card', 'preview', 'play']);

const REQUIRED_STRING_FIELDS = Object.freeze([
  'card_id',
  'kind',
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
]);

const REQUIRED_LIST_FIELDS = Object.freeze([
  'action_packs',
  'source_refs',
  'tags',
]);

const TRAIT_FIELDS = Object.freeze({
  trait_backpiece: 'backpiece',
  trait_body: 'body',
  trait_face: 'face',
  trait_hand: 'hand',
  trait_head: 'head',
  trait_shoe: 'shoe',
  trait_sprout: 'sprout',
});

export class CharacterCardError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CharacterCardError';
    this.code = code;
  }
}

function parseQuotedScalar(value) {
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      throw new CharacterCardError('invalid-frontmatter', `Invalid quoted value: ${value}`);
    }
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'")) {
      throw new CharacterCardError('invalid-frontmatter', `Invalid quoted value: ${value}`);
    }
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return null;
}

function parseScalar(value) {
  const raw = String(value ?? '').trim();
  if (raw === '') return '';
  if (raw === '[]') return [];
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
  const quoted = parseQuotedScalar(raw);
  return quoted === null ? raw : quoted;
}

/**
 * Parse the flat frontmatter contract used by story-archive character cards.
 * Nested objects are intentionally unsupported; Obsidian-friendly scalar and
 * block-list properties keep the identity surface legible.
 */
export function parseCharacterCardDocument(source) {
  const normalized = String(source ?? '').replaceAll('\r\n', '\n');
  if (!normalized.startsWith('---\n')) {
    throw new CharacterCardError('missing-frontmatter', 'Character card must begin with YAML frontmatter.');
  }

  const closeIndex = normalized.indexOf('\n---\n', 4);
  if (closeIndex < 0) {
    throw new CharacterCardError('missing-frontmatter', 'Character card frontmatter is not closed.');
  }

  const frontmatterSource = normalized.slice(4, closeIndex);
  const body = normalized.slice(closeIndex + 5);
  const frontmatter = {};
  let activeList = null;

  frontmatterSource.split('\n').forEach((line, index) => {
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) return;

    const listItem = line.match(/^\s{2}-\s+(.+)$/);
    if (listItem) {
      if (!activeList) {
        throw new CharacterCardError(
          'invalid-frontmatter',
          `List item on frontmatter line ${index + 1} has no property.`,
        );
      }
      frontmatter[activeList].push(parseScalar(listItem[1]));
      return;
    }

    const property = line.match(/^([a-zA-Z][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (!property) {
      throw new CharacterCardError(
        'invalid-frontmatter',
        `Unsupported frontmatter syntax on line ${index + 1}.`,
      );
    }

    const [, key, rawValue] = property;
    if (Object.hasOwn(frontmatter, key)) {
      throw new CharacterCardError('duplicate-property', `Duplicate frontmatter property: ${key}`);
    }
    if (rawValue === '') {
      frontmatter[key] = [];
      activeList = key;
    } else {
      frontmatter[key] = parseScalar(rawValue);
      activeList = null;
    }
  });

  return { frontmatter, body };
}

export function validateCharacterCard(card) {
  if (!card || typeof card !== 'object' || Array.isArray(card)) {
    throw new CharacterCardError('invalid-card', 'Character card metadata must be an object.');
  }
  if (card.schema !== CHARACTER_CARD_SCHEMA) {
    throw new CharacterCardError(
      'invalid-schema',
      `Expected schema ${CHARACTER_CARD_SCHEMA}; received ${String(card.schema || 'none')}.`,
    );
  }
  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof card[field] !== 'string' || card[field].trim() === '') {
      throw new CharacterCardError('missing-property', `Character card requires ${field}.`);
    }
  }
  if (!/^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/i.test(card.card_id)) {
    throw new CharacterCardError('invalid-card-id', `Invalid card_id: ${card.card_id}`);
  }
  if (!Number.isSafeInteger(card.token_id) || card.token_id <= 0) {
    throw new CharacterCardError('invalid-token-id', 'token_id must be a positive safe integer.');
  }
  if (!card.asset_root.startsWith('/')) {
    throw new CharacterCardError('invalid-asset-root', 'asset_root must be root-relative.');
  }
  for (const field of REQUIRED_LIST_FIELDS) {
    if (!Array.isArray(card[field]) || card[field].length === 0) {
      throw new CharacterCardError('missing-property', `Character card requires a non-empty ${field} list.`);
    }
  }
  return card;
}

export function parseCharacterDirective(source) {
  const text = String(source ?? '');
  const matches = [...text.matchAll(/```thornvale-character\s*\n([\s\S]*?)```/g)];
  if (matches.length !== 1) {
    throw new CharacterCardError(
      'invalid-directive',
      `Expected exactly one thornvale-character directive; received ${matches.length}.`,
    );
  }

  const directive = {};
  const allowed = new Set(['id', 'mode', 'action']);
  matches[0][1].split(/\r?\n/).forEach((line, index) => {
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) return;
    const property = line.match(/^([a-z_]+)\s*:\s*(.+)$/);
    if (!property) {
      throw new CharacterCardError(
        'invalid-directive',
        `Unsupported directive syntax on line ${index + 1}.`,
      );
    }
    const [, key, rawValue] = property;
    if (!allowed.has(key)) {
      throw new CharacterCardError('unknown-directive-field', `Unknown directive field: ${key}`);
    }
    if (Object.hasOwn(directive, key)) {
      throw new CharacterCardError('duplicate-directive-field', `Duplicate directive field: ${key}`);
    }
    directive[key] = parseScalar(rawValue);
  });

  if (typeof directive.id !== 'string' || directive.id.trim() === '') {
    throw new CharacterCardError('missing-directive-id', 'Character directive requires id.');
  }
  directive.mode ??= 'card';
  if (!CHARACTER_CARD_MODES.includes(directive.mode)) {
    throw new CharacterCardError('unknown-mode', `Unknown character mode: ${directive.mode}`);
  }
  if (directive.action !== undefined && (
    typeof directive.action !== 'string' || directive.action.trim() === ''
  )) {
    throw new CharacterCardError('invalid-action', 'Character action must be a semantic string ID.');
  }
  return directive;
}

export function resolveCharacterCard(cards, invocation) {
  const candidates = (Array.isArray(cards) ? cards : [])
    .map((candidate) => candidate?.frontmatter || candidate)
    .map(validateCharacterCard)
    .filter((card) => card.card_id === invocation?.id);

  if (candidates.length === 0) {
    throw new CharacterCardError('unknown-card', `Unknown character card: ${String(invocation?.id)}`);
  }
  if (candidates.length > 1) {
    throw new CharacterCardError('duplicate-card-id', `Duplicate character card: ${invocation.id}`);
  }

  const mode = invocation?.mode ?? 'card';
  if (!CHARACTER_CARD_MODES.includes(mode)) {
    throw new CharacterCardError('unknown-mode', `Unknown character mode: ${mode}`);
  }
  return { card: candidates[0], invocation: { ...invocation, mode } };
}

export function validateCardAgainstCuratedEntry(card, entry) {
  validateCharacterCard(card);
  if (!entry || typeof entry !== 'object') {
    throw new CharacterCardError('missing-cast-entry', `No curated cast entry exists for ${card.card_id}.`);
  }
  const entryTokenId = Number(entry.token_id ?? entry.id);
  if (entryTokenId !== card.token_id) {
    throw new CharacterCardError(
      'token-mismatch',
      `Card token ${card.token_id} does not match curated entry ${String(entry.token_id ?? entry.id)}.`,
    );
  }
  if (entry.role !== card.story_role) {
    throw new CharacterCardError(
      'role-mismatch',
      `Card role ${card.story_role} does not match curated role ${String(entry.role)}.`,
    );
  }

  const attributes = new Map(
    (Array.isArray(entry.attributes) ? entry.attributes : [])
      .map((trait) => [trait?.trait_type, trait]),
  );
  const assets = [];
  for (const [field, traitType] of Object.entries(TRAIT_FIELDS)) {
    const trait = attributes.get(traitType);
    if (!trait || trait.value !== card[field]) {
      throw new CharacterCardError(
        'trait-mismatch',
        `${field} does not match the curated ${traitType} trait.`,
      );
    }
    if (
      typeof trait.asset_url !== 'string'
      || !trait.asset_url.startsWith(`${card.asset_root}/`)
    ) {
      throw new CharacterCardError(
        'asset-root-mismatch',
        `${traitType} does not resolve beneath ${card.asset_root}.`,
      );
    }
    assets.push({ traitType, value: trait.value, url: trait.asset_url });
  }
  return assets;
}

export async function loadCharacterCards(paths, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new CharacterCardError('fetch-unavailable', 'Character card loading requires fetch.');
  }
  return Promise.all((Array.isArray(paths) ? paths : []).map(async (path) => {
    const response = await fetchImpl(path, { cache: 'no-cache' });
    if (!response?.ok) {
      throw new CharacterCardError(
        'card-fetch-failed',
        `Character card ${path} returned HTTP ${String(response?.status || 'unknown')}.`,
      );
    }
    const document = parseCharacterCardDocument(await response.text());
    validateCharacterCard(document.frontmatter);
    return { ...document, path };
  }));
}
