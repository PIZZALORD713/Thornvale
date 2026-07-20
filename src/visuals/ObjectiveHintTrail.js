import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import { OBJECTIVE_HINT_DURATION } from '../config/objective-hints.js';

export const OBJECTIVE_HINT_TRAIL_DEFAULTS = Object.freeze({
  duration: OBJECTIVE_HINT_DURATION,
  spacing: 0.8,
  maxMarkers: 30,
  groundOffset: 0.08,
  targetStopDistance: 2.4,
  retargetSharpness: 4,
  targetLeash: 2.5,
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

export function splitObjectiveHintApproach(values, stopDistance) {
  const points = sanitizePoints(values);
  const distance = Number(stopDistance);
  if (!points || !Number.isFinite(distance) || distance < 0) return null;
  const { lengths, total } = measurePolyline(points);
  if (total <= distance + 0.15) return null;
  if (distance <= 1e-8) {
    return {
      route: points.map((point) => point.clone()),
      handoff: points.at(-1).clone(),
      target: points.at(-1).clone(),
    };
  }

  const handoffDistance = total - distance;
  const handoff = samplePolyline(points, lengths, handoffDistance, new Vector3()).clone();
  const route = [points[0].clone()];
  let walked = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const nextDistance = walked + lengths[index];
    if (nextDistance < handoffDistance - 1e-9) route.push(points[index + 1].clone());
    else break;
    walked = nextDistance;
  }
  if (route.at(-1).distanceToSquared(handoff) > 1e-8) route.push(handoff.clone());
  return { route, handoff, target: points.at(-1).clone() };
}

function sampleMarkers(points, count) {
  const { lengths, total } = measurePolyline(points);
  const sample = new Vector3();
  const before = new Vector3();
  const after = new Vector3();
  const markers = [];
  for (let index = 0; index < count; index += 1) {
    const distance = count === 1 ? total : (index / (count - 1)) * total;
    samplePolyline(points, lengths, distance, sample);
    samplePolyline(points, lengths, Math.max(0, distance - 0.05), before);
    samplePolyline(points, lengths, Math.min(total, distance + 0.05), after);
    const dx = after.x - before.x;
    const dz = after.z - before.z;
    markers.push({
      position: sample.clone(),
      yaw: Math.abs(dx) + Math.abs(dz) > 1e-8 ? Math.atan2(dx, dz) : 0,
    });
  }
  return markers;
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
    this.targetStopDistance = positiveNumber(
      options.targetStopDistance,
      OBJECTIVE_HINT_TRAIL_DEFAULTS.targetStopDistance,
    );
    this.retargetSharpness = positiveNumber(
      options.retargetSharpness,
      OBJECTIVE_HINT_TRAIL_DEFAULTS.retargetSharpness,
    );
    this.targetLeash = positiveNumber(
      options.targetLeash,
      OBJECTIVE_HINT_TRAIL_DEFAULTS.targetLeash,
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
    this._routeMarkers = [];
    this._connectorMarkers = [];
    this._getTargetPosition = null;
    this._handoff = null;
    this._validatedTarget = null;
    this._smoothedTarget = null;
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

    this.geometry = new BoxGeometry(0.16, 0.025, 0.36, 1, 1, 1);
    this.material = new MeshStandardMaterial({
      color: 0xffd99a,
      emissive: new Color(0xffa85f),
      emissiveIntensity: 1.25,
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

  show({
    points,
    duration = this.duration,
    cueId = null,
    getTargetPosition = null,
    connectToTarget = Boolean(getTargetPosition),
    targetLeash = this.targetLeash,
  } = {}) {
    if (this.disposed) return false;
    if (!this.initialized) this.init();
    const route = sanitizePoints(points);
    const activeDuration = Number(duration);
    if (!route || !Number.isFinite(activeDuration) || activeDuration <= 0) {
      this.hide();
      return false;
    }

    const { total } = measurePolyline(route);
    if (!Number.isFinite(total) || total < 0.15) {
      this.hide();
      return false;
    }

    const initialLiveTarget = connectToTarget && typeof getTargetPosition === 'function'
      ? normalizePoint(getTargetPosition())
      : null;
    if (initialLiveTarget) initialLiveTarget.y = route.at(-1).y;
    const endpointGap = initialLiveTarget ? route.at(-1).distanceTo(initialLiveTarget) : Infinity;
    const trimDistance = Math.max(0, this.targetStopDistance - endpointGap);
    const approach = initialLiveTarget && endpointGap <= positiveNumber(targetLeash, this.targetLeash)
      ? splitObjectiveHintApproach(route, trimDistance)
      : null;
    const routePoints = approach?.route || route;
    const routeTotal = measurePolyline(routePoints).total;
    const connectorCount = approach ? 3 : 0;
    const markerCount = Math.min(
      this.maxMarkers - connectorCount,
      Math.max(2, Math.floor(routeTotal / this.spacing) + 1),
    );
    this._routeMarkers = sampleMarkers(routePoints, markerCount);
    this._connectorMarkers = [];
    this._getTargetPosition = approach ? getTargetPosition : null;
    this._handoff = approach?.handoff || null;
    this._validatedTarget = approach ? initialLiveTarget.clone() : null;
    this._smoothedTarget = approach ? initialLiveTarget.clone() : null;
    this._targetLeash = positiveNumber(targetLeash, this.targetLeash);
    if (approach) this._refreshConnector(0, true);

    this._markers = [...this._routeMarkers, ...this._connectorMarkers].slice(0, this.maxMarkers);
    const activeMarkerCount = this._markers.length;

    this.active = true;
    this.elapsed = 0;
    this.activeDuration = activeDuration;
    this.cueId = cueId === null || cueId === undefined ? null : String(cueId);
    this.mesh.userData.cueId = this.cueId;
    this.mesh.count = activeMarkerCount;
    this.mesh.visible = true;
    this._writeMatrices();
    return true;
  }

  _refreshConnector(dt, immediate = false) {
    if (!this._getTargetPosition || !this._handoff || !this._smoothedTarget) return;
    const candidate = normalizePoint(this._getTargetPosition());
    if (candidate) {
      candidate.y = this._validatedTarget.y;
      if (candidate.distanceTo(this._validatedTarget) <= this._targetLeash + 1e-6) {
        const alpha = immediate ? 1 : 1 - Math.exp(-this.retargetSharpness * Math.max(0, dt));
        this._smoothedTarget.lerp(candidate, alpha);
      }
    }
    this._connectorMarkers = sampleMarkers([this._handoff, this._smoothedTarget], 3);
  }

  _writeMatrices() {
    if (!this.mesh) return;
    for (let index = 0; index < this._markers.length; index += 1) {
      const marker = this._markers[index];
      const wave = this.reducedMotion
        ? 0
        : Math.sin(this.elapsed * 2.2 + index * 0.68);
      const scale = this.reducedMotion ? 1 : 0.97 + wave * 0.03;
      this._dummy.position.copy(marker.position);
      this._dummy.position.y += this.groundOffset + (this.reducedMotion ? 0 : wave * 0.012);
      this._dummy.rotation.set(0, marker.yaw, 0);
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
    if (this._getTargetPosition) {
      this._refreshConnector(Number.isFinite(delta) && delta > 0 ? delta : 0);
      this._markers = [...this._routeMarkers, ...this._connectorMarkers].slice(0, this.maxMarkers);
      this.mesh.count = this._markers.length;
    }
    if (!this.reducedMotion || this._getTargetPosition) this._writeMatrices();
    return true;
  }

  hide() {
    this.active = false;
    this.elapsed = 0;
    this.cueId = null;
    this._markers.length = 0;
    this._routeMarkers.length = 0;
    this._connectorMarkers.length = 0;
    this._getTargetPosition = null;
    this._handoff = null;
    this._validatedTarget = null;
    this._smoothedTarget = null;
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
