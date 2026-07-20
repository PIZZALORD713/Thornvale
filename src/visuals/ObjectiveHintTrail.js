import {
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import { OBJECTIVE_HINT_DURATION } from '../config/objective-hints.js';

export const OBJECTIVE_HINT_TRAIL_DEFAULTS = Object.freeze({
  duration: OBJECTIVE_HINT_DURATION,
  spacing: 0.09,
  maxMarkers: 96,
  targetStopDistance: 2.4,
  retargetSharpness: 4,
  targetLeash: 2.5,
  wakeLength: 4,
});

const WIND_HEIGHTS = Object.freeze({
  pickupDistance: 0.35,
  riseDistance: 2,
  pickup: Object.freeze({ bodyBase: 0.12, bodyRange: 0.16, leaderHeight: 0.26, curl: 0.02 }),
  stream: Object.freeze({ bodyBase: 1.05, bodyRange: 0.26, leaderHeight: 1.5, curl: 0.04 }),
  handoff: Object.freeze({ bodyBase: 0.74, bodyRange: 0.34, leaderHeight: 1.12, curl: 0.03 }),
});

const WIND_COLORS = Object.freeze({
  ivory: new Color(0xf2ead5),
  sage: new Color(0x879b78),
  gold: new Color(0xf2c56f),
});

function createWindParticleGeometry(count) {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(new Float32Array(count * 3), 3).setUsage(DynamicDrawUsage),
  );
  geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aSize', new Float32BufferAttribute(new Float32Array(count), 1));
  geometry.setAttribute(
    'aOpacity',
    new Float32BufferAttribute(new Float32Array(count), 1).setUsage(DynamicDrawUsage),
  );
  geometry.setDrawRange(0, 0);
  return geometry;
}

