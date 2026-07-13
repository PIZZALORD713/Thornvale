import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  StaticDrawUsage,
} from 'three';
import { getBuildingBounds, TOWN_LAYOUT } from '../config/town.js';

export const GRASS_QUALITY_COUNTS = Object.freeze({
  low: 192,
  medium: 432,
  high: 800,
});

// Wave speeds are 0.4 and 0.2 radians/second. At 10π seconds both
// complete a whole number of cycles, so wrapping is precision-safe and
// visually continuous during long sessions.
export const GRASS_TIME_WRAP_SECONDS = Math.PI * 10;

const DEFAULT_SEED = 260712;
const BLADE_HEIGHT = 0.45;
const CLUSTER_MIN_SIZE = 4;
const CLUSTER_MAX_SIZE = 7;
const CLUSTER_MIN_RADIUS = 0.24;
const CLUSTER_MAX_RADIUS = 0.55;
const CLUSTER_SEPARATION = 0.72;
const SOLITARY_RATIO = 0.22;
const SOLITARY_SEPARATION = 0.66;
const GRASS_COLORS = [
  new Color(0x66845f),
  new Color(0x78966c),
  new Color(0x8ba47a),
];

const SHADER_DECLARATIONS = `
uniform float uGrassTime;
uniform float uGrassMotion;
`;

const SHADER_TRANSFORM = `
  vec4 grassWorldOrigin;
  #ifdef USE_INSTANCING
    grassWorldOrigin = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  #else
    grassWorldOrigin = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  #endif
  float grassTip = smoothstep(0.065, ${BLADE_HEIGHT.toFixed(3)}, position.y);
  float grassPhaseA = grassWorldOrigin.x * 0.23 + grassWorldOrigin.z * 0.17;
  float grassPhaseB = grassWorldOrigin.x * -0.11 + grassWorldOrigin.z * 0.29;
  float grassWaveA = sin(grassPhaseA + uGrassTime * 0.4);
  float grassWaveB = sin(grassPhaseB + uGrassTime * 0.2);
  float grassBend = grassTip * grassTip * uGrassMotion;
  transformed.x += (grassWaveA * 0.038 + grassWaveB * 0.016) * grassBend;
  transformed.z += (grassWaveA * 0.016 - grassWaveB * 0.018) * grassBend;
  transformed.y += grassWaveB * 0.004 * grassBend;
  float grassCameraDistance = length((viewMatrix * grassWorldOrigin).xyz);
  // Keep tuft shards outside the close follow-camera envelope.
  float grassNearScale = smoothstep(3.0, 7.0, grassCameraDistance);
  transformed *= grassNearScale;
`;

export function normalizeGrassQuality(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return Object.hasOwn(GRASS_QUALITY_COUNTS, normalized) ? normalized : 'high';
}

export function wrapGrassTime(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const wrapped = numeric % GRASS_TIME_WRAP_SECONDS;
  return wrapped < 0 ? wrapped + GRASS_TIME_WRAP_SECONDS : wrapped;
}

