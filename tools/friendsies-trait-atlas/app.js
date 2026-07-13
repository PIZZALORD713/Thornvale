const elements = {
  form: document.querySelector('#filter-form'),
  query: document.querySelector('#trait-search'),
  traitType: document.querySelector('#trait-type'),
  environmentFit: document.querySelector('#environment-fit'),
  environmentFitGroup: document.querySelector('#fit-filter-group'),
  curationStatus: document.querySelector('#curation-status'),
  curationStatusGroup: document.querySelector('#status-filter-group'),
  mountType: document.querySelector('#mount-type'),
  mountTypeGroup: document.querySelector('#mount-filter-group'),
  phaseReveal: document.querySelector('#phase-reveal'),
  phaseRevealGroup: document.querySelector('#phase-filter-group'),
  affordanceRisk: document.querySelector('#affordance-risk'),
  affordanceRiskGroup: document.querySelector('#risk-filter-group'),
  sort: document.querySelector('#trait-sort'),
  remotePreviews: document.querySelector('#remote-previews'),
  clearFilters: document.querySelector('#clear-filters'),
  heroSummary: document.querySelector('#hero-summary'),
  dataHealth: document.querySelector('#data-health'),
  state: document.querySelector('#catalog-state'),
  grid: document.querySelector('#trait-grid'),
  loadMore: document.querySelector('#load-more'),
  resultCount: document.querySelector('#result-count'),
  detailEmpty: document.querySelector('#detail-empty'),
  detailContent: document.querySelector('#detail-content'),
};

const state = {
  traits: [],
  filtered: [],
  selectedId: null,
  visibleLimit: 96,
  curationLookup: createLookup(),
  probeLookup: createLookup(),
  sourceStatus: {
    index: 'loading',
    curation: 'loading',
    probes: 'loading',
  },
};

const numberFormatter = new Intl.NumberFormat('en-US');
const pageSize = 96;
let previewObserver = null;

bindControls();
void loadAtlas();

function bindControls() {
  elements.form.addEventListener('input', resetAndApplyFilters);
  elements.form.addEventListener('change', resetAndApplyFilters);
  elements.clearFilters.addEventListener('click', clearFilters);
  elements.loadMore.addEventListener('click', () => {
    state.visibleLimit += pageSize;
    renderResults();
  });
}

function resetAndApplyFilters() {
  state.visibleLimit = pageSize;
  applyFilters();
}

async function loadAtlas() {
  showLoading();
  state.sourceStatus = { index: 'loading', curation: 'loading', probes: 'loading' };
  renderDataHealth();

  try {
    const [indexPayload, curationResult, probeResult] = await Promise.all([
      fetchRequiredJson('/trait-index.json'),
      fetchOptionalJson('/trait-curation.json'),
      fetchOptionalJson('/trait-probes.json'),
    ]);

    if (!Array.isArray(indexPayload?.traits)) {
      throw new TypeError('trait-index.json must contain a traits array.');
    }

    state.sourceStatus.index = 'loaded';
    state.sourceStatus.curation = curationResult.status;
    state.sourceStatus.probes = probeResult.status;
    state.curationLookup = buildLookup(curationResult.data, 'curation');
    state.probeLookup = buildLookup(probeResult.data, 'probe');
    state.traits = indexPayload.traits
      .map(normalizeTrait)
      .filter((trait) => trait.value || trait.traitType)
      .map(enrichTrait);

    populateFilters();
    restoreSelectionFromHash();
    applyFilters();
    renderHeroSummary();
    renderDataHealth();
  } catch (error) {
    state.sourceStatus.index = 'error';
    renderDataHealth();
    showError(error);
  }
}

async function fetchRequiredJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? 'The local trait index is missing. Generate assets-src/friendsies/trait-index.json, then refresh.'
        : `Could not read ${path} (HTTP ${response.status}).`,
    );
  }
  return response.json();
}

async function fetchOptionalJson(path) {
  try {
    const response = await fetch(path, { cache: 'no-store' });
    if ([204, 404].includes(response.status)) return { status: 'missing', data: null };
    if (!response.ok) return { status: 'error', data: null };
    return { status: 'loaded', data: await response.json() };
  } catch {
    return { status: 'error', data: null };
  }
}

function normalizeTrait(rawTrait, index) {
  const traitType = cleanText(rawTrait?.traitType || rawTrait?.trait_type || 'Unknown');
  const value = cleanText(rawTrait?.value || 'Unnamed trait');
  const variants = Array.isArray(rawTrait?.variants)
    ? rawTrait.variants.map(normalizeVariant)
    : [];
  const variantTokens = variants.flatMap((variant) => variant.tokenIds);
  const tokenIds = uniqueTokens(
    Array.isArray(rawTrait?.tokenIds) && rawTrait.tokenIds.length > 0
      ? rawTrait.tokenIds
      : variantTokens,
  );
  const variantUses = variants.reduce((total, variant) => total + variant.useCount, 0);
  const useCount = positiveNumber(rawTrait?.useCount, variantUses);
  const id = cleanText(rawTrait?.id) || `${slug(traitType)}--${slug(value)}--${index}`;

  return {
    ...rawTrait,
    id,
    traitType,
    value,
    useCount,
    tokenIds,
    variants,
  };
}

