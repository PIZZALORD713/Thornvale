function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

/**
 * Small, decorative recognition cues for the three landmarks Lumen names.
 * Text and world targets remain authoritative when an optional image fails.
 */
export const KEY_OBJECT_CUES_V1 = deepFreeze({
  ledger: {
    id: 'community-ledger',
    label: 'Community Ledger',
    src: '/ui/key-object-cues/v1/community-ledger.avif',
  },
  camp: {
    id: 'forest-edge-camp',
    label: 'Forest-edge camp',
    src: '/ui/key-object-cues/v1/forest-edge-camp.avif',
  },
  bell: {
    id: 'town-bell',
    label: 'Town Bell',
    src: '/ui/key-object-cues/v1/town-bell.avif',
  },
});

export default KEY_OBJECT_CUES_V1;