function createWindParticleMaterial() {
  return new ShaderMaterial({
    uniforms: { uGlobalOpacity: { value: 0.78 } },
    vertexShader: `
      attribute float aSize;
      attribute float aOpacity;
      varying vec3 vColor;
      varying float vOpacity;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float perspective = clamp(180.0 / max(1.0, -viewPosition.z), 0.72, 2.1);
        gl_PointSize = aSize * perspective;
        gl_Position = projectionMatrix * viewPosition;
        vColor = color;
        vOpacity = aOpacity;
      }
    `,
    fragmentShader: `
      uniform float uGlobalOpacity;
      varying vec3 vColor;
      varying float vOpacity;
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5));
        float softDisc = 1.0 - smoothstep(0.16, 0.5, radius);
        float core = 1.0 - smoothstep(0.0, 0.24, radius);
        float alpha = (softDisc * 0.72 + core * 0.28) * vOpacity * uGlobalOpacity;
        if (alpha <= 0.004) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    vertexColors: true,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

function deterministicUnit(index, salt) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

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

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep01(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function lerpNumber(start, end, amount) {
  return start + (end - start) * amount;
}

function writeHeightBlend(output, start, end, amount, phase) {
  output.phase = phase;
  output.bodyBase = lerpNumber(start.bodyBase, end.bodyBase, amount);
  output.bodyRange = lerpNumber(start.bodyRange, end.bodyRange, amount);
  output.leaderHeight = lerpNumber(start.leaderHeight, end.leaderHeight, amount);
  output.curl = lerpNumber(start.curl, end.curl, amount);
  return output;
}

/**
 * Resolve the vertical grammar from spatial route progress, independent of
 * animation timing. Route Y remains the authored terrain baseline.
 */
export function resolveWindHeightProfile({
  distance,
  totalDistance,
  handoffDistance = null,
} = {}, output = {}) {
  const total = Number(totalDistance);
  const position = Number(distance);
  if (!Number.isFinite(total) || total <= 1e-8 || !Number.isFinite(position)) {
    return writeHeightBlend(output, WIND_HEIGHTS.pickup, WIND_HEIGHTS.pickup, 0, 'pickup');
  }

  const routeDistance = clamp01(position / total) * total;
  const handoff = Number(handoffDistance);
  const hasHandoff = Number.isFinite(handoff) && handoff > 1e-6 && handoff < total - 1e-6;
  const mainDistance = hasHandoff ? handoff : total;
  const pickupEnd = Math.min(WIND_HEIGHTS.pickupDistance, mainDistance * 0.25);
  const riseEnd = Math.max(pickupEnd + 1e-6, Math.min(WIND_HEIGHTS.riseDistance, mainDistance));

  if (routeDistance <= pickupEnd + 1e-9) {
    return writeHeightBlend(output, WIND_HEIGHTS.pickup, WIND_HEIGHTS.pickup, 0, 'pickup');
  }
  if (routeDistance < riseEnd - 1e-9) {
    const rise = smoothstep01((routeDistance - pickupEnd) / (riseEnd - pickupEnd));
    return writeHeightBlend(output, WIND_HEIGHTS.pickup, WIND_HEIGHTS.stream, rise, 'rise');
  }
  if (!hasHandoff || routeDistance <= handoff + 1e-9) {
    return writeHeightBlend(output, WIND_HEIGHTS.stream, WIND_HEIGHTS.stream, 0, 'stream');
  }

  const descent = smoothstep01((routeDistance - handoff) / (total - handoff));
  return writeHeightBlend(output, WIND_HEIGHTS.stream, WIND_HEIGHTS.handoff, descent, 'handoff');
}

export function resolveWindGustFrame({
  totalDistance,
  handoffDistance = null,
  elapsed,
  duration,
  spacing,
  maxMarkers,
  wakeLength = OBJECTIVE_HINT_TRAIL_DEFAULTS.wakeLength,
  reducedMotion = false,
} = {}, output = []) {
  const total = Number(totalDistance);
  const time = Math.max(0, Number(elapsed) || 0);
  const lifetime = positiveNumber(duration, OBJECTIVE_HINT_TRAIL_DEFAULTS.duration);
  const gap = positiveNumber(spacing, OBJECTIVE_HINT_TRAIL_DEFAULTS.spacing);
  const limit = Math.max(1, Math.floor(positiveNumber(maxMarkers, 1)));
  if (!Number.isFinite(total) || total <= 0) {
    output.length = 0;
    return output;
  }

  if (reducedMotion) {
    const preview = Math.min(total, 3.8);
    const count = Math.min(limit, 24);
    const sageStart = Math.max(2, count - Math.max(2, Math.floor(count * 0.18)));
    output.length = count;
    for (let index = 0; index < count; index += 1) {
      const carrier = output[index] || (output[index] = {});
      carrier.active = true;
      carrier.distance = preview * (1 - index / Math.max(1, count - 1));
      carrier.role = index === 0 ? 'gold' : (index >= sageStart ? 'sage' : 'ivory');
      carrier.phase = 'static';
    }
    return output;
  }

  const fadeStart = lifetime * 0.8875;
  const handoff = Number(handoffDistance);
  const hasConnector = Number.isFinite(handoff) && handoff > 0.1 && handoff < total - 0.1;
  let frontDistance;
  let phase = 'main';
  if (!hasConnector) {
    const travelDuration = Math.max(0.75, Math.min(2.25, total / 9));
    frontDistance = total * clamp01(time / travelDuration);
    if (time > travelDuration) phase = 'settle';
  } else {
    const handoffTime = Math.max(0.75, Math.min(2.25, handoff / 9));
    const courtesyPause = 0.12;
    const connectorDuration = Math.min(0.5, Math.max(0.32, (total - handoff) / 5));
    const arrivalTime = handoffTime + courtesyPause + connectorDuration;
    if (time <= handoffTime) {
      frontDistance = handoff * clamp01(time / handoffTime);
    } else if (time <= handoffTime + courtesyPause) {
      frontDistance = handoff;
      phase = 'handoff';
    } else if (time <= arrivalTime) {
      const connectorProgress = clamp01(
        (time - handoffTime - courtesyPause) / connectorDuration,
      );
      frontDistance = handoff + (total - handoff) * connectorProgress;
      phase = 'connector';
    } else {
      frontDistance = total;
      phase = 'settle';
    }
  }
  if (time >= fadeStart) {
    frontDistance = total;
    phase = 'fade';
  }

  const normalWake = positiveNumber(wakeLength, OBJECTIVE_HINT_TRAIL_DEFAULTS.wakeLength);
  const activeWake = phase === 'connector' ? Math.min(2.4, normalWake) : normalWake;
  const carrierBudget = Math.min(limit, Math.max(2, Math.floor(normalWake / gap) + 1));
  const activeCount = Math.min(
    carrierBudget,
    Math.max(
      Math.min(carrierBudget, Math.max(8, Math.floor(carrierBudget * 0.22))),
      Math.floor(Math.min(frontDistance, activeWake) / gap) + 1,
    ),
  );
  const sageCount = Math.min(3, Math.max(1, Math.floor(carrierBudget * 0.24)));
  const sageStart = carrierBudget - sageCount;
  output.length = carrierBudget;
  for (let index = 0; index < carrierBudget; index += 1) {
    const carrier = output[index] || (output[index] = {});
    carrier.active = index < activeCount && !(index === 0 && phase === 'settle');
    carrier.distance = Math.max(0, frontDistance - index * gap);
    carrier.role = index === 0 ? 'gold' : (index >= sageStart ? 'sage' : 'ivory');
    carrier.phase = phase;
  }
  return output;
}

/**
 * Temporary projection for an already resolved objective path.
 *
 * This owns one bounded point-cloud draw and no gameplay state, collision geometry,
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
    this.wakeLength = positiveNumber(options.wakeLength, OBJECTIVE_HINT_TRAIL_DEFAULTS.wakeLength);

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
    this._carrierFrame = [];
    this._routePoints = [];
    this._flowPoints = [];
    this._flowLengths = [];
    this._flowTotal = 0;
    this._handoffDistance = null;
    this._getTargetPosition = null;
    this._handoff = null;
    this._validatedTarget = null;
    this._smoothedTarget = null;
    this._before = new Vector3();
    this._after = new Vector3();
    this._heightRequest = { distance: 0, totalDistance: 0, handoffDistance: null };
    this._heightProfile = {};
  }

  init() {
    if (this.initialized) return this;
    if (this.disposed) throw new Error('ObjectiveHintTrail has been disposed');
    if (!this.scene?.add) throw new Error('ObjectiveHintTrail requires a Three.js scene');

    this.root = new Group();
    this.root.name = 'objective_hint_trail';
    this.root.userData.cameraCollision = false;
    this.root.userData.physicsCollision = false;

    this.geometry = createWindParticleGeometry(this.maxMarkers);
    this.material = createWindParticleMaterial();
    this.material.opacity = 0.78;
    this.mesh = new Points(this.geometry, this.material);
    this.mesh.name = 'objective_hint_wind_point_cloud';
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.userData.cameraCollision = false;
    this.mesh.userData.physicsCollision = false;
    this.mesh.userData.projectionRole = 'objective-hint';
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
    this._routePoints = routePoints.map((point) => point.clone());
    this._getTargetPosition = approach ? getTargetPosition : null;
    this._handoff = approach?.handoff || null;
    this._validatedTarget = approach ? initialLiveTarget.clone() : null;
    this._smoothedTarget = approach ? initialLiveTarget.clone() : null;
    this._targetLeash = positiveNumber(targetLeash, this.targetLeash);
    this.activeDuration = activeDuration;
    this._rebuildFlowPath();
    this._configureCarrierPool();

    this.active = true;
    this.elapsed = 0;
    this.cueId = cueId === null || cueId === undefined ? null : String(cueId);
    this.mesh.userData.cueId = this.cueId;
    this.geometry.setDrawRange(0, this._markers.length);
    this.mesh.visible = true;
    this._setOpacity(0.78);
    this._writeMatrices();
    return true;
  }

  _rebuildFlowPath() {
    this._flowPoints = this._routePoints.map((point) => point.clone());
    const routeMeasurement = measurePolyline(this._flowPoints);
    this._handoffDistance = this._smoothedTarget ? routeMeasurement.total : null;
    if (
      this._smoothedTarget
      && this._flowPoints.at(-1).distanceToSquared(this._smoothedTarget) > 1e-8
    ) this._flowPoints.push(this._smoothedTarget.clone());
    const measurement = measurePolyline(this._flowPoints);
    this._flowLengths = measurement.lengths;
    this._flowTotal = measurement.total;
  }

  _configureCarrierPool() {
    resolveWindGustFrame({
      totalDistance: this._flowTotal,
      handoffDistance: this._handoffDistance,
      elapsed: 0,
      duration: this.activeDuration,
      spacing: this.spacing,
      maxMarkers: this.maxMarkers,
      wakeLength: this.wakeLength,
      reducedMotion: this.reducedMotion,
    }, this._carrierFrame);
    this._markers.length = this._carrierFrame.length;
    for (let index = 0; index < this._carrierFrame.length; index += 1) {
      const carrier = this._carrierFrame[index];
      const marker = this._markers[index] || (this._markers[index] = {
        position: new Vector3(),
        active: false,
        pathDistance: 0,
        windRole: carrier.role,
        phase: carrier.phase,
        lateralSeed: deterministicUnit(index, 1),
        heightSeed: deterministicUnit(index, 2),
        motionSeed: deterministicUnit(index, 3),
        longitudinalSeed: deterministicUnit(index, 4),
        // A low-discrepancy lifetime sequence keeps this small fixed pool near
        // the intended survival ratio without visible index bands.
        decaySeed: (index * 0.61803398875 + 0.23) % 1,
      });
      marker.windRole = carrier.role;
      WIND_COLORS[carrier.role].toArray(this.geometry.attributes.color.array, index * 3);
      this.geometry.attributes.aSize.array[index] = carrier.role === 'gold'
        ? 9
        : (carrier.role === 'sage' ? 6.4 + marker.heightSeed * 3.4 : 4.2 + marker.heightSeed * 4.2);
    }
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
  }

  _refreshTarget(dt) {
    if (this.reducedMotion || !this._getTargetPosition || !this._smoothedTarget) return;
    const candidate = normalizePoint(this._getTargetPosition());
    if (candidate) {
      candidate.y = this._validatedTarget.y;
      if (candidate.distanceTo(this._validatedTarget) <= this._targetLeash + 1e-6) {
        const alpha = 1 - Math.exp(-this.retargetSharpness * Math.max(0, dt));
        const previousX = this._smoothedTarget.x;
        const previousZ = this._smoothedTarget.z;
        this._smoothedTarget.lerp(candidate, alpha);
        if (
          Math.abs(previousX - this._smoothedTarget.x) > 1e-7
          || Math.abs(previousZ - this._smoothedTarget.z) > 1e-7
        ) this._rebuildFlowPath();
      }
    }
  }

  _writeMatrices() {
    if (!this.mesh) return;
    resolveWindGustFrame({
      totalDistance: this._flowTotal,
      handoffDistance: this._handoffDistance,
      elapsed: this.elapsed,
      duration: this.activeDuration,
      spacing: this.spacing,
      maxMarkers: this.maxMarkers,
      wakeLength: this.wakeLength,
      reducedMotion: this.reducedMotion,
    }, this._carrierFrame);
    for (let index = 0; index < this._markers.length; index += 1) {
      const marker = this._markers[index];
      const carrier = this._carrierFrame[index];
      marker.active = Boolean(carrier?.active);
      marker.pathDistance = carrier?.distance || 0;
      marker.phase = carrier?.phase || 'main';
      const leadDistance = this._carrierFrame[0]?.distance || 0;
      const bodyCount = Math.max(1, this._markers.length - 1);
      const clumpSize = 4;
      const clumpCount = Math.max(1, Math.ceil(bodyCount / clumpSize));
      const clumpIndex = index === 0 ? 0 : Math.floor((index - 1) / clumpSize) + 1;
      const clumpStride = Math.min(0.68, this.wakeLength / clumpCount);
      const longitudinalScatter = index === 0
        ? 0
        : (marker.longitudinalSeed - 0.5) * Math.min(0.24, clumpStride * 0.55);
      const wakeOffset = index === 0
        ? 0
        : Math.max(0, clumpIndex * clumpStride + longitudinalScatter);
      const displayDistance = Math.max(
        0,
        Math.min(leadDistance, leadDistance - wakeOffset),
      );
      samplePolyline(this._flowPoints, this._flowLengths, displayDistance, marker.position);
      samplePolyline(
        this._flowPoints,
        this._flowLengths,
        Math.max(0, displayDistance - 0.08),
        this._before,
      );
      samplePolyline(
        this._flowPoints,
        this._flowLengths,
        Math.min(this._flowTotal, displayDistance + 0.08),
        this._after,
      );
      const dx = this._after.x - this._before.x;
      const dz = this._after.z - this._before.z;
      const tangentLength = Math.hypot(dx, dz) || 1;
      const normalX = dz / tangentLength;
      const normalZ = -dx / tangentLength;
      const wakeFraction = leadDistance > 1e-6
        ? Math.max(0, Math.min(1, (leadDistance - displayDistance) / this.wakeLength))
        : 0;
      const cloudEnvelope = Math.sin(Math.PI * wakeFraction);
      const clumpPhase = clumpIndex * 1.73 - this.elapsed * 1.15;
      const curlPhase = marker.motionSeed * Math.PI * 2
        + this.elapsed * (2.1 + marker.heightSeed * 0.9)
        - displayDistance * 0.55;
      const clumpSway = Math.sin(clumpPhase) * (0.07 + cloudEnvelope * 0.12);
      const randomScatter = (marker.lateralSeed - 0.5) * (0.25 + cloudEnvelope * 0.25);
      const curlRadius = 0.045 + marker.heightSeed * (0.05 + cloudEnvelope * 0.055);
      const spread = index === 0
        ? 0
        : clumpSway + randomScatter + Math.sin(curlPhase) * curlRadius;
      this._heightRequest.distance = displayDistance;
      this._heightRequest.totalDistance = this._flowTotal;
      this._heightRequest.handoffDistance = this._handoffDistance;
      const heightProfile = resolveWindHeightProfile(
        this._heightRequest,
        this._heightProfile,
      );
      const lift = index === 0
        ? heightProfile.leaderHeight
        : heightProfile.bodyBase
          + marker.heightSeed * heightProfile.bodyRange
          + Math.sin(curlPhase) * heightProfile.curl
          + Math.sin(clumpPhase * 0.71) * heightProfile.curl * 0.35;
      const offset = index * 3;
      this.geometry.attributes.position.array[offset] = marker.position.x + normalX * spread;
      this.geometry.attributes.position.array[offset + 1] = marker.position.y + lift;
      this.geometry.attributes.position.array[offset + 2] = marker.position.z + normalZ * spread;
      const roleOpacity = marker.windRole === 'gold'
        ? 0.94
        : (marker.windRole === 'sage' ? 0.68 : 0.8);
      const density = marker.windRole === 'gold' ? 1 : 0.48 + marker.motionSeed * 0.52;
      const clumpBreath = marker.windRole === 'gold'
        ? 1
        : 0.82 + Math.sin(clumpPhase + marker.heightSeed * 4.7) * 0.18;
      const routeProgress = this._flowTotal > 1e-6 ? leadDistance / this._flowTotal : 0;
      const decayEnd = 0.2 + marker.decaySeed * 0.825;
      const decay = this.reducedMotion || marker.windRole === 'gold'
        ? 1
        : Math.max(0, Math.min(1, (decayEnd - routeProgress) / 0.045));
      this.geometry.attributes.aOpacity.array[index] = marker.active
        ? roleOpacity * density * clumpBreath * decay
        : 0;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aOpacity.needsUpdate = true;
  }

  _setOpacity(value) {
    const opacity = Math.max(0, Math.min(1, Number(value) || 0));
    this.material.opacity = opacity;
    this.material.uniforms.uGlobalOpacity.value = opacity;
  }

  update(dt) {
    if (!this.active || !this.mesh) return false;
    const delta = Number(dt);
    if (Number.isFinite(delta) && delta > 0) this.elapsed += delta;
    if (this.elapsed + 1e-9 >= this.activeDuration) {
      this.hide();
      return false;
    }
    const fadeStart = this.activeDuration * 0.78;
    this._setOpacity(this.elapsed <= fadeStart
      ? 0.78
      : 0.78 * Math.max(0, 1 - (this.elapsed - fadeStart) / (this.activeDuration - fadeStart)));
    this._refreshTarget(Number.isFinite(delta) && delta > 0 ? delta : 0);
    if (!this.reducedMotion) this._writeMatrices();
    return true;
  }

  hide() {
    this.active = false;
    this.elapsed = 0;
    this.cueId = null;
    this._markers.length = 0;
    this._carrierFrame.length = 0;
    this._routePoints.length = 0;
    this._flowPoints.length = 0;
    this._flowLengths.length = 0;
    this._flowTotal = 0;
    this._handoffDistance = null;
    this._getTargetPosition = null;
    this._handoff = null;
    this._validatedTarget = null;
    this._smoothedTarget = null;
    if (this.mesh) {
      this.geometry.setDrawRange(0, 0);
      this.mesh.visible = false;
      this.mesh.userData.cueId = null;
    }
    if (this.material) this._setOpacity(0.78);
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