function seededRandom(seed = DEFAULT_SEED) {
  let value = (Number.isFinite(Number(seed)) ? Number(seed) : DEFAULT_SEED) >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function squaredDistance(x1, z1, x2, z2) {
  const dx = x1 - x2;
  const dz = z1 - z2;
  return dx * dx + dz * dz;
}

function sampleMeadowPoint(random, radius) {
  const angle = random() * Math.PI * 2;
  const distance = Math.sqrt(random()) * radius;
  return {
    x: Math.cos(angle) * distance,
    z: Math.sin(angle) * distance,
  };
}

function createPlacement(x, z, random) {
  return {
    x,
    y: 0.035,
    z,
    yaw: random() * Math.PI * 2,
    scaleX: 0.78 + random() * 0.38,
    scaleY: 0.78 + random() * 0.22,
    scaleZ: 0.78 + random() * 0.38,
    tone: Math.min(2, Math.floor(random() * 3)),
  };
}

function createClusterSizes(total, random) {
  const sizes = [];
  let remaining = total;
  while (remaining > 0) {
    const candidates = [];
    for (let size = CLUSTER_MIN_SIZE; size <= CLUSTER_MAX_SIZE; size += 1) {
      const after = remaining - size;
      if (after === 0 || after >= CLUSTER_MIN_SIZE) candidates.push(size);
    }
    if (candidates.length === 0) return null;
    const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
    const size = candidates[index];
    sizes.push(size);
    remaining -= size;
  }
  return sizes;
}

function clusterClearsExisting(center, radius, clusters) {
  return clusters.every((cluster) => (
    squaredDistance(center.x, center.z, cluster.x, cluster.z)
      > (radius + cluster.radius + CLUSTER_SEPARATION) ** 2
  ));
}

function createClusterOrigins(center, radius, size, random) {
  const origins = [{ x: center.x, z: center.z }];
  const outerCount = size - 1;
  const rotation = random() * Math.PI * 2;
  for (let index = 0; index < outerCount; index += 1) {
    const angle = rotation
      + (index / outerCount) * Math.PI * 2
      + (random() - 0.5) * 0.14;
    const distance = radius * (0.72 + random() * 0.24);
    origins.push({
      x: center.x + Math.cos(angle) * distance,
      z: center.z + Math.sin(angle) * distance,
    });
  }
  return origins;
}

function originClearsPlacements(origin, placements, distance) {
  const minimumSquared = distance * distance;
  return placements.every((placement) => (
    squaredDistance(origin.x, origin.z, placement.x, placement.z) > minimumSquared
  ));
}

function pointInCircle(x, z, center, radius) {
  if (!center) return false;
  return squaredDistance(x, z, Number(center.x) || 0, Number(center.z) || 0)
    <= radius * radius;
}

function pointInBounds(x, z, bounds) {
  return Boolean(bounds)
    && x >= bounds.minX
    && x <= bounds.maxX
    && z >= bounds.minZ
    && z <= bounds.maxZ;
}

function squaredDistanceToSegment(x, z, startX, startZ, endX, endZ) {
  const dx = endX - startX;
  const dz = endZ - startZ;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= 1e-10) return squaredDistance(x, z, startX, startZ);
  const t = Math.max(0, Math.min(1, ((x - startX) * dx + (z - startZ) * dz) / lengthSquared));
  return squaredDistance(x, z, startX + dx * t, startZ + dz * t);
}

function pathPointXZ(point) {
  return Array.isArray(point) && point.length >= 3
    ? { x: Number(point[0]) || 0, z: Number(point[2]) || 0 }
    : { x: Number(point?.[0]) || 0, z: Number(point?.[1]) || 0 };
}

function pointNearPolyline(x, z, points, clearance) {
  if (!Array.isArray(points) || points.length < 2) return false;
  const clearanceSquared = clearance * clearance;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = pathPointXZ(points[index]);
    const end = pathPointXZ(points[index + 1]);
    if (squaredDistanceToSegment(x, z, start.x, start.z, end.x, end.z) <= clearanceSquared) {
      return true;
    }
  }
  return false;
}

/**
 * Conservative flat-meadow mask. Clearance includes the tuft footprint, so a
 * permitted origin cannot visually grow through the protected surface edge.
 */
export function isGrassPlacementAllowed(xValue, zValue, layout = TOWN_LAYOUT) {
  const x = Number(xValue);
  const z = Number(zValue);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;

  const meadowRadius = Math.max(0, Number(layout?.meadowRadius) || 0);
  const usableRadius = Math.max(0, meadowRadius - 2.25);
  if (x * x + z * z > usableRadius * usableRadius) return false;

  const plaza = layout?.plaza;
  if (pointInCircle(x, z, plaza, (Number(plaza?.radius) || 0) + 1.15)) return false;

  for (const building of layout?.buildings || []) {
    if (pointInBounds(x, z, getBuildingBounds(building, 2.05))) return false;
  }

  for (const path of layout?.paths || []) {
    const clearance = (Number(path.width) || 0) * 0.5 + 1.05;
    if (pointNearPolyline(x, z, path.points, clearance)) return false;
  }

  for (const points of Object.values(layout?.storyRoutes || {})) {
    if (pointNearPolyline(x, z, points, 0.9)) return false;
  }

  const pond = layout?.pond;
  if (pond) {
    const dx = (x - (Number(pond.x) || 0)) / 5.2;
    const dz = (z - (Number(pond.z) || 0)) / 4.05;
    if (dx * dx + dz * dz <= 1) return false;
  }

  const landmarkClearance = { ledger: 2.45, bell: 2.35 };
  for (const [id, landmark] of Object.entries(layout?.landmarks || {})) {
    if (pointInCircle(x, z, landmark, landmarkClearance[id] || 2.1)) return false;
  }

  if (pointInCircle(x, z, layout?.gate, 2.75)) return false;

  const propClearance = { wayfinder: 1.25, gardenArch: 2.15, stoneWell: 2.25 };
  for (const [id, prop] of Object.entries(layout?.authoredProps || {})) {
    if (pointInCircle(x, z, prop, propClearance[id] || 1.5)) return false;
  }

  return true;
}

