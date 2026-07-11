import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  MathUtils,
  NormalBlending,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';

const WEATHER_MODES = new Set([
  'mixed',
  'clear',
  'petals',
  'fireflies',
  'stardust',
  'drizzle',
]);

const PALETTES = {
  fireflies: [0xfff6a1, 0xcfffab, 0xa8ffe6],
  petals: [0xffc7df, 0xffe1ec, 0xe8c9ff, 0xffffff],
  sparkles: [0xccefff, 0xffe6a8, 0xf4dcff],
  drizzle: [0xb9dcff, 0xd9edff, 0xc8c4ff],
  kindness: [0xff78b5, 0xffc6e0, 0xffe38a, 0xffffff],
  bell: [0xffd264, 0xfff0ac, 0xffffff],
  magic: [0xc584ff, 0x8cecff, 0xffa9df, 0xffffff],
};

const PARTICLE_VERTEX_SHADER = /* glsl */`
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uScale;
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vPhase;
  varying float vOpacity;

  void main() {
    vColor = color;
    vPhase = aPhase + uTime;
    vOpacity = uOpacity;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float perspective = 300.0 / max(1.0, -mvPosition.z);
    gl_PointSize = clamp(aSize * uScale * uPixelRatio * perspective, 1.0, 42.0);
  }
`;

const PARTICLE_FRAGMENT_SHADER = /* glsl */`
  uniform float uStyle;
  varying vec3 vColor;
  varying float vPhase;
  varying float vOpacity;

  mat2 rotate2d(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
  }

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float alpha = 0.0;
    float glow = 0.0;

    if (uStyle < 0.5) {
      // Soft firefly orb with a breathing halo.
      float d = length(p);
      float pulse = 0.82 + sin(vPhase * 2.1) * 0.18;
      alpha = (1.0 - smoothstep(0.08, 0.5, d)) * pulse;
      glow = (1.0 - smoothstep(0.0, 0.32, d)) * 0.75;
    } else if (uStyle < 1.5) {
      // Two-lobed blossom petal, rotated independently per particle.
      p = rotate2d(vPhase * 0.45) * p;
      float leftPetal = length((p - vec2(-0.115, 0.03)) * vec2(1.0, 1.45));
      float rightPetal = length((p - vec2(0.115, -0.03)) * vec2(1.0, 1.45));
      float petal = min(leftPetal, rightPetal);
      alpha = 1.0 - smoothstep(0.19, 0.27, petal);
      glow = (1.0 - smoothstep(0.0, 0.25, length(p))) * 0.12;
    } else if (uStyle < 2.5) {
      // Four-point twinkle with a soft center.
      p = rotate2d(vPhase * 0.22) * p;
      float crossA = max(abs(p.x) * 4.8, abs(p.y));
      float crossB = max(abs(p.y) * 4.8, abs(p.x));
      float star = min(crossA, crossB);
      alpha = 1.0 - smoothstep(0.08, 0.48, star);
      glow = (1.0 - smoothstep(0.0, 0.22, length(p))) * 0.7;
    } else {
      // A narrow, soft drizzle streak inside the point sprite.
      p = rotate2d(-0.12) * p;
      float drop = length(p * vec2(7.5, 1.05));
      alpha = 1.0 - smoothstep(0.24, 0.5, drop);
      glow = (1.0 - smoothstep(0.0, 0.4, drop)) * 0.18;
    }

    if (alpha <= 0.002) discard;
    gl_FragColor = vec4(vColor * (1.0 + glow), alpha * vOpacity);
  }
`;

function makeRng(seed = 713) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Pooled, texture-free ambient and interaction particles.
 *
 * Ambient systems recycle around the player, which keeps counts constant and
 * avoids allocations while exploring. All visuals are procedural shaders, so
 * there are no asset downloads or cross-origin failure modes.
 */
