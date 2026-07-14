function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function smoothstep01(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/**
 * Samples a broad, flat-topped mound in world space.
 *
 * The smoothstep shoulder has zero slope at both the meadow seam and plateau,
 * which keeps the character controller grounded while still reading as a hill.
 */
export function sampleMoundHeight(mound, xValue, zValue) {
  if (!mound) return 0;
  const x = Number(xValue) || 0;
  const z = Number(zValue) || 0;
  const centerX = Number(mound.x) || 0;
  const centerZ = Number(mound.z) || 0;
  const radiusX = Math.max(0.001, Number(mound.radiusX) || 1);
  const radiusZ = Math.max(0.001, Number(mound.radiusZ) || 1);
  const baseY = Number(mound.baseY) || 0;
  const height = Math.max(0, Number(mound.height) || 0);
  const plateauRadius = Math.max(0, Math.min(0.9, Number(mound.plateauRadius) || 0));
  const dx = (x - centerX) / radiusX;
  const dz = (z - centerZ) / radiusZ;
  const radius = Math.hypot(dx, dz);
  if (radius >= 1) return baseY;
  if (radius <= plateauRadius) return baseY + height;
  const shoulder = 1 - ((radius - plateauRadius) / (1 - plateauRadius));
  return baseY + height * smoothstep01(shoulder);
}

/**
 * Produces one shared indexed surface for the visual mound and its Rapier mesh.
 */
export function createMoundSurfaceGrid(mound, {
  segmentsX = mound?.segmentsX ?? 28,
  segmentsZ = mound?.segmentsZ ?? 24,
} = {}) {
  const columns = Math.max(2, Math.floor(Number(segmentsX) || 0));
  const rows = Math.max(2, Math.floor(Number(segmentsZ) || 0));
  const radiusX = Math.max(0.001, Number(mound?.radiusX) || 1);
  const radiusZ = Math.max(0.001, Number(mound?.radiusZ) || 1);
  const centerX = Number(mound?.x) || 0;
  const centerZ = Number(mound?.z) || 0;
  const vertices = new Float32Array((columns + 1) * (rows + 1) * 3);
  const indices = new Uint32Array(columns * rows * 6);

  let vertexOffset = 0;
  for (let zIndex = 0; zIndex <= rows; zIndex += 1) {
    const z = centerZ - radiusZ + (zIndex / rows) * radiusZ * 2;
    for (let xIndex = 0; xIndex <= columns; xIndex += 1) {
      const x = centerX - radiusX + (xIndex / columns) * radiusX * 2;
      vertices[vertexOffset] = x;
      vertices[vertexOffset + 1] = sampleMoundHeight(mound, x, z);
      vertices[vertexOffset + 2] = z;
      vertexOffset += 3;
    }
  }

  let indexOffset = 0;
  const stride = columns + 1;
  for (let zIndex = 0; zIndex < rows; zIndex += 1) {
    for (let xIndex = 0; xIndex < columns; xIndex += 1) {
      const a = zIndex * stride + xIndex;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices[indexOffset] = a;
      indices[indexOffset + 1] = c;
      indices[indexOffset + 2] = b;
      indices[indexOffset + 3] = b;
      indices[indexOffset + 4] = c;
      indices[indexOffset + 5] = d;
      indexOffset += 6;
    }
  }

  return { vertices, indices, columns, rows };
}
