import {
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  MathUtils,
  MeshBasicMaterial,
  Object3D,
} from 'three';
import { TOWN_LAYOUT } from '../config/town.js';

export const DRAGONFLY_QUALITY_COUNTS = Object.freeze({
  low: 2,
  medium: 3,
  high: 3,
});

export const DRAGONFLY_SYSTEM_ID = 'pond-garden-dragonflies-v1';
export const DRAGONFLY_WING_OPACITY = 0.41;
export const DRAGONFLY_FADE_START = 0.30;
export const DRAGONFLY_FADE_END = 0.65;

const BODY_INK = 0x315b4a;
const BODY_MOSS = 0x55766a;
const WING_CELADON = 0xd4e2da;
const MAX_PITCH = MathUtils.degToRad(8);
const MAX_ROLL = MathUtils.degToRad(6);

const FLIGHT_TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'pond-east-dragonfly',
    anchor: (layout) => [layout.pond.x + 2.45, 0.85, layout.pond.z - 1.05],
    stationOffsets: Object.freeze([
      Object.freeze([0, 0.02, 0.68]),
      Object.freeze([-0.72, 0.07, 0.18]),
      Object.freeze([0.48, -0.01, -0.62]),
    ]),
    holdDurations: Object.freeze([3.0, 3.1, 3.0]),
    dartDurations: Object.freeze([0.36, 0.38, 0.36]),
    phaseOffset: 0.37,
    hoverPhase: 0.2,
  }),
  Object.freeze({
    id: 'pond-west-dragonfly',
    anchor: (layout) => [layout.pond.x - 1.35, 0.72, layout.pond.z + 0.85],
    stationOffsets: Object.freeze([
      Object.freeze([0.64, 0.02, -0.22]),
      Object.freeze([-0.34, 0.06, -0.70]),
      Object.freeze([-0.74, 0, 0.25]),
    ]),
    holdDurations: Object.freeze([3.35, 3.25, 3.45]),
    dartDurations: Object.freeze([0.40, 0.42, 0.40]),
    phaseOffset: 3.19,
    hoverPhase: 1.7,
  }),
  Object.freeze({
    id: 'garden-arch-dragonfly',
    anchor: (layout) => [
      layout.authoredProps.gardenArch.x + 0.75,
      1,
      layout.authoredProps.gardenArch.z + 0.55,
    ],
    stationOffsets: Object.freeze([
      Object.freeze([-0.65, 0.03, 0.18]),
      Object.freeze([0.20, 0.07, 0.72]),
      Object.freeze([0.76, -0.02, -0.16]),
    ]),
    holdDurations: Object.freeze([3.70, 3.55, 3.65]),
    dartDurations: Object.freeze([0.46, 0.44, 0.48]),
    phaseOffset: 6.11,
    hoverPhase: 3.4,
  }),
]);

function finiteTime(value) {
  return Number.isFinite(value) ? value : 0;
}

function positiveModulo(value, modulus) {
  if (!Number.isFinite(modulus) || modulus <= 0) return 0;
  return ((finiteTime(value) % modulus) + modulus) % modulus;
}

