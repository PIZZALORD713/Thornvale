import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import { OBJECTIVE_HINT_DURATION } from '../config/objective-hints.js';
import { TOWN_LAYOUT } from '../config/town.js';
import { sampleMoundHeight } from '../utils/terrain-surface.js';

const UP = new Vector3(0, 1, 0);

export const OBJECTIVE_HINT_TRAIL_DEFAULTS = Object.freeze({
  duration: OBJECTIVE_HINT_DURATION,
  spacing: 0.8,
  maxMarkers: 30,
  // Surface projection plus this normal offset clears the reclaimed pavers
  // without making the ribbon read as a floating rail.
  groundOffset: 0.13,
});

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizePoint(value) {
  if (Array.isArray(value)) {
    const x = Number(value[0]);
    const y = value.length >= 3 ? Number(value[1]) : 0;
    const z = Number(value.length >= 3 ? value[2] : value[1]);
    return [x, y, z].every(Number.isFinite) ? new Vector3(x, y, z) : null;
  }
  if (!value || typeof value !== 'object') return null;
  const x = Number(value.x);
  const y = value.y === undefined ? 0 : Number(value.y);
  const z = Number(value.z);
  return [x, y, z].every(Number.isFinite) ? new Vector3(x, y, z) : null;
}

function sanitizePoints(values) {
  if (!Array.isArray(values)) return null;
  const result = [];
  for (const value of values) {
    const point = normalizePoint(value);
    if (!point) return null;
    if (!result.length || result.at(-1).distanceToSquared(point) > 1e-8) result.push(point);
  }
  return result.length >= 2 ? result : null;
}

function measurePolyline(points) {
  const lengths = [];
  let total = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const length = points[index].distanceTo(points[index + 1]);
    lengths.push(length);
    total += length;
  }
  return { lengths, total };
}

function samplePolyline(points, lengths, distance, target) {
  let remaining = Math.max(0, distance);
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index];
    if (remaining <= length || index === lengths.length - 1) {
      return target.copy(points[index]).lerp(
        points[index + 1],
        length > 1e-8 ? Math.min(1, remaining / length) : 0,
      );
    }
    remaining -= length;
  }
  return target.copy(points.at(-1));
}

function pointInsideMound(mound, x, z) {
  if (!mound) return false;
  const radiusX = Math.max(0.001, Number(mound.radiusX) || 1);
  const radiusZ = Math.max(0.001, Number(mound.radiusZ) || 1);
  const dx = (x - (Number(mound.x) || 0)) / radiusX;
  const dz = (z - (Number(mound.z) || 0)) / radiusZ;
  return dx * dx + dz * dz <= 1;
}

function sampleTownSurface(x, z, fallbackY = 0) {
  const mound = TOWN_LAYOUT.terrain?.bellHill;
  if (!pointInsideMound(mound, x, z)) return Number(fallbackY) || 0;
  return Math.max(0, sampleMoundHeight(mound, x, z));
}

function sampleTownSurfaceNormal(x, z) {
  const mound = TOWN_LAYOUT.terrain?.bellHill;
  if (!pointInsideMound(mound, x, z)) return UP.clone();
  const epsilon = 0.2;
  const left = sampleTownSurface(x - epsilon, z, 0);
  const right = sampleTownSurface(x + epsilon, z, 0);
  const back = sampleTownSurface(x, z - epsilon, 0);
  const front = sampleTownSurface(x, z + epsilon, 0);
  return new Vector3(left - right, epsilon * 2, back - front).normalize();
}

function orientationForDirection(direction, normal) {
  const surfaceUp = normal.clone().normalize();
  const forward = direction.clone().addScaledVector(
    surfaceUp,
    -direction.dot(surfaceUp),
  ).normalize();
  if (forward.lengthSq() < 0.001) forward.set(0, 0, 1);
  const right = new Vector3().crossVectors(surfaceUp, forward).normalize();
  if (right.lengthSq() < 0.001) right.set(1, 0, 0);
  forward.crossVectors(right, surfaceUp).normalize();
  return new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(right, surfaceUp, forward),
  );
}

/**
 * Temporary projection for an already resolved objective path.
 *
 * This owns one instanced draw and no gameplay state, collision geometry,
 * timers, or route authority. Callers decide when a cue is allowed to appear.
 */
export class ObjectiveHintTrail {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.reducedMotion = Boolean(options.reducedMotion);
    this.duration = positiveNumber(options.duration, OBJECTIVE_HINT_TRAIL_DEFAULTS.duration);
    this.spacing = positiveNumber(options.spacing, OBJECTIVE_HINT_TRAIL_DEFAULTS.spacing);
    this.maxMarkers = Math.min(
      64,
      Math.max(
        2,
        Math.floor(positiveNumber(options.maxMarkers, OBJECTIVE_HINT_TRAIL_DEFAULTS.maxMarkers)),
      ),
    );
    this.groundOffset = positiveNumber(
      options.groundOffset,
      OBJECTIVE_HINT_TRAIL_DEFAULTS.groundOffset,
    );