function normalizeVariant(rawVariant, index) {
  return {
    ...rawVariant,
    id: cleanText(rawVariant?.id) || `variant-${index + 1}`,
    assetUrl: cleanText(rawVariant?.assetUrl || rawVariant?.asset_url),
    previewUrl: cleanText(rawVariant?.previewUrl || rawVariant?.preview_url),
    useCount: positiveNumber(rawVariant?.useCount, 0),
    tokenIds: uniqueTokens(rawVariant?.tokenIds || []),
  };
}

function enrichTrait(trait) {
  const curation = lookupRecord(state.curationLookup, trait) || {};
  const environment = objectValue(curation.environment);
  const inlineEnvironment = objectValue(trait.environment);
  const environmentFit = readableValue(firstValue(
    curation.environmentFit,
    curation.environment_fit,
    curation.fit,
    environment.fit,
    environment.rating,
    trait.environmentFit,
    trait.environment_fit,
    trait.fit,
    inlineEnvironment.fit,
  ));
  const curationStatus = readableValue(firstValue(
    curation.curationStatus,
    curation.curation_status,
    curation.status,
    curation.decision,
    trait.curationStatus,
    trait.curation_status,
    trait.status,
  ));
  const semanticNotes = joinNotes([
    curation.semanticNotes,
    curation.semantic_notes,
    curation.semantic,
    curation.semanticTags,
    curation.environmentRole,
    curation.storyMeaning,
    curation.storyUse,
    curation.storyPhase,
    environment.semanticNotes,
    environment.notes,
    trait.semanticNotes,
    trait.semantic,
    trait.semanticTags,
    trait.environmentRole,
    trait.storyMeaning,
    trait.storyUse,
    trait.storyPhase,
  ]);
  const curationNotes = joinNotes([
    curation.placementAdvice,
    curation.curationNotes,
    curation.curation_notes,
    curation.notes,
    curation.rationale,
    curation.comment,
    environment.curationNotes,
    trait.placementAdvice,
    trait.curationNotes,
    trait.notes,
    trait.rationale,
  ]);
  const rightsStatus = readableValue(firstValue(
    curation.rightsStatus,
    curation.rights_status,
    trait.rightsStatus,
    trait.rights_status,
  ));
  const designProfile = normalizeDesignProfile(firstValue(
    curation.designProfile,
    curation.design_profile,
    trait.designProfile,
    trait.design_profile,
  ));
  const hasDesignProfile = Object.values(designProfile)
    .some((value) => value !== '' && value !== null);
  const sourceUrls = uniqueStrings([
    ...toArray(curation.sourceUrls),
    curation.sourceUrl,
    ...toArray(trait.sourceUrls),
    trait.sourceUrl,
  ]);
  const searchText = canonical([
    trait.id,
    trait.traitType,
    trait.value,
    environmentFit,
    curationStatus,
    rightsStatus,
    semanticNotes,
    curationNotes,
    ...Object.values(designProfile),
    ...trait.tokenIds,
    ...sourceUrls,
    ...trait.variants.flatMap((variant) => [
      variant.assetUrl,
      variant.previewUrl,
      ...variant.tokenIds,
    ]),
  ].join(' '));

  return {
    ...trait,
    curation,
    environmentFit,
    curationStatus,
    rightsStatus,
    semanticNotes,
    curationNotes,
    designProfile,
    hasDesignProfile,
    sourceUrls,
    searchText,
  };
}

function extractRecords(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.filter(isObject);
  if (!isObject(payload)) return [];

  for (const key of ['traits', 'entries', 'items', 'curation', 'probes', 'variants', 'assets', 'results']) {
    const container = payload[key];
    if (Array.isArray(container)) return container.filter(isObject);
    if (isObject(container)) {
      return Object.entries(container)
        .filter(([, value]) => isObject(value))
        .map(([mapKey, value]) => ({ _mapKey: mapKey, ...value }));
    }
  }

  const directEntries = Object.entries(payload)
    .filter(([key, value]) => !['schemaVersion', 'generatedAt', 'source'].includes(key) && isObject(value));
  if (directEntries.length > 0) {
    return directEntries.map(([mapKey, value]) => ({ _mapKey: mapKey, ...value }));
  }
  return [payload];
}

function createLookup() {
  return {
    byId: new Map(),
    byComposite: new Map(),
    byUrl: new Map(),
    size: 0,
  };
}