export function generateGrassPlacements(
  layout = TOWN_LAYOUT,
  { count = GRASS_QUALITY_COUNTS.high, seed = DEFAULT_SEED } = {},
) {
  const target = Math.max(0, Math.floor(Number(count) || 0));
  if (target === 0) return [];

  const random = seededRandom(seed);
  const placements = [];
  const sampleRadius = Math.max(0, (Number(layout?.meadowRadius) || 0) - 2.25);
  const initialSolitaryCount = target >= CLUSTER_MIN_SIZE
    ? Math.round(target * SOLITARY_RATIO)
    : target;
  let solitaryCount = initialSolitaryCount;
  let clusteredCount = target - solitaryCount;
  let clusterSizes = createClusterSizes(clusteredCount, random);
  while (!clusterSizes && solitaryCount > 0) {
    solitaryCount -= 1;
    clusteredCount += 1;
    clusterSizes = createClusterSizes(clusteredCount, random);
  }

  const clusters = [];
  const clusterAttemptLimit = Math.max(1200, target * 8);
  for (const size of clusterSizes || []) {
    let cluster = null;
    for (let attempt = 0; attempt < clusterAttemptLimit && !cluster; attempt += 1) {
      const center = sampleMeadowPoint(random, sampleRadius);
      const radius = CLUSTER_MIN_RADIUS
        + random() * (CLUSTER_MAX_RADIUS - CLUSTER_MIN_RADIUS);
      if (!clusterClearsExisting(center, radius, clusters)) continue;
      const origins = createClusterOrigins(center, radius, size, random);
      if (!origins.every((origin) => isGrassPlacementAllowed(origin.x, origin.z, layout))) {
        continue;
      }
      cluster = { ...center, radius, origins };
    }
    if (!cluster) break;
    clusters.push(cluster);
    for (const origin of cluster.origins) {
      placements.push(createPlacement(origin.x, origin.z, random));
    }
  }

  const solitaryAttemptLimit = Math.max(2400, target * 120);
  for (
    let attempt = 0;
    placements.length < target && attempt < solitaryAttemptLimit;
    attempt += 1
  ) {
    const origin = sampleMeadowPoint(random, sampleRadius);
    if (!isGrassPlacementAllowed(origin.x, origin.z, layout)) continue;
    if (!originClearsPlacements(origin, placements, SOLITARY_SEPARATION)) continue;
    placements.push(createPlacement(origin.x, origin.z, random));
  }

  if (placements.length !== target) {
    throw new Error(
      `[BreathingGrass] Meadow mask yielded ${placements.length}/${target} placements`,
    );
  }
  return placements;
}