    this.root = null;
    this.mesh = null;
    this.geometry = null;
    this.material = null;
    this.initialized = false;
    this.disposed = false;
    this.active = false;
    this.elapsed = 0;
    this.activeDuration = this.duration;
    this.cueId = null;
    this._markers = [];
    this._dummy = new Object3D();
  }

  init() {
    if (this.initialized) return this;
    if (this.disposed) throw new Error('ObjectiveHintTrail has been disposed');
    if (!this.scene?.add) throw new Error('ObjectiveHintTrail requires a Three.js scene');

    this.root = new Group();
    this.root.name = 'objective_hint_trail';
    this.root.userData.cameraCollision = false;
    this.root.userData.physicsCollision = false;

    this.geometry = new BoxGeometry(0.22, 0.03, 0.46, 1, 1, 1);
    this.material = new MeshStandardMaterial({
      color: 0xffffcf,
      emissive: new Color(0xffa75f),
      emissiveIntensity: 1.7,
      roughness: 0.52,
      metalness: 0,
      transparent: true,
      opacity: 0.92,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.mesh = new InstancedMesh(this.geometry, this.material, this.maxMarkers);
    this.mesh.name = 'objective_hint_markers';
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.userData.cameraCollision = false;
    this.mesh.userData.physicsCollision = false;
    this.mesh.userData.projectionRole = 'objective-hint';
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.root.add(this.mesh);
    this.scene.add(this.root);
    this.initialized = true;
    return this;
  }

  show({ points, duration = this.duration, cueId = null } = {}) {
    if (this.disposed) return false;
    if (!this.initialized) this.init();
    const route = sanitizePoints(points);
    const activeDuration = Number(duration);
    if (!route || !Number.isFinite(activeDuration) || activeDuration <= 0) {
      this.hide();
      return false;
    }

    const { lengths, total } = measurePolyline(route);
    if (!Number.isFinite(total) || total < 0.15) {
      this.hide();
      return false;
    }

    const markerCount = Math.min(
      this.maxMarkers,
      Math.max(2, Math.floor(total / this.spacing) + 1),
    );
    const sample = new Vector3();
    const before = new Vector3();
    const after = new Vector3();
    this._markers.length = 0;
    for (let index = 0; index < markerCount; index += 1) {
      const distance = (index / (markerCount - 1)) * total;
      samplePolyline(route, lengths, distance, sample);
      samplePolyline(route, lengths, Math.max(0, distance - 0.05), before);
      samplePolyline(route, lengths, Math.min(total, distance + 0.05), after);
      const dx = after.x - before.x;
      const dz = after.z - before.z;
      sample.y = sampleTownSurface(sample.x, sample.z, sample.y);
      const normal = sampleTownSurfaceNormal(sample.x, sample.z);
      this._markers.push({
        position: sample.clone(),
        normal,
        orientation: orientationForDirection(
          Math.abs(dx) + Math.abs(dz) > 1e-8
            ? new Vector3(dx, 0, dz).normalize()
            : new Vector3(0, 0, 1),
          normal,
        ),
      });
    }

    this.active = true;
    this.elapsed = 0;
    this.activeDuration = activeDuration;
    this.cueId = cueId === null || cueId === undefined ? null : String(cueId);
    this.mesh.userData.cueId = this.cueId;
    this.mesh.count = markerCount;
    this.mesh.visible = true;
    this._writeMatrices();
    return true;
  }

  _writeMatrices() {
    if (!this.mesh) return;
    for (let index = 0; index < this._markers.length; index += 1) {
      const marker = this._markers[index];
      const wave = this.reducedMotion
        ? 0
        : Math.sin(this.elapsed * 2.2 + index * 0.68);
      const scale = this.reducedMotion ? 1 : 0.97 + wave * 0.03;
      const pulseLift = this.reducedMotion ? 0 : (wave + 1) * 0.006;
      this._dummy.position.copy(marker.position).addScaledVector(
        marker.normal,
        this.groundOffset + pulseLift,
      );
      this._dummy.quaternion.copy(marker.orientation);
      this._dummy.scale.set(scale, scale, scale);
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(index, this._dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt) {
    if (!this.active || !this.mesh) return false;
    const delta = Number(dt);
    if (Number.isFinite(delta) && delta > 0) this.elapsed += delta;
    if (this.elapsed + 1e-9 >= this.activeDuration) {
      this.hide();
      return false;
    }
    if (!this.reducedMotion) this._writeMatrices();
    return true;
  }

  hide() {
    this.active = false;
    this.elapsed = 0;
    this.cueId = null;
    this._markers.length = 0;
    if (this.mesh) {
      this.mesh.count = 0;
      this.mesh.visible = false;
      this.mesh.userData.cueId = null;
    }
    return this;
  }

  dispose() {
    if (this.disposed) return;
    this.hide();
    this.root?.parent?.remove(this.root);
    this.geometry?.dispose();
    this.material?.dispose();
    this.scene = null;
    this.mesh = null;
    this.geometry = null;
    this.material = null;
    this.root = null;
    this.initialized = false;
    this.disposed = true;
  }
}