function buildLookup(payload, kind) {
  const lookup = createLookup();
  for (const record of extractRecords(payload)) {
    const nestedVariant = objectValue(record.variant);
    const id = cleanText(
      record.id || record.key || record.traitId || record.trait_id || record._mapKey,
    );
    const traitType = cleanText(record.traitType || record.trait_type);
    const value = cleanText(record.value || record.traitValue || record.trait_value);
    const urls = uniqueStrings([
      record.assetUrl,
      record.asset_url,
      record.previewUrl,
      record.preview_url,
      record.url,
      record.sourceUrl,
      ...toArray(record.sourceUrls),
      nestedVariant.assetUrl,
      nestedVariant.asset_url,
      nestedVariant.previewUrl,
      nestedVariant.preview_url,
    ]);

    if (id) lookup.byId.set(canonical(id), record);
    if (traitType || value) lookup.byComposite.set(compositeKey(traitType, value), record);
    for (const url of urls) lookup.byUrl.set(canonical(url), record);
    lookup.size += 1;
  }
  lookup.kind = kind;
  return lookup;
}

function lookupRecord(lookup, traitOrVariant) {
  const id = cleanText(traitOrVariant?.id);
  const traitType = cleanText(traitOrVariant?.traitType || traitOrVariant?.trait_type);
  const value = cleanText(traitOrVariant?.value);
  const urls = [
    traitOrVariant?.assetUrl,
    traitOrVariant?.asset_url,
    traitOrVariant?.previewUrl,
    traitOrVariant?.preview_url,
    traitOrVariant?.url,
  ].filter(Boolean);

  return (id && lookup.byId.get(canonical(id)))
    || ((traitType || value) && lookup.byComposite.get(compositeKey(traitType, value)))
    || urls.map((url) => lookup.byUrl.get(canonical(url))).find(Boolean)
    || null;
}

function populateFilters() {
  replaceOptions(
    elements.traitType,
    uniqueStrings(state.traits.map((trait) => trait.traitType)).sort(naturalCompare),
    'All types',
  );

  const fits = uniqueStrings(state.traits.map((trait) => trait.environmentFit)).sort(naturalCompare);
  replaceOptions(elements.environmentFit, fits, 'All fit ratings');
  elements.environmentFitGroup.hidden = fits.length === 0;

  const statuses = uniqueStrings(state.traits.map((trait) => trait.curationStatus)).sort(naturalCompare);
  replaceOptions(elements.curationStatus, statuses, 'All statuses');
  elements.curationStatusGroup.hidden = statuses.length === 0;

  const mountTypes = uniqueStrings(
    state.traits.map((trait) => trait.designProfile.mountType),
  ).sort(naturalCompare);
  replaceOptions(elements.mountType, mountTypes, 'All mount types', profileLabel);
  elements.mountTypeGroup.hidden = mountTypes.length === 0;

  const phaseReveals = sortControlledValues(
    uniqueStrings(state.traits.map((trait) => trait.designProfile.phaseReveal)),
    ['arrival', 'day', 'dusk', 'post-anomaly', 'resolution', 'future'],
  );
  replaceOptions(elements.phaseReveal, phaseReveals, 'All reveal phases', profileLabel);
  elements.phaseRevealGroup.hidden = phaseReveals.length === 0;

  const affordanceRisks = sortControlledValues(
    uniqueStrings(state.traits.map((trait) => trait.designProfile.affordanceRisk)),
    ['low', 'medium', 'high'],
  );
  replaceOptions(elements.affordanceRisk, affordanceRisks, 'All risk levels', profileLabel);
  elements.affordanceRiskGroup.hidden = affordanceRisks.length === 0;
}

function replaceOptions(select, values, firstLabel, labeler = (value) => value) {
  select.replaceChildren();
  select.append(new Option(firstLabel, ''));
  for (const value of values) select.append(new Option(labeler(value), canonical(value)));
}

function applyFilters() {
  const previousSelection = state.selectedId;
  const query = canonical(elements.query.value);
  const traitType = canonical(elements.traitType.value);
  const environmentFit = canonical(elements.environmentFit.value);
  const curationStatus = canonical(elements.curationStatus.value);
  const mountType = canonical(elements.mountType.value);
  const phaseReveal = canonical(elements.phaseReveal.value);
  const affordanceRisk = canonical(elements.affordanceRisk.value);

  state.filtered = state.traits.filter((trait) => (
    (!query || trait.searchText.includes(query))
    && (!traitType || canonical(trait.traitType) === traitType)
    && (!environmentFit || canonical(trait.environmentFit) === environmentFit)
    && (!curationStatus || canonical(trait.curationStatus) === curationStatus)
    && (!mountType || canonical(trait.designProfile.mountType) === mountType)
    && (!phaseReveal || canonical(trait.designProfile.phaseReveal) === phaseReveal)
    && (!affordanceRisk || canonical(trait.designProfile.affordanceRisk) === affordanceRisk)
  ));

  sortTraits(state.filtered, elements.sort.value);
  if (!state.filtered.some((trait) => trait.id === state.selectedId)) {
    state.selectedId = state.filtered[0]?.id || null;
  }
  if (location.hash && state.selectedId !== previousSelection) {
    const hash = state.selectedId ? `#${encodeURIComponent(state.selectedId)}` : '';
    history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
  }
  const selectedIndex = state.filtered.findIndex((trait) => trait.id === state.selectedId);
  if (selectedIndex >= state.visibleLimit) state.visibleLimit = selectedIndex + 1;
  renderResults();
}

