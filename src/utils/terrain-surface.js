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
  // The old Cartesian grid retained every corner of the mound's bounding box.
  // Those flat corners became a visible rectangular platform wherever the Bell
  // hill extended past the circular meadow. Concentric oval rings keep the
  // authored footprint itself as the render, character, and camera surface.
  const columns = Math.max(8, Math.floor(Number(segmentsX) || 0) * 2);
  const rows = Math.max(2, Math.floor(Number(segmentsZ) || 0));
  const radiusX = Math.max(0.001, Number(mound?.radiusX) || 1);
  const radiusZ = Math.max(0.001, Number(mound?.radiusZ) || 1);
  const centerX = Number(mound?.x) || 0;
  const centerZ = Number(mound?.z) || 0;
  const vertices = new Float32Array((1 + columns * rows) * 3);
  const indices = new Uint32Array(columns * 3 + columns * (rows - 1) * 6);

  vertices[0] = centerX;
  vertices[1] = sampleMoundHeight(mound, centerX, centerZ);
  vertices[2] = centerZ;
  let vertexOffset = 3;
  for (let ringIndex = 1; ringIndex <= rows; ringIndex += 1) {
    const ringRadius = ringIndex / rows;
    for (let angleIndex = 0; angleIndex < columns; angleIndex += 1) {
      const angle = (angleIndex / columns) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * radiusX * ringRadius;
      const z = centerZ + Math.sin(angle) * radiusZ * ringRadius;
      vertices[vertexOffset] = x;
      vertices[vertexOffset + 1] = sampleMoundHeight(mound, x, z);
      vertices[vertexOffset + 2] = z;
      vertexOffset += 3;
    }
  }

  let indexOffset = 0;
  for (let angleIndex = 0; angleIndex < columns; angleIndex += 1) {
    const nextAngle = (angleIndex + 1) % columns;
    indices[indexOffset] = 0;
    indices[indexOffset + 1] = 1 + nextAngle;
    indices[indexOffset + 2] = 1 + angleIndex;
    indexOffset += 3;
  }
  for (let ringIndex = 1; ringIndex < rows; ringIndex += 1) {
    const innerStart = 1 + (ringIndex - 1) * columns;
    const outerStart = innerStart + columns;
    for (let angleIndex = 0; angleIndex < columns; angleIndex += 1) {
      const nextAngle = (angleIndex + 1) % columns;
      const a = innerStart + angleIndex;
      const b = innerStart + nextAngle;
      const c = outerStart + angleIndex;
      const d = outerStart + nextAngle;
      indices[indexOffset] = a;
      indices[indexOffset + 1] = b;
      indices[indexOffset + 2] = c;
      indices[indexOffset + 3] = b;
      indices[indexOffset + 4] = d;
      indices[indexOffset + 5] = c;
      indexOffset += 6;
    }
  }

  return { vertices, indices, columns, rows };
}
