import {
  parseCharacterCardDocument,
  validateCharacterCard,
} from './character-card.js';

export const EDITABLE_CHARACTER_FIELDS = Object.freeze([
  Object.freeze({
    id: 'story_identity',
    heading: 'Story identity',
    description: 'The authored identity this Friend takes in ThornVale.',
  }),
  Object.freeze({
    id: 'open_want',
    heading: 'Open want',
    description: 'What they will admit they want.',
  }),
  Object.freeze({
    id: 'private_fear',
    heading: 'Private fear',
    description: 'The pressure they conceal or avoid naming.',
  }),
  Object.freeze({
    id: 'belief_about_thornvale',
    heading: 'Belief about ThornVale',
    description: 'What they think the town is protecting or controlling.',
  }),
  Object.freeze({
    id: 'conflicting_memory',
    heading: 'Conflicting memory',
    description: 'A memory that disagrees with another account.',
  }),
  Object.freeze({
    id: 'conditional_action',
    heading: 'Conditional action',
    description: 'What they will do only when a relationship or fact changes.',
  }),
  Object.freeze({
    id: 'relationships',
    heading: 'Relationships',
    description: 'Named bonds, tensions, debts, and hidden possibilities.',
  }),
  Object.freeze({
    id: 'consequences',
    heading: 'Consequences',
    description: 'Visible changes their choices can cause.',
  }),
]);

const EDITABLE_FIELD_MAP = new Map(
  EDITABLE_CHARACTER_FIELDS.map((field) => [field.id, field]),
);

function assertExpectedCard(document, expectedCardId) {
  validateCharacterCard(document.frontmatter);
  if (expectedCardId && document.frontmatter.card_id !== expectedCardId) {
    throw new Error(
      `Expected character card ${expectedCardId}; selected ${document.frontmatter.card_id}.`,
    );
  }
}

function locateSection(body, heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(^|\\r?\\n)## ${escapedHeading}\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`,
    'g',
  );
  const matches = [...body.matchAll(pattern)];
  if (matches.length !== 1) {
    throw new Error(`Character card requires exactly one "${heading}" section.`);
  }
  const prefixLength = matches[0][1].length;
  return {
    start: matches[0].index + prefixLength,
    end: matches[0].index + matches[0][0].length,
    value: matches[0][2].trim(),
  };
}

function readDocumentFields(source, expectedCardId) {
  const raw = String(source ?? '');
  const document = parseCharacterCardDocument(raw);
  assertExpectedCard(document, expectedCardId);
  const frontmatter = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  if (!frontmatter) {
    throw new Error('Character card frontmatter boundary is invalid.');
  }
  const bodyStart = frontmatter[0].length;
  const body = raw.slice(bodyStart);
  const fields = {};
  for (const field of EDITABLE_CHARACTER_FIELDS) {
    fields[field.id] = locateSection(body, field.heading).value;
  }
  return {
    raw,
    body,
    bodyStart,
    eol: raw.includes('\r\n') ? '\r\n' : '\n',
    document,
    fields,
  };
}

function normalizeFieldValue(fieldId, value) {
  if (!EDITABLE_FIELD_MAP.has(fieldId)) {
    throw new Error(`Unknown or protected character field: ${fieldId}`);
  }
  const normalized = String(value ?? '').replaceAll('\r\n', '\n').trim();
  if (/^##\s/m.test(normalized)) {
    throw new Error(`Character field ${fieldId} cannot add level-two headings.`);
  }
  if (normalized.includes('\0')) {
    throw new Error(`Character field ${fieldId} cannot contain NUL characters.`);
  }
  if (normalized.length > 12000) {
    throw new Error(`Character field ${fieldId} exceeds 12,000 characters.`);
  }
  return normalized;
}

export function readEditableCharacterFields(source, options = {}) {
  return Object.freeze({
    ...readDocumentFields(source, options.expectedCardId).fields,
  });
}

export function updateEditableCharacterFields(source, updates, options = {}) {
  const entries = Object.entries(updates || {});
  const normalizedUpdates = Object.fromEntries(
    entries.map(([fieldId, value]) => [fieldId, normalizeFieldValue(fieldId, value)]),
  );
  const original = readDocumentFields(source, options.expectedCardId);
  const latest = readDocumentFields(
    options.latestSource ?? source,
    options.expectedCardId ?? original.document.frontmatter.card_id,
  );

  const changedUpdates = Object.entries(normalizedUpdates).filter(
    ([fieldId, value]) => value !== original.fields[fieldId],
  );
  for (const [fieldId, value] of changedUpdates) {
    if (
      latest.fields[fieldId] !== original.fields[fieldId]
      && latest.fields[fieldId] !== value
    ) {
      throw new Error(
        `${EDITABLE_FIELD_MAP.get(fieldId).heading} changed outside this editor. Reopen the file before saving.`,
      );
    }
  }

  const applicableUpdates = changedUpdates.filter(
    ([fieldId, value]) => value !== latest.fields[fieldId],
  );
  let body = latest.body;
  const replacements = applicableUpdates
    .map(([fieldId, value]) => {
      const field = EDITABLE_FIELD_MAP.get(fieldId);
      const section = locateSection(body, field.heading);
      const renderedValue = value.replaceAll('\n', latest.eol);
      return {
        start: section.start,
        end: section.end,
        source: renderedValue
          ? `## ${field.heading}${latest.eol}${latest.eol}${renderedValue}${latest.eol}`
          : `## ${field.heading}${latest.eol}`,
      };
    })
    .sort((left, right) => right.start - left.start);

  for (const replacement of replacements) {
    body = `${body.slice(0, replacement.start)}${replacement.source}${body.slice(replacement.end)}`;
  }

  return `${latest.raw.slice(0, latest.bodyStart)}${body}`;
}