function sortTraits(traits, mode) {
  traits.sort((a, b) => {
    if (mode === 'value-asc') return naturalCompare(a.value, b.value) || naturalCompare(a.traitType, b.traitType);
    if (mode === 'type-asc') return naturalCompare(a.traitType, b.traitType) || naturalCompare(a.value, b.value);
    if (mode === 'variants-desc') return b.variants.length - a.variants.length || b.useCount - a.useCount;
    return b.useCount - a.useCount || b.variants.length - a.variants.length || naturalCompare(a.value, b.value);
  });
}

function renderResults() {
  const shownCount = Math.min(state.filtered.length, state.visibleLimit);
  elements.resultCount.textContent = state.filtered.length === state.traits.length
    ? `Showing ${numberFormatter.format(shownCount)} of ${numberFormatter.format(state.traits.length)} traits`
    : `${numberFormatter.format(state.filtered.length)} matches · showing ${numberFormatter.format(shownCount)}`;
  disconnectPreviewObserver();
  elements.grid.replaceChildren();

  if (state.filtered.length === 0) {
    elements.grid.hidden = true;
    elements.loadMore.hidden = true;
    showEmpty();
    renderDetail(null);
    return;
  }

  elements.state.hidden = true;
  elements.grid.hidden = false;
  const fragment = document.createDocumentFragment();
  for (const trait of state.filtered.slice(0, state.visibleLimit)) {
    fragment.append(createTraitCard(trait));
  }
  elements.grid.append(fragment);
  elements.loadMore.hidden = state.visibleLimit >= state.filtered.length;
  if (!elements.loadMore.hidden) {
    const remaining = state.filtered.length - state.visibleLimit;
    elements.loadMore.textContent = `Show ${numberFormatter.format(Math.min(pageSize, remaining))} more · ${numberFormatter.format(remaining)} remaining`;
  }
  observePreviews();
  renderDetail(state.filtered.find((trait) => trait.id === state.selectedId) || state.filtered[0]);
}

function createTraitCard(trait) {
  const card = createElement('article', 'trait-card');
  card.dataset.traitId = trait.id;
  card.dataset.selected = String(trait.id === state.selectedId);
  if (trait.hasDesignProfile) {
    card.dataset.mountType = trait.designProfile.mountType;
    card.dataset.phaseReveal = trait.designProfile.phaseReveal;
    card.dataset.affordanceRisk = trait.designProfile.affordanceRisk;
  }

  const thumbnail = createElement('div', 'thumbnail-shell');
  const fallback = createElement('span', 'thumbnail-fallback', initials(trait.value));
  fallback.setAttribute('aria-hidden', 'true');
  thumbnail.append(fallback);

  const previewUrl = trait.variants.map((variant) => variant.previewUrl).find(Boolean);
  if (previewUrl && elements.remotePreviews.checked && safeHttpUrl(previewUrl)) {
    const image = document.createElement('img');
    image.alt = `${trait.value} preview`;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.dataset.previewSrc = safeHttpUrl(previewUrl);
    image.addEventListener('load', () => {
      image.dataset.loaded = 'true';
      fallback.hidden = true;
    }, { once: true });
    image.addEventListener('error', () => {
      image.removeAttribute('src');
      image.dataset.failed = 'true';
      fallback.hidden = false;
    }, { once: true });
    thumbnail.append(image);
    thumbnail.append(createElement('span', 'thumbnail-note', 'Lazy preview'));
  } else {
    thumbnail.append(createElement(
      'span',
      'thumbnail-note',
      previewUrl ? 'Preview paused' : 'No preview',
    ));
  }
  card.append(thumbnail);

  const body = createElement('div', 'card-body');
  const badges = createElement('div', 'badge-row');
  badges.append(createBadge(trait.traitType));
  if (trait.environmentFit) badges.append(createBadge(trait.environmentFit, 'fit'));
  if (trait.curationStatus) badges.append(createBadge(trait.curationStatus, 'status'));
  body.append(badges, createElement('h3', '', trait.value));

  if (trait.hasDesignProfile) {
    const castingBadges = createElement('div', 'casting-badge-row');
    castingBadges.append(
      createCastingBadge(trait.designProfile.mountType, 'Mount', 'mount'),
      createCastingBadge(trait.designProfile.phaseReveal, 'Reveal', 'phase'),
      createCastingBadge(
        trait.designProfile.affordanceRisk,
        'Affordance risk',
        `risk risk-${slug(trait.designProfile.affordanceRisk)}`,
      ),
    );
    body.append(castingBadges);
  }

  const note = trait.designProfile.surfaceMeaning
    || trait.semanticNotes
    || trait.curationNotes
    || 'No semantic note recorded yet.';
  body.append(createElement('p', 'card-note', note));

  const metrics = createElement('div', 'metric-row');
  metrics.append(
    createMetric(trait.useCount, 'Uses'),
    createMetric(trait.variants.length, trait.variants.length === 1 ? 'Variant' : 'Variants'),
  );
  body.append(metrics, createTokenRow(trait.tokenIds, 5));

  const actions = createElement('div', 'card-actions');
  const inspect = createElement('button', 'inspect-button', 'Inspect trait');
  inspect.type = 'button';
  inspect.addEventListener('click', () => selectTrait(trait.id, true));
  actions.append(inspect);
  const source = firstSourceUrl(trait);
  if (source && safeHttpUrl(source)) {
    actions.append(createLink(source, sourceHost(source), 'source-link'));
  }
  body.append(actions);
  card.append(body);

  card.addEventListener('click', (event) => {
    if (!event.target.closest('a, button, input, select')) selectTrait(trait.id, true);
  });
  return card;
}

