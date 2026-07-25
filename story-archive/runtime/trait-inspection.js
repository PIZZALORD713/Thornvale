const TRAIT_PRESENTATION = Object.freeze({
  backpiece: Object.freeze({
    label: 'Backpiece',
    format: 'GLB mesh',
    binding: 'Rigged back attachment',
  }),
  body: Object.freeze({
    label: 'Body',
    format: 'GLB mesh',
    binding: 'Primary rig and body substrate',
  }),
  face: Object.freeze({
    label: 'Face',
    format: 'PNG texture',
    binding: 'Face overlay shown on its head substrate',
  }),
  hand: Object.freeze({
    label: 'Hand',
    format: 'GLB mesh',
    binding: 'Rigged hand attachment',
  }),
  head: Object.freeze({
    label: 'Head',
    format: 'GLB mesh',
    binding: 'Rigged head substrate',
  }),
  shoe: Object.freeze({
    label: 'Shoe',
    format: 'GLB mesh',
    binding: 'Rigged footwear',
  }),
  sprout: Object.freeze({
    label: 'Sprout',
    format: 'GLB mesh',
    binding: 'Rigged crown attachment',
  }),
});

const CHARACTER_VISIBILITY = new WeakMap();

function getPresentation(traitType) {
  const presentation = TRAIT_PRESENTATION[String(traitType || '').toLowerCase()];
  if (!presentation) {
    throw new Error(`Unknown character trait type: ${String(traitType)}`);
  }
  return presentation;
}

function getRenderableTraitType(object) {
  return String(
    object?.userData?.friendsiesTrait?.traitType
    ?? object?.userData?.friendsiesTrait?.trait_type
    ?? '',
  ).toLowerCase() || null;
}

function getVisibilitySnapshot(character, renderables) {
  let snapshot = CHARACTER_VISIBILITY.get(character);
  if (!snapshot) {
    snapshot = new Map(renderables.map((object) => [object, object.visible !== false]));
    CHARACTER_VISIBILITY.set(character, snapshot);
  }
  return snapshot;
}

export function createTraitInspectionDetail(asset, options = {}) {
  const traitType = String(asset?.traitType ?? asset?.trait_type ?? '').toLowerCase();
  const presentation = getPresentation(traitType);
  if (typeof asset?.value !== 'string' || asset.value.trim() === '') {
    throw new Error(`Character trait ${traitType} requires a value.`);
  }
  if (typeof asset?.url !== 'string' || asset.url.trim() === '') {
    throw new Error(`Character trait ${traitType} requires an asset URL.`);
  }

  return Object.freeze({
    traitType,
    label: presentation.label,
    value: asset.value,
    assetUrl: asset.url,
    format: presentation.format,
    binding: presentation.binding,
    provenancePath: options.provenancePath || null,
  });
}

export function applyCharacterTraitInspection(character, selectedTraitType = null) {
  if (!character || typeof character.traverse !== 'function') {
    throw new Error('Trait inspection requires an assembled character.');
  }

  const selected = selectedTraitType === null
    ? null
    : String(selectedTraitType).toLowerCase();
  if (selected !== null) getPresentation(selected);

  const renderables = [];
  character.traverse((object) => {
    if (object?.isMesh || object?.isSkinnedMesh) renderables.push(object);
  });
  const snapshot = getVisibilitySnapshot(character, renderables);
  const visibleTypes = selected === 'face'
    ? ['head', 'face']
    : (selected ? [selected] : Object.keys(TRAIT_PRESENTATION));
  const visibleTypeSet = new Set(visibleTypes);
  let visibleRenderableCount = 0;

  for (const object of renderables) {
    const baselineVisible = snapshot.get(object) !== false;
    const traitType = getRenderableTraitType(object);
    object.visible = selected === null
      ? baselineVisible
      : baselineVisible && visibleTypeSet.has(traitType);
    if (object.visible) visibleRenderableCount += 1;
  }

  return Object.freeze({
    selectedTraitType: selected,
    visibleTraitTypes: Object.freeze([...visibleTypes]),
    visibleRenderableCount,
  });
}

export function getCharacterTraitTypes() {
  return Object.freeze(Object.keys(TRAIT_PRESENTATION));
}