function smoothstep01(value) {
  const t = MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function addTriangle(positions, colors, first, second, third, color) {
  const tint = new Color(color);
  for (const point of [first, second, third]) {
    positions.push(point[0], point[1], point[2]);
    if (colors) colors.push(tint.r, tint.g, tint.b);
  }
}

function addFacetedPrism(positions, colors, {
  startZ,
  endZ,
  startRadius,
  endRadius,
  sides,
  color,
}) {
  const start = [];
  const end = [];
  for (let index = 0; index < sides; index += 1) {
    const angle = (index / sides) * Math.PI * 2 + Math.PI / sides;
    start.push([Math.cos(angle) * startRadius, Math.sin(angle) * startRadius, startZ]);
    end.push([Math.cos(angle) * endRadius, Math.sin(angle) * endRadius, endZ]);
  }
  for (let index = 0; index < sides; index += 1) {
    const next = (index + 1) % sides;
    addTriangle(positions, colors, start[index], end[index], end[next], color);
    addTriangle(positions, colors, start[index], end[next], start[next], color);
    addTriangle(positions, colors, [0, 0, startZ], start[next], start[index], color);
    addTriangle(positions, colors, [0, 0, endZ], end[index], end[next], color);
  }
}

function addFacetedNode(positions, colors, centerZ, radiusX, radiusY, radiusZ, color) {
  const top = [0, radiusY, centerZ];
  const bottom = [0, -radiusY, centerZ];
  const east = [radiusX, 0, centerZ];
  const west = [-radiusX, 0, centerZ];
  const front = [0, 0, centerZ + radiusZ];
  const back = [0, 0, centerZ - radiusZ];
  for (const triangle of [
    [top, front, east], [top, west, front],
    [top, back, west], [top, east, back],
    [bottom, east, front], [bottom, front, west],
    [bottom, west, back], [bottom, back, east],
  ]) {
    addTriangle(positions, colors, triangle[0], triangle[1], triangle[2], color);
  }
}

/** Code-native faceted body with a 0.39 metre needle silhouette. */
export function createDragonflyBodyGeometry() {
  const positions = [];
  const colors = [];
  addFacetedPrism(positions, colors, {
    startZ: -0.195,
    endZ: 0.072,
    startRadius: 0.006,
    endRadius: 0.024,
    sides: 6,
    color: BODY_INK,
  });
  addFacetedNode(positions, colors, 0.098, 0.045, 0.035, 0.048, BODY_MOSS);
  addFacetedNode(positions, colors, 0.165, 0.032, 0.029, 0.030, BODY_MOSS);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.system = DRAGONFLY_SYSTEM_ID;
  geometry.userData.silhouette = 'faceted-needle-abdomen-thorax-head';
  geometry.userData.bodyLength = 0.39;
  return geometry;
}

function addKite(positions, wingIds, id, points) {
  for (const vertex of [points[0], points[1], points[2], points[0], points[2], points[3]]) {
    positions.push(vertex[0], vertex[1], vertex[2]);
    wingIds.push(id);
  }
}

/** Four tapered kites: 0.46m fore span and 0.38m hind span. */
export function createDragonflyWingGeometry() {
  const positions = [];
  const wingIds = [];
  addKite(positions, wingIds, 0, [
    [-0.025, 0.008, 0.110], [-0.140, 0.008, 0.150],
    [-0.230, 0.008, 0.075], [-0.130, 0.008, 0.025],
  ]);
  addKite(positions, wingIds, 1, [
    [0.025, 0.008, 0.110], [0.140, 0.008, 0.150],
    [0.230, 0.008, 0.075], [0.130, 0.008, 0.025],
  ]);
  addKite(positions, wingIds, 2, [
    [-0.024, -0.002, 0.055], [-0.115, -0.002, 0.070],
    [-0.190, -0.002, -0.030], [-0.095, -0.002, -0.080],
  ]);
  addKite(positions, wingIds, 3, [
    [0.024, -0.002, 0.055], [0.115, -0.002, 0.070],
    [0.190, -0.002, -0.030], [0.095, -0.002, -0.080],
  ]);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('wingId', new Float32BufferAttribute(wingIds, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.system = DRAGONFLY_SYSTEM_ID;
  geometry.userData.wingShape = 'four-kite';
  geometry.userData.wingCount = 4;
  geometry.userData.foreSpan = 0.46;
  geometry.userData.hindSpan = 0.38;
  return geometry;
}

export function normalizeDragonflyQuality(value) {
  const quality = String(value || '').toLowerCase();
  return Object.hasOwn(DRAGONFLY_QUALITY_COUNTS, quality) ? quality : 'high';
}

export function createDragonflySpecs(layout = TOWN_LAYOUT) {
  return FLIGHT_TEMPLATES.map((template) => {
    const anchor = template.anchor(layout);
    const stations = template.stationOffsets.map((offset) => [
      anchor[0] + offset[0],
      anchor[1] + offset[1],
      anchor[2] + offset[2],
    ]);
    const cycleDuration = template.holdDurations.reduce((sum, value) => sum + value, 0)
      + template.dartDurations.reduce((sum, value) => sum + value, 0);
    return Object.freeze({
      id: template.id,
      anchor: Object.freeze(anchor),
      stations: Object.freeze(stations.map((station) => Object.freeze(station))),
      holdDurations: template.holdDurations,
      dartDurations: template.dartDurations,
      phaseOffset: template.phaseOffset,
      hoverPhase: template.hoverPhase,
      cycleDuration,
    });
  });
}

export function selectDragonflySpecs(specs, quality = 'high') {
  const normalized = normalizeDragonflyQuality(quality);
  if (normalized !== 'low') return specs.slice(0, DRAGONFLY_QUALITY_COUNTS[normalized]);
  return [specs[0], specs[2]].filter(Boolean);
}

function directionYaw(from, to) {
  return Math.atan2(to[0] - from[0], to[2] - from[2]);
}

/**
 * Pure absolute-time projection. No prior frame or accumulated delta is read.
 */
export function projectDragonflyPose(spec, time, { reducedMotion = false } = {}) {
  if (reducedMotion) {
    return {
      position: [...spec.stations[0]],
      velocity: [0, 0, 0],
      yaw: directionYaw(spec.stations[0], spec.stations[1]),
      pitch: 0,
      roll: 0,
      segment: 'hold',
      stationIndex: 0,
      cycleTime: 0,
    };
  }

  const safeTime = finiteTime(time);
  const cycleTime = positiveModulo(safeTime + spec.phaseOffset, spec.cycleDuration);
  let cursor = 0;
  for (let stationIndex = 0; stationIndex < spec.stations.length; stationIndex += 1) {
    const from = spec.stations[stationIndex];
    const nextIndex = (stationIndex + 1) % spec.stations.length;
    const to = spec.stations[nextIndex];
    const holdDuration = spec.holdDurations[stationIndex];
    if (cycleTime <= cursor + holdDuration) {
      const local = MathUtils.clamp((cycleTime - cursor) / holdDuration, 0, 1);
      const driftEnvelope = Math.sin(local * Math.PI) ** 2;
      const driftTime = safeTime + spec.hoverPhase;
      const drift = [
        Math.sin(driftTime * 1.31) * 0.008 * driftEnvelope,
        Math.sin(driftTime * 1.73 + 0.8) * 0.018 * driftEnvelope,
        Math.cos(driftTime * 1.11 + 0.35) * 0.007 * driftEnvelope,
      ];
      return {
        position: [from[0] + drift[0], from[1] + drift[1], from[2] + drift[2]],
        velocity: [0, 0, 0],
        yaw: directionYaw(from, to),
        pitch: 0,
        roll: 0,
        segment: 'hold',
        stationIndex,
        cycleTime,
      };
    }
    cursor += holdDuration;

    const dartDuration = spec.dartDurations[stationIndex];
    if (cycleTime <= cursor + dartDuration) {
      const local = MathUtils.clamp((cycleTime - cursor) / dartDuration, 0, 1);
      const eased = smoothstep01(local);
      const derivative = (6 * local * (1 - local)) / dartDuration;
      const delta = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
      const velocity = delta.map((component) => component * derivative);
      const horizontalDistance = Math.hypot(delta[0], delta[2]);
      return {
        position: delta.map((component, axis) => from[axis] + component * eased),
        velocity,
        yaw: Math.atan2(delta[0], delta[2]),
        pitch: MathUtils.clamp(
          Math.atan2(delta[1], Math.max(horizontalDistance, 1e-9)),
          -MAX_PITCH,
          MAX_PITCH,
        ),
        roll: Math.sign(delta[0] || 1) * Math.sin(local * Math.PI) * MAX_ROLL,
        segment: 'dart',
        stationIndex,
        cycleTime,
      };
    }
    cursor += dartDuration;
  }

  return projectDragonflyPose(spec, 0);
}

export function dragonflyNightFade(nightMix) {
  const mix = MathUtils.clamp(Number.isFinite(nightMix) ? nightMix : 0, 0, 1);
  if (mix <= DRAGONFLY_FADE_START) return 1;
  if (mix >= DRAGONFLY_FADE_END) return 0;
  const progress = (mix - DRAGONFLY_FADE_START)
    / (DRAGONFLY_FADE_END - DRAGONFLY_FADE_START);
  return 1 - smoothstep01(progress);
}

function markDecorative(object) {
  object.userData.system = DRAGONFLY_SYSTEM_ID;
  object.userData.decorative = true;
  object.userData.cameraCollision = false;
  object.userData.physicsCollision = false;
  return object;
}

export class DragonflyField {
  constructor({
    animator = null,
    layout = TOWN_LAYOUT,
    quality = 'high',
    reducedMotion = false,
  } = {}) {
    this.animator = animator;
    this.layout = layout;
    this.quality = normalizeDragonflyQuality(quality);
    this.reducedMotion = Boolean(reducedMotion);
    this.specs = selectDragonflySpecs(createDragonflySpecs(layout), this.quality);
    this.count = this.specs.length;
    this.drawCallCount = 2;
    this.disposed = false;
    this._dummy = new Object3D();
    this._dummy.rotation.order = 'YXZ';

    this.root = markDecorative(new Group());
    this.root.name = 'particle_butterflies';
    this.root.userData.quality = this.quality;
    this.root.userData.instanceCount = this.count;
    this.root.userData.drawCallCount = this.drawCallCount;
    this.root.userData.legacyInstanceNames = this.specs.map((_, index) => (
      `particle_butterfly_${index}`
    ));

    this.bodyGeometry = createDragonflyBodyGeometry();
    this.wingGeometry = createDragonflyWingGeometry();
    this.bodyMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: false,
      opacity: 1,
      depthWrite: true,
    });
    this.bodyMaterial.name = 'dragonfly_faceted_body_material';
    this.wingMaterial = new MeshBasicMaterial({
      color: WING_CELADON,
      side: DoubleSide,
      transparent: true,
      opacity: DRAGONFLY_WING_OPACITY,
      depthWrite: false,
    });
    this.wingMaterial.name = 'dragonfly_celadon_wing_material';
    this.wingMaterial.forceSinglePass = true;

    this.bodyMesh = markDecorative(new InstancedMesh(
      this.bodyGeometry,
      this.bodyMaterial,
      this.count,
    ));
    this.bodyMesh.name = 'particle_dragonfly_bodies';
    this.wingMesh = markDecorative(new InstancedMesh(
      this.wingGeometry,
      this.wingMaterial,
      this.count,
    ));
    this.wingMesh.name = 'particle_dragonfly_wings';
    for (const mesh of [this.bodyMesh, this.wingMesh]) {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.userData.instanceIds = this.specs.map((spec) => spec.id);
    }
    this.root.add(this.bodyMesh, this.wingMesh);

    this._writeMatrices(0, this.reducedMotion);
    this._applyFade(0);
    this._animation = typeof animator?.add === 'function'
      ? animator.add((time, _dt, state) => this.update(time, state))
      : null;
  }

  _writeMatrices(time, reducedMotion = false) {
    this.specs.forEach((spec, index) => {
      const pose = projectDragonflyPose(spec, time, { reducedMotion });
      this._dummy.position.fromArray(pose.position);
      this._dummy.rotation.set(pose.pitch, pose.yaw, pose.roll, 'YXZ');
      this._dummy.scale.setScalar(1);
      this._dummy.updateMatrix();
      this.bodyMesh.setMatrixAt(index, this._dummy.matrix);
      this.wingMesh.setMatrixAt(index, this._dummy.matrix);
    });
    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.wingMesh.instanceMatrix.needsUpdate = true;
  }

  _applyFade(nightMix) {
    const fade = dragonflyNightFade(nightMix);
    const bodyNeedsBlend = fade > 0 && fade < 1;
    if (this.bodyMaterial.transparent !== bodyNeedsBlend) {
      this.bodyMaterial.transparent = bodyNeedsBlend;
      this.bodyMaterial.needsUpdate = true;
    }
    this.bodyMaterial.opacity = fade;
    this.wingMaterial.opacity = DRAGONFLY_WING_OPACITY * fade;
    this.root.visible = fade > 0;
    return fade;
  }

  update(time = 0, nightState = {}) {
    if (this.disposed) return 0;
    const nightMix = Number.isFinite(nightState?.nightMix)
      ? nightState.nightMix
      : (nightState?.isNight ? 1 : 0);
    const fade = this._applyFade(nightMix);
    if (!this.reducedMotion && fade > 0) this._writeMatrices(finiteTime(time), false);
    return fade;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this._animation) this.animator?.remove?.(this._animation);
    this._animation = null;
    this.root.removeFromParent();
    this.bodyGeometry.dispose();
    this.wingGeometry.dispose();
    this.bodyMaterial.dispose();
    this.wingMaterial.dispose();
  }
}

export function createDragonflyField(options) {
  return new DragonflyField(options);
}

export default DragonflyField;