function selectTrait(id, scrollDetail = false) {
  state.selectedId = id;
  for (const card of elements.grid.querySelectorAll('.trait-card')) {
    card.dataset.selected = String(card.dataset.traitId === id);
  }
  const trait = state.filtered.find((entry) => entry.id === id) || null;
  renderDetail(trait);
  history.replaceState(null, '', `${location.pathname}${location.search}#${encodeURIComponent(id)}`);
  if (scrollDetail && window.matchMedia('(max-width: 1180px)').matches) {
    document.querySelector('#detail-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function renderDetail(trait) {
  elements.detailContent.replaceChildren();
  elements.detailEmpty.hidden = Boolean(trait);
  elements.detailContent.hidden = !trait;
  if (!trait) return;

  const header = createElement('div', 'detail-header');
  const headingGroup = document.createElement('div');
  headingGroup.append(
    createElement('p', 'eyebrow', trait.traitType),
    createElement('h2', '', trait.value),
    createElement('p', 'detail-id', trait.id),
  );
  const close = createElement('button', 'detail-close', 'Clear');
  close.type = 'button';
  close.addEventListener('click', () => {
    state.selectedId = null;
    renderDetail(null);
    for (const card of elements.grid.querySelectorAll('.trait-card')) card.dataset.selected = 'false';
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  });
  header.append(headingGroup, close);
  elements.detailContent.append(header);

  const badges = createElement('div', 'badge-row');
  if (trait.environmentFit) badges.append(createBadge(`Fit: ${trait.environmentFit}`, 'fit'));
  if (trait.curationStatus) badges.append(createBadge(trait.curationStatus, 'status'));
  if (trait.rightsStatus) badges.append(createBadge(`Rights: ${trait.rightsStatus}`));
  if (trait.designProfile.mountType) {
    badges.append(createCastingBadge(trait.designProfile.mountType, 'Mount', 'mount'));
  }
  if (trait.designProfile.phaseReveal) {
    badges.append(createCastingBadge(trait.designProfile.phaseReveal, 'Reveal', 'phase'));
  }
  if (trait.designProfile.affordanceRisk) {
    badges.append(createCastingBadge(
      trait.designProfile.affordanceRisk,
      'Affordance risk',
      `risk risk-${slug(trait.designProfile.affordanceRisk)}`,
    ));
  }
  if (badges.childElementCount) elements.detailContent.append(badges);

  const metricSection = createElement('section', 'detail-section');
  const detailMetrics = createElement('div', 'detail-metrics');
  detailMetrics.append(
    createDetailMetric(trait.useCount, 'Uses'),
    createDetailMetric(trait.variants.length, 'Variants'),
    createDetailMetric(trait.tokenIds.length, 'Tokens'),
  );
  metricSection.append(detailMetrics);
  elements.detailContent.append(metricSection);

  elements.detailContent.append(createCastingProfileSection(trait));

  if (trait.semanticNotes) {
    elements.detailContent.append(createTextSection('Semantic role', trait.semanticNotes));
  }
  if (trait.curationNotes) {
    elements.detailContent.append(createTextSection('Curation notes', trait.curationNotes));
  }

  const tokenSection = createElement('section', 'detail-section');
  tokenSection.append(createElement('h3', '', 'Sample token IDs'));
  tokenSection.append(createTokenRow(trait.tokenIds, 18));
  elements.detailContent.append(tokenSection);

  if (trait.sourceUrls.length > 0) {
    const sourceSection = createElement('section', 'detail-section');
    sourceSection.append(createElement('h3', '', 'Trait sources'));
    const links = createElement('div', 'url-list');
    for (const url of trait.sourceUrls) links.append(createUrlLine(url, 'Source'));
    sourceSection.append(links);
    elements.detailContent.append(sourceSection);
  }

  const variantSection = createElement('section', 'detail-section');
  variantSection.append(createElement('h3', '', `Variants (${trait.variants.length})`));
  if (trait.variants.length === 0) {
    variantSection.append(createElement('p', '', 'No source variants were recorded.'));
  } else {
    const list = createElement('div', 'variant-list');
    trait.variants.forEach((variant, index) => list.append(createVariantCard(variant, index)));
    variantSection.append(list);
  }
  elements.detailContent.append(variantSection);
}

function createCastingProfileSection(trait) {
  const section = createElement('section', 'detail-section casting-profile');
  section.append(createElement('h3', '', 'Casting profile'));
  if (!trait.hasDesignProfile) {
    section.append(createElement(
      'p',
      'profile-empty',
      'No schema-v2 casting profile is recorded for this collection trait.',
    ));
    return section;
  }

  const profile = trait.designProfile;
  const meanings = createElement('div', 'meaning-pair');
  meanings.append(
    createMeaningCard('Surface meaning', profile.surfaceMeaning, 'surface'),
    createMeaningCard('Counter meaning', profile.counterMeaning, 'counter'),
  );
  section.append(meanings);

  const facts = document.createElement('dl');
  facts.className = 'profile-grid';
  const definitions = [
    ['Silhouette', profile.silhouetteClass],
    ['Mount', profile.mountType],
    ['Read distance', profile.readDistance],
    ['Palette', profile.paletteFamily],
    ['Phase reveal', profile.phaseReveal],
    ['Affordance risk', profile.affordanceRisk],
    ['Shot role', profile.shotRole],
    ['Maximum per shot', profile.maximumPerShot],
    ['Technical readiness', profile.technicalReadiness],
    ['Rights coverage', profile.rightsCoverage],
  ];
  for (const [label, value] of definitions) {
    facts.append(createProfileFact(label, value));
  }
  section.append(facts);
  return section;
}

function createMeaningCard(label, meaning, modifier) {
  const card = createElement('article', `meaning-card ${modifier}`);
  card.append(
    createElement('h4', '', label),
    createElement('p', '', meaning || 'Not recorded.'),
  );
  return card;
}

function createProfileFact(label, value) {
  const item = createElement('div', 'profile-fact');
  const term = createElement('dt', '', label);
  const definition = createElement(
    'dd',
    '',
    value === null || value === '' ? 'Not recorded' : profileLabel(value),
  );
  item.append(term, definition);
  return item;
}

function createVariantCard(variant, index) {
  const card = createElement('article', 'variant-card');
  const heading = createElement('div', 'variant-heading');
  heading.append(
    createElement('strong', '', `Variant ${index + 1}`),
    createElement('span', '', `${numberFormatter.format(variant.useCount)} uses`),
  );
  card.append(heading, createTokenRow(variant.tokenIds, 10));

  const urls = createElement('div', 'url-list');
  if (variant.assetUrl) urls.append(createUrlLine(variant.assetUrl, 'Asset'));
  if (variant.previewUrl) urls.append(createUrlLine(variant.previewUrl, 'Preview'));
  if (urls.childElementCount) card.append(urls);

  const probe = lookupRecord(state.probeLookup, variant);
  if (probe) {
    const inspection = objectValue(probe.inspection);
    const counts = objectValue(inspection.counts);
    const compatibility = objectValue(inspection.compatibility);
    const probeStatus = readableValue(firstValue(
      compatibility.classification,
      probe.status,
      probe.probeStatus,
      probe.result,
      probe.ok === true ? 'reachable' : null,
      probe.ok === false ? 'failed' : null,
    ));
    const detail = joinNotes([
      probeStatus && `Probe: ${probeStatus}`,
      probe.contentType || probe.mimeType,
      Number.isFinite(Number(inspection.bytes ?? probe.bytes))
        ? `${numberFormatter.format(Number(inspection.bytes ?? probe.bytes))} bytes`
        : '',
      Number.isFinite(Number(counts.triangles))
        ? `${numberFormatter.format(Number(counts.triangles))} triangles`
        : '',
      Number.isFinite(Number(counts.meshes)) && Number.isFinite(Number(counts.primitives))
        ? `${numberFormatter.format(Number(counts.meshes))} mesh / ${numberFormatter.format(Number(counts.primitives))} primitive`
        : '',
    ]);
    if (detail) {
      const probeLine = createElement('div', 'probe-line', detail);
      probeLine.title = joinNotes(compatibility.reasons || []);
      card.append(probeLine);
    }
  }
  return card;
}

function createUrlLine(url, label) {
  const safeUrl = safeHttpUrl(url);
  if (!safeUrl) return createElement('span', 'url-text', `${label}: ${url}`);
  const link = createLink(safeUrl, `${label}: ${url}`, 'url-link');
  link.title = url;
  return link;
}

function createTextSection(title, text) {
  const section = createElement('section', 'detail-section');
  section.append(createElement('h3', '', title), createElement('p', '', text));
  return section;
}

function createTokenRow(tokenIds, limit) {
  const row = createElement('div', 'token-row');
  const tokens = tokenIds.slice(0, limit);
  for (const token of tokens) row.append(createElement('span', 'token-chip', `#${token}`));
  if (tokenIds.length > limit) {
    row.append(createElement('span', 'token-chip', `+${tokenIds.length - limit}`));
  }
  if (tokens.length === 0) row.append(createElement('span', 'token-chip', 'No samples'));
  return row;
}

function createMetric(value, label) {
  const metric = createElement('div', 'metric');
  metric.append(
    createElement('strong', '', numberFormatter.format(value)),
    createElement('span', '', label),
  );
  return metric;
}

function createDetailMetric(value, label) {
  const metric = createElement('div', 'detail-metric');
  metric.append(
    createElement('strong', '', numberFormatter.format(value)),
    createElement('span', '', label),
  );
  return metric;
}

function createBadge(text, modifier = '') {
  return createElement('span', `badge${modifier ? ` ${modifier}` : ''}`, text);
}

function createCastingBadge(value, label, modifier = '') {
  const badge = createElement(
    'span',
    `casting-badge${modifier ? ` ${modifier}` : ''}`,
    profileLabel(value),
  );
  badge.title = `${label}: ${profileLabel(value)}`;
  badge.setAttribute('aria-label', `${label}: ${profileLabel(value)}`);
  return badge;
}

function createElement(tag, className = '', text = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = String(text);
  return element;
}

function createLink(url, text, className = '') {
  const link = createElement('a', className, text);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.referrerPolicy = 'no-referrer';
  return link;
}

function observePreviews() {
  const images = [...elements.grid.querySelectorAll('img[data-preview-src]')];
  if (images.length === 0) return;

  if (!('IntersectionObserver' in window)) {
    for (const image of images) image.src = image.dataset.previewSrc;
    return;
  }

  previewObserver = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const image = entry.target;
      image.src = image.dataset.previewSrc;
      observer.unobserve(image);
    }
  }, { rootMargin: '260px 0px' });
  for (const image of images) previewObserver.observe(image);
}

