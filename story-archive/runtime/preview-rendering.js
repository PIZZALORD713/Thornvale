export function resolvePreviewPixelRatio(value, cap = 2) {
  const ratio = Number(value);
  return Math.min(Number.isFinite(ratio) && ratio > 0 ? ratio : 1, cap);
}

export function resizePreviewRenderer({
  renderer,
  camera,
  width,
  height,
  devicePixelRatio,
  pixelRatioCap = 2,
}) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const pixelRatio = resolvePreviewPixelRatio(devicePixelRatio, pixelRatioCap);

  camera.aspect = safeWidth / safeHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(safeWidth, safeHeight, false);

  return Object.freeze({
    width: safeWidth,
    height: safeHeight,
    pixelRatio,
  });
}