export class KawaiiVFX {
  constructor(scene, options = {}) {
    this.scene = scene || null;
    this.root = new Group();
    this.root.name = 'KawaiiVFX';

    this.enabled = options.enabled !== false;
    this.weather = WEATHER_MODES.has(options.weather) ? options.weather : 'mixed';
    this.isNight = Boolean(options.isNight);
    this.nightMix = this.isNight ? 1 : 0;
    this.pixelRatio = Math.min(finiteOr(options.pixelRatio, globalThis.devicePixelRatio || 1), 2);
    this.radius = Math.max(4, finiteOr(options.radius, 18));
    this.height = Math.max(3, finiteOr(options.height, 8));
    this._time = 0;
    this._initialized = false;
    this._rng = makeRng(options.seed ?? 713);
    this._center = new Vector3();
    this._hasCenter = false;
    this._systems = [];
    this._burstParticles = [];
    this._maxBurstParticles = Math.max(32, options.maxBurstParticles ?? 192);

    this.counts = {
      fireflies: Math.max(0, options.fireflyCount ?? 40),
      petals: Math.max(0, options.petalCount ?? 64),
      sparkles: Math.max(0, options.sparkleCount ?? 28),
      drizzle: Math.max(0, options.drizzleCount ?? 72),
    };

    this.fireflies = null;
    this.petals = null;
    this.sparkles = null;
    this.drizzle = null;
    this.bursts = null;
  }

  init() {
    if (this._initialized) return this;

    this.fireflies = this._createAmbientSystem('fireflies', this.counts.fireflies, 0);
    this.petals = this._createAmbientSystem('petals', this.counts.petals, 1);
    this.sparkles = this._createAmbientSystem('sparkles', this.counts.sparkles, 2);
    this.drizzle = this._createAmbientSystem('drizzle', this.counts.drizzle, 3);
    this.bursts = this._createBurstSystem();

    for (const system of this._systems) this.root.add(system.points);
    if (this.bursts) this.root.add(this.bursts.points);
    this.scene?.add?.(this.root);
    this._initialized = true;
    return this;
  }

  _createMaterial(style, additive = false) {
    return new ShaderMaterial({
      name: `KawaiiParticleMaterial_${style}`,
      uniforms: {
        uTime: { value: this._time },
        uPixelRatio: { value: this.pixelRatio },
        uScale: { value: 1 },
        uOpacity: { value: 0 },
        uStyle: { value: style },
      },
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: PARTICLE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      vertexColors: true,
      blending: additive ? AdditiveBlending : NormalBlending,
      toneMapped: false,
    });
  }

  _createAmbientSystem(kind, count, style) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const drift = new Float32Array(count * 3);
    const palette = PALETTES[kind];

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      const color = new Color(palette[Math.floor(this._rng() * palette.length)]);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
      phases[i] = this._rng() * Math.PI * 2;

      this._seedAmbientPosition(kind, positions, i3);