function disconnectPreviewObserver() {
  previewObserver?.disconnect();
  previewObserver = null;
}

function showLoading() {
  elements.grid.hidden = true;
  elements.state.hidden = false;
  elements.state.className = 'state-card loading-state';
  elements.state.replaceChildren(
    createElement('span', 'spinner'),
    stateCopy('Reading the local index', 'Preparing trait families, variants, and token samples.'),
  );
}

function showError(error) {
  elements.grid.hidden = true;
  elements.state.hidden = false;
  elements.state.className = 'state-card error-state';
  const copy = stateCopy('The atlas could not open', error?.message || 'An unexpected error occurred.');
  const actions = createElement('div', 'state-actions');
  const retry = createElement('button', 'primary-button', 'Try again');
  retry.type = 'button';
  retry.addEventListener('click', loadAtlas, { once: true });
  actions.append(retry);
  copy.append(actions);
  elements.state.replaceChildren(copy);
  elements.resultCount.textContent = '';
  elements.heroSummary.textContent = 'Local index unavailable';
  renderDetail(null);
}

function showEmpty() {
  elements.state.hidden = false;
  elements.state.className = 'state-card empty-state';
  const copy = stateCopy('No traits match', 'Try a broader search or clear the current filters.');
  const actions = createElement('div', 'state-actions');
  const clear = createElement('button', 'secondary-button', 'Clear filters');
  clear.type = 'button';
  clear.addEventListener('click', clearFilters, { once: true });
  actions.append(clear);
  copy.append(actions);
  elements.state.replaceChildren(copy);
}