export function createGrassTuftGeometry() {
  const positions = [];
  const indices = [];
  const bladeData = [
    { yaw: 0, height: 0.45, width: 0.083, offset: 0.025, curve: 0.028 },
    { yaw: Math.PI * 0.67, height: 0.37, width: 0.074, offset: 0.032, curve: -0.021 },
    { yaw: Math.PI * 1.34, height: 0.42, width: 0.078, offset: 0.028, curve: 0.018 },
  ];

  for (const blade of bladeData) {
    const rightX = Math.cos(blade.yaw);
    const rightZ = Math.sin(blade.yaw);
    const forwardX = -rightZ;
    const forwardZ = rightX;
    const centerX = forwardX * blade.offset;
    const centerZ = forwardZ * blade.offset;
    const base = positions.length / 3;
    const halfWidth = blade.width * 0.5;
    const midWidth = halfWidth * 0.62;
    const midX = centerX + forwardX * blade.curve * 0.35;
    const midZ = centerZ + forwardZ * blade.curve * 0.35;
    const tipX = centerX + forwardX * blade.curve;
    const tipZ = centerZ + forwardZ * blade.curve;

    positions.push(
      centerX - rightX * halfWidth, 0, centerZ - rightZ * halfWidth,
      centerX + rightX * halfWidth, 0, centerZ + rightZ * halfWidth,
      midX - rightX * midWidth, blade.height * 0.56, midZ - rightZ * midWidth,
      midX + rightX * midWidth, blade.height * 0.56, midZ + rightZ * midWidth,
      tipX, blade.height, tipZ,
    );
    indices.push(
      base, base + 1, base + 2,
      base + 1, base + 3, base + 2,
      base + 2, base + 3, base + 4,
    );
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.bladeCount = bladeData.length;
  geometry.userData.trianglesPerTuft = indices.length / 3;
  return geometry;
}

export function injectBreathingGrassShader(shader, uniforms) {
  shader.uniforms.uGrassTime = uniforms.uGrassTime;
  shader.uniforms.uGrassMotion = uniforms.uGrassMotion;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>${SHADER_DECLARATIONS}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>${SHADER_TRANSFORM}`);
  return shader;
}

function createGrassMaterial(uniforms) {
  // A neutral base preserves the authored instance greens exactly. Thin
  // vertical planes stay readable from every yaw without a lighting pass.
  const material = new MeshBasicMaterial({
    color: 0xffffff,
    side: DoubleSide,
    // InstancedMesh enables USE_INSTANCING_COLOR from instanceColor. Setting
    // vertexColors here would also request a missing per-vertex `color`
    // attribute, multiplying every instance to black in the real renderer.
    vertexColors: false,
  });
  material.name = 'breathing_grass_material';
  material.userData.grassUniforms = uniforms;
  material.userData.shaderContract = 'breathing-grass-v1';
  material.onBeforeCompile = (shader) => injectBreathingGrassShader(shader, uniforms);
  material.customProgramCacheKey = () => 'breathing-grass-v1';
  return material;
}

/** One static instanced mesh animated only by a shared vertex uniform. */
export class BreathingGrass {
  constructor({
    animator = null,
    layout = TOWN_LAYOUT,
    quality = 'high',
    reducedMotion = false,
    seed = DEFAULT_SEED,
  } = {}) {
    this.animator = animator;
    this.layout = layout;
    this.quality = normalizeGrassQuality(quality);
    this.reducedMotion = Boolean(reducedMotion);
    this.seed = seed;
    this.count = GRASS_QUALITY_COUNTS[this.quality];
    this.drawCallCount = 1;
    this.disposed = false;
    this.uniforms = {
      uGrassTime: { value: 0 },
      uGrassMotion: { value: this.reducedMotion ? 0 : 1 },
    };
    this.placements = generateGrassPlacements(layout, {
      count: this.count,
      seed,
    });

    const geometry = createGrassTuftGeometry();
    const material = createGrassMaterial(this.uniforms);
    this.mesh = new InstancedMesh(geometry, material, this.count);
    this.mesh.name = 'particle_grass_tufts';
    this.mesh.userData.cameraCollision = false;
    this.mesh.userData.physicsCollision = false;
    this.mesh.userData.decorative = true;
    this.mesh.userData.system = 'breathing-grass-v1';
    this.mesh.userData.quality = this.quality;
    this.mesh.userData.seed = seed;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.instanceMatrix.setUsage(StaticDrawUsage);

    const dummy = new Object3D();
    for (let index = 0; index < this.placements.length; index += 1) {
      const placement = this.placements[index];
      dummy.position.set(placement.x, placement.y, placement.z);
      dummy.rotation.set(0, placement.yaw, 0);
      dummy.scale.set(placement.scaleX, placement.scaleY, placement.scaleZ);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(index, dummy.matrix);
      this.mesh.setColorAt(index, GRASS_COLORS[placement.tone]);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.computeBoundingBox();
    this.mesh.computeBoundingSphere();

    this._animation = null;
    if (!this.reducedMotion && typeof animator?.add === 'function') {
      this._animation = animator.add((time) => this.setTime(time));
    }
  }

  setTime(time) {
    this.uniforms.uGrassTime.value = this.reducedMotion ? 0 : wrapGrassTime(time);
    return this.uniforms.uGrassTime.value;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this._animation) this.animator?.remove?.(this._animation);
    this._animation = null;
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

export function createBreathingGrass(options) {
  return new BreathingGrass(options);
}

export default BreathingGrass;