      if (kind === 'fireflies') {
        sizes[i] = MathUtils.lerp(0.1, 0.2, this._rng());
        drift[i3] = MathUtils.lerp(-0.16, 0.16, this._rng());
        drift[i3 + 1] = MathUtils.lerp(0.4, 0.9, this._rng());
        drift[i3 + 2] = MathUtils.lerp(-0.16, 0.16, this._rng());
      } else if (kind === 'petals') {
        sizes[i] = MathUtils.lerp(0.16, 0.27, this._rng());
        drift[i3] = MathUtils.lerp(0.22, 0.55, this._rng());
        drift[i3 + 1] = MathUtils.lerp(0.35, 0.78, this._rng());
        drift[i3 + 2] = MathUtils.lerp(-0.16, 0.24, this._rng());
      } else if (kind === 'sparkles') {
        sizes[i] = MathUtils.lerp(0.08, 0.17, this._rng());
        drift[i3] = MathUtils.lerp(-0.08, 0.08, this._rng());
        drift[i3 + 1] = MathUtils.lerp(0.3, 0.65, this._rng());
        drift[i3 + 2] = MathUtils.lerp(-0.08, 0.08, this._rng());
      } else {
        sizes[i] = MathUtils.lerp(0.22, 0.34, this._rng());
        drift[i3] = MathUtils.lerp(-0.18, -0.08, this._rng());
        drift[i3 + 1] = MathUtils.lerp(3.2, 5.6, this._rng());
        drift[i3 + 2] = MathUtils.lerp(0.04, 0.12, this._rng());
      }
    }

    const geometry = new BufferGeometry();
    const positionAttribute = new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', positionAttribute);
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));

    const additive = kind === 'fireflies' || kind === 'sparkles';
    const material = this._createMaterial(style, additive);
    const points = new Points(geometry, material);
    points.name = `particle_${kind}`;
    points.frustumCulled = false;
    points.renderOrder = additive ? 3 : 2;

    const system = {
      kind,
      count,
      points,
      geometry,
      material,
      positions,
      phases,
      drift,
      opacity: 0,
      targetOpacity: 0,
    };
    this._systems.push(system);
    return system;
  }

  _seedAmbientPosition(kind, positions, i3, atTop = false) {
    const angle = this._rng() * Math.PI * 2;
    const distance = Math.sqrt(this._rng()) * this.radius;
    positions[i3] = this._center.x + Math.cos(angle) * distance;
    positions[i3 + 2] = this._center.z + Math.sin(angle) * distance;

    if (kind === 'fireflies') {
      positions[i3 + 1] = this._center.y + 0.4 + this._rng() * Math.min(4.5, this.height);
    } else if (kind === 'sparkles') {
      positions[i3 + 1] = this._center.y + 1.2 + this._rng() * this.height;
    } else {
      positions[i3 + 1] = atTop
        ? this._center.y + this.height + this._rng() * 2
        : this._center.y + this._rng() * (this.height + 2);
    }
  }

  _createBurstSystem() {
    const count = this._maxBurstParticles;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const geometry = new BufferGeometry();
    const positionAttribute = new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage);
    const colorAttribute = new BufferAttribute(colors, 3).setUsage(DynamicDrawUsage);
    const sizeAttribute = new BufferAttribute(sizes, 1).setUsage(DynamicDrawUsage);
    const phaseAttribute = new BufferAttribute(phases, 1).setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', positionAttribute);
    geometry.setAttribute('color', colorAttribute);
    geometry.setAttribute('aSize', sizeAttribute);
    geometry.setAttribute('aPhase', phaseAttribute);
    geometry.setDrawRange(0, 0);

    const material = this._createMaterial(2, true);
    material.uniforms.uOpacity.value = 1;
    const points = new Points(geometry, material);
    points.name = 'particle_interaction_bursts';
    points.frustumCulled = false;
    points.renderOrder = 4;

    return {
      points,
      geometry,
      material,
      positions,
      colors,
      sizes,
      phases,
      attributes: { positionAttribute, colorAttribute, sizeAttribute, phaseAttribute },
    };
  }

  /**
   * Update ambient particles. Pass the current player position so the volume
   * follows exploration rather than leaving particles behind.
   */
  update(dt, state = {}) {
    if (!this.enabled || !this._initialized) return;
    const safeDt = Math.min(Math.max(Number(dt) || 0, 0), 0.075);
    this._time += safeDt;

    if (typeof state.isNight === 'boolean' && state.isNight !== this.isNight) {
      this.setDayNight(state.isNight);
    }
    if (state.weather && state.weather !== this.weather) this.setWeather(state.weather);

    const playerPosition = state.playerPosition || state.position;
    if (playerPosition && Number.isFinite(playerPosition.x)) {
      if (!this._hasCenter) {
        this._center.set(playerPosition.x, playerPosition.y, playerPosition.z);
        this._reseedAll();
        this._hasCenter = true;
      } else {
        this._center.x = playerPosition.x;
        this._center.y = playerPosition.y;
        this._center.z = playerPosition.z;
      }
    }

    this.nightMix = MathUtils.damp(this.nightMix, this.isNight ? 1 : 0, 2.1, safeDt);
    this._setOpacityTargets();

    for (const system of this._systems) {
      system.material.uniforms.uTime.value = this._time;
      system.opacity = MathUtils.damp(system.opacity, system.targetOpacity, 2.4, safeDt);
      system.material.uniforms.uOpacity.value = system.opacity;
      if (system.opacity > 0.003) this._updateAmbientSystem(system, safeDt);
    }

    if (this.bursts) {
      this.bursts.material.uniforms.uTime.value = this._time;
      this._updateBursts(safeDt);
    }
  }

  _setOpacityTargets() {
    const day = 1 - this.nightMix;
    const night = this.nightMix;
    const weather = this.weather;

    let fireflies = 0.12 * day + 0.9 * night;
    let petals = 0.72 * day + 0.25 * night;
    let sparkles = 0.24 * day + 0.72 * night;
    let drizzle = 0;

    if (weather === 'clear') {
      fireflies *= 0.42;
      petals *= 0.2;
      sparkles *= 0.5;
    } else if (weather === 'petals') {
      petals = 0.95;
      fireflies *= 0.65;
    } else if (weather === 'fireflies') {
      fireflies = 1;
      petals *= 0.12;
    } else if (weather === 'stardust') {
      sparkles = 1;
      petals *= 0.15;
    } else if (weather === 'drizzle') {
      drizzle = 0.62 + night * 0.16;
      fireflies *= 0.32;
      petals *= 0.08;
      sparkles *= 0.28;
    }

    this.fireflies.targetOpacity = fireflies;
    this.petals.targetOpacity = petals;
    this.sparkles.targetOpacity = sparkles;
    this.drizzle.targetOpacity = drizzle;
  }

  _updateAmbientSystem(system, dt) {
    const { kind, count, positions, phases, drift } = system;
    const minY = this._center.y - 0.3;
    const maxY = this._center.y + this.height + 2;
    const radiusSq = (this.radius * 1.18) ** 2;

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      phases[i] += dt * drift[i3 + 1];

      if (kind === 'fireflies') {
        positions[i3] += (drift[i3] + Math.sin(phases[i] * 0.73) * 0.06) * dt;
        positions[i3 + 1] += Math.sin(phases[i] * 1.17) * 0.065 * dt;
        positions[i3 + 2] += (drift[i3 + 2] + Math.cos(phases[i] * 0.61) * 0.06) * dt;
      } else if (kind === 'petals') {
        positions[i3] += (drift[i3] + Math.sin(phases[i] * 1.4) * 0.28) * dt;
        positions[i3 + 1] -= drift[i3 + 1] * dt;
        positions[i3 + 2] += (drift[i3 + 2] + Math.cos(phases[i]) * 0.2) * dt;
      } else if (kind === 'sparkles') {
        positions[i3] += (drift[i3] + Math.sin(phases[i]) * 0.035) * dt;
        positions[i3 + 1] += Math.sin(phases[i] * 0.8) * 0.025 * dt;
        positions[i3 + 2] += (drift[i3 + 2] + Math.cos(phases[i] * 0.9) * 0.035) * dt;
      } else {
        positions[i3] += drift[i3] * dt;
        positions[i3 + 1] -= drift[i3 + 1] * dt;
        positions[i3 + 2] += drift[i3 + 2] * dt;
      }

      const dx = positions[i3] - this._center.x;
      const dz = positions[i3 + 2] - this._center.z;
      const outside = dx * dx + dz * dz > radiusSq;
      const below = positions[i3 + 1] < minY;
      const above = positions[i3 + 1] > maxY;

      if (outside || below || above) {
        this._seedAmbientPosition(kind, positions, i3, below || outside);
      }
    }

    system.geometry.attributes.position.needsUpdate = true;
    system.geometry.attributes.aPhase.needsUpdate = true;
  }

  _reseedAll() {
    for (const system of this._systems) {
      for (let i = 0; i < system.count; i += 1) {
        this._seedAmbientPosition(system.kind, system.positions, i * 3);
      }
      system.geometry.attributes.position.needsUpdate = true;
    }
  }

  /** Spawn a pooled sparkle burst without creating GPU resources. */
  burst(position, options = {}) {
    if (!position || !this.bursts) return this;
    const count = Math.min(Math.max(1, options.count ?? 18), 64);
    const paletteInput = options.palette || [options.color ?? 0xffb6dc, 0xffffff];
    const palette = paletteInput.map((value) => value?.isColor ? value : new Color(value));
    const spread = Math.max(0.01, options.spread ?? 1.15);
    const upward = options.upward ?? 1.65;
    const speed = options.speed ?? 2.2;
    const lifetime = options.lifetime ?? 1.05;
    const size = options.size ?? 0.22;
    const gravity = options.gravity ?? 2.7;

    for (let i = 0; i < count; i += 1) {
      const theta = this._rng() * Math.PI * 2;
      const y = MathUtils.lerp(-0.18, 0.9, this._rng());
      const radial = Math.sqrt(Math.max(0, 1 - y * y));
      const velocityScale = speed * MathUtils.lerp(0.5, 1.15, this._rng());
      const color = palette[Math.floor(this._rng() * palette.length)];

      this._burstParticles.push({
        x: position.x + (this._rng() - 0.5) * spread * 0.18,
        y: position.y + (this._rng() - 0.5) * spread * 0.18,
        z: position.z + (this._rng() - 0.5) * spread * 0.18,
        vx: Math.cos(theta) * radial * velocityScale * spread,
        vy: y * velocityScale + upward,
        vz: Math.sin(theta) * radial * velocityScale * spread,
        age: 0,
        life: lifetime * MathUtils.lerp(0.65, 1.25, this._rng()),
        size: size * MathUtils.lerp(0.62, 1.3, this._rng()),
        phase: this._rng() * Math.PI * 2,
        color,
        gravity,
        drag: options.drag ?? 1.8,
      });
    }

    const overflow = this._burstParticles.length - this._maxBurstParticles;
    if (overflow > 0) this._burstParticles.splice(0, overflow);
    return this;
  }

  /** Theme-aware convenience burst for game interactions. */
  interactionBurst(position, kind = 'kindness') {
    const palette = PALETTES[kind] || PALETTES.magic;
    if (kind === 'bell') {
      return this.burst(position, {
        palette,
        count: 28,
        spread: 1.45,
        upward: 2.1,
        speed: 2.7,
        lifetime: 1.25,
        size: 0.25,
        gravity: 2.1,
      });
    }
    return this.burst(position, {
      palette,
      count: kind === 'kindness' ? 24 : 20,
      spread: 1.1,
      upward: 1.8,
      speed: 2.25,
      lifetime: 1.05,
      size: 0.22,
    });
  }

  _updateBursts(dt) {
    const active = this._burstParticles;
    const data = this.bursts;
    let writeIndex = 0;

    for (let readIndex = 0; readIndex < active.length; readIndex += 1) {
      const particle = active[readIndex];
      particle.age += dt;
      if (particle.age >= particle.life) continue;

      const drag = Math.exp(-particle.drag * dt);
      particle.vx *= drag;
      particle.vz *= drag;
      particle.vy -= particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.z += particle.vz * dt;
      particle.phase += dt * 4.2;

      const i3 = writeIndex * 3;
      const life01 = particle.age / particle.life;
      data.positions[i3] = particle.x;
      data.positions[i3 + 1] = particle.y;
      data.positions[i3 + 2] = particle.z;
      data.colors[i3] = particle.color.r;
      data.colors[i3 + 1] = particle.color.g;
      data.colors[i3 + 2] = particle.color.b;
      data.sizes[writeIndex] = particle.size * Math.sin(Math.PI * life01);
      data.phases[writeIndex] = particle.phase;

      active[writeIndex] = particle;
      writeIndex += 1;
    }

    active.length = writeIndex;
    data.geometry.setDrawRange(0, writeIndex);
    data.attributes.positionAttribute.needsUpdate = writeIndex > 0;
    data.attributes.colorAttribute.needsUpdate = writeIndex > 0;
    data.attributes.sizeAttribute.needsUpdate = writeIndex > 0;
    data.attributes.phaseAttribute.needsUpdate = writeIndex > 0;
  }

  setDayNight(isNight, immediate = false) {
    this.isNight = Boolean(isNight);
    if (immediate) this.nightMix = this.isNight ? 1 : 0;
    return this;
  }

  setWeather(mode) {
    if (WEATHER_MODES.has(mode)) this.weather = mode;
    return this;
  }

  setPixelRatio(pixelRatio) {
    this.pixelRatio = Math.min(Math.max(finiteOr(pixelRatio, 1), 0.5), 2);
    for (const system of this._systems) {
      system.material.uniforms.uPixelRatio.value = this.pixelRatio;
    }
    if (this.bursts) this.bursts.material.uniforms.uPixelRatio.value = this.pixelRatio;
    return this;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.root.visible = this.enabled;
    return this;
  }

  dispose() {
    this.scene?.remove?.(this.root);
    this.root.parent?.remove?.(this.root);
    for (const system of this._systems) {
      system.geometry.dispose();
      system.material.dispose();
    }
    this.bursts?.geometry?.dispose?.();
    this.bursts?.material?.dispose?.();
    this._systems.length = 0;
    this._burstParticles.length = 0;
    this.root.clear();
    this._initialized = false;
  }
}

export { WEATHER_MODES };