function stateCopy(title, message) {
  const copy = document.createElement('div');
  copy.append(createElement('h3', '', title), createElement('p', '', message));
  return copy;
}

function clearFilters() {
  elements.query.value = '';
  elements.traitType.value = '';
  elements.environmentFit.value = '';
  elements.curationStatus.value = '';
  elements.mountType.value = '';
  elements.phaseReveal.value = '';
  elements.affordanceRisk.value = '';
  elements.sort.value = 'uses-desc';
  state.visibleLimit = pageSize;
  applyFilters();
  elements.query.focus();
}

function renderHeroSummary() {
  const variants = state.traits.reduce((total, trait) => total + trait.variants.length, 0);
  const uses = state.traits.reduce((total, trait) => total + trait.useCount, 0);
  const castingProfiles = state.traits.filter((trait) => trait.hasDesignProfile).length;
  elements.heroSummary.replaceChildren(
    createElement('span', 'pulse-dot'),
    document.createTextNode(
      `${numberFormatter.format(state.traits.length)} traits · ${numberFormatter.format(variants)} variants · ${numberFormatter.format(uses)} uses · ${numberFormatter.format(castingProfiles)} casting profiles`,
    ),
  );
}

function renderDataHealth() {
  elements.dataHealth.replaceChildren(
    createHealthLine('Trait index', state.sourceStatus.index),
    createHealthLine('Curation', state.sourceStatus.curation),
    createHealthLine('GLB probes', state.sourceStatus.probes),
  );
}

function createHealthLine(label, status) {
  const line = createElement('div', 'health-line');
  line.append(createElement('strong', '', label));
  const statusLabel = {
    loaded: 'Loaded',
    missing: 'Optional',
    error: 'Unreadable',
    loading: 'Loading',
  }[status] || status;
  const modifier = status === 'error' ? ' warn' : status === 'loaded' ? '' : ' muted';
  line.append(createElement('span', `health-pill${modifier}`, statusLabel));
  return line;
}

function restoreSelectionFromHash() {
  const requested = decodeURIComponent(location.hash.slice(1));
  state.selectedId = state.traits.some((trait) => trait.id === requested)
    ? requested
    : null;
}

function firstSourceUrl(trait) {
  return trait.sourceUrls[0]
    || trait.variants.find((variant) => variant.assetUrl)?.assetUrl
    || '';
}

function safeHttpUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value, location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function sourceHost(value) {
  try {
    return new URL(value, location.href).hostname || 'Source';
  } catch {
    return 'Source';
  }
}

function positiveNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeDesignProfile(value) {
  const profile = objectValue(value);
  const maximum = Number(firstValue(
    profile.maximumPerShot,
    profile.maximum_per_shot,
  ));
  return {
    surfaceMeaning: cleanText(firstValue(profile.surfaceMeaning, profile.surface_meaning)),
    counterMeaning: cleanText(firstValue(profile.counterMeaning, profile.counter_meaning)),
    silhouetteClass: cleanText(firstValue(profile.silhouetteClass, profile.silhouette_class)),
    mountType: cleanText(firstValue(profile.mountType, profile.mount_type)),
    readDistance: cleanText(firstValue(profile.readDistance, profile.read_distance)),
    paletteFamily: cleanText(firstValue(profile.paletteFamily, profile.palette_family)),
    phaseReveal: cleanText(firstValue(profile.phaseReveal, profile.phase_reveal)),
    affordanceRisk: cleanText(firstValue(profile.affordanceRisk, profile.affordance_risk)),
    shotRole: cleanText(firstValue(profile.shotRole, profile.shot_role)),
    maximumPerShot: Number.isInteger(maximum) && maximum > 0 ? maximum : null,
    technicalReadiness: cleanText(firstValue(
      profile.technicalReadiness,
      profile.technical_readiness,
    )),
    rightsCoverage: cleanText(firstValue(profile.rightsCoverage, profile.rights_coverage)),
  };
}

function profileLabel(value) {
  if (typeof value === 'number') return numberFormatter.format(value);
  return cleanText(value)
    .split('-')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function sortControlledValues(values, order) {
  const ranks = new Map(order.map((value, index) => [canonical(value), index]));
  return values.slice().sort((a, b) => (
    (ranks.get(canonical(a)) ?? Number.MAX_SAFE_INTEGER)
    - (ranks.get(canonical(b)) ?? Number.MAX_SAFE_INTEGER)
    || naturalCompare(a, b)
  ));
}

function uniqueTokens(values) {
  return [...new Set(toArray(values)
    .map((value) => String(value).replace(/^#/, '').trim())
    .filter(Boolean))]
    .sort((a, b) => Number(a) - Number(b) || naturalCompare(a, b));
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values.flatMap(toArray)) {
    const text = cleanText(value);
    const key = canonical(text);
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function joinNotes(value) {
  return uniqueStrings(flattenNoteParts(value)).join(' · ');
}

function flattenNoteParts(value) {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value.flatMap(flattenNoteParts);
  if (isObject(value)) {
    return [
      value.label,
      value.summary,
      value.note,
      value.notes,
      value.rationale,
      value.meaning,
      value.role,
      value.status,
    ].flatMap(flattenNoteParts);
  }
  return [cleanText(value)];
}

function readableValue(value) {
  if (value === undefined || value === null || value === '') return '';
  if (Array.isArray(value)) return joinNotes(value);
  if (isObject(value)) {
    return readableValue(firstValue(
      value.label,
      value.status,
      value.value,
      value.rating,
      value.fit,
      value.score,
      value.name,
    ));
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return cleanText(value);
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function objectValue(value) {
  return isObject(value) ? value : {};
}

function toArray(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

function cleanText(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return '';
  return String(value).trim();
}

function canonical(value) {
  return cleanText(value).toLocaleLowerCase().replace(/\s+/g, ' ');
}

function compositeKey(traitType, value) {
  return `${canonical(traitType)}::${canonical(value)}`;
}

function slug(value) {
  return canonical(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'trait';
}

function initials(value) {
  return cleanText(value)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '✦';
}

function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
