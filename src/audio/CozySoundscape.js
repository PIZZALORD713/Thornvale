const NOTE_FREQUENCIES = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
};

const CHIME_PATTERNS = {
  ambientDay: [['E5', 0], ['A5', 0.16], ['C6', 0.36]],
  ambientNight: [['A4', 0], ['E5', 0.22], ['B4', 0.48]],
  kindness: [['E5', 0], ['A5', 0.1], ['C6', 0.22]],
  bell: [['C5', 0], ['G5', 0.12], ['C6', 0.28]],
  magic: [['D5', 0], ['G5', 0.09], ['A5', 0.19], ['D5', 0.36]],
  soft: [['A4', 0], ['E5', 0.22]],
};

function audioContextClass() {
  return globalThis.AudioContext || globalThis.webkitAudioContext || null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

/**
 * A tiny procedural soundscape using only the Web Audio API.
 *
 * Audio never starts in the constructor. Call `start()` from a user gesture or
 * use `attachUnlock()` to comply with browser autoplay policy.
 */
export class CozySoundscape {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.volume = clamp(options.volume ?? 0.38, 0, 1);
    this.ambienceVolume = clamp(options.ambienceVolume ?? 0.24, 0, 1);
    this.effectsVolume = clamp(options.effectsVolume ?? 0.52, 0, 1);
    this.autoChimes = options.autoChimes !== false;
    this.chimeInterval = Math.max(6, options.chimeInterval ?? 15);

    this.context = null;
    this.master = null;
    this.ambientBus = null;
    this.effectsBus = null;
    this.noiseFilter = null;
    this.noiseGain = null;
    this.padFilter = null;
    this._sources = [];
    this._unlockCleanup = null;
    this._startPromise = null;
    this._started = false;
    this._muted = false;
    this._isNight = false;
    this._weather = 'mixed';
    this._chimeTimer = this.chimeInterval * (0.75 + Math.random() * 0.5);
    this._footstepCooldown = 0;
    this._noiseBuffer = null;
  }

  static isSupported() {
    return Boolean(audioContextClass());
  }

  get isStarted() {
    return this._started && Boolean(this.context);
  }

  /**
   * Start or resume audio. Must be reached from a click/tap/key event in most
   * browsers. Resolves false rather than throwing when Web Audio is unavailable.
   */
  async start() {
    if (!this.enabled) return false;
    const AudioContextClass = audioContextClass();
    if (!AudioContextClass) return false;

    if (this._startPromise) return this._startPromise;

    this._startPromise = this._startInternal(AudioContextClass);
    try {
      return await this._startPromise;
    } finally {
      this._startPromise = null;
    }
  }

  async _startInternal(AudioContextClass) {

    try {
      if (!this.context) {
        this.context = new AudioContextClass();
        this._buildGraph();
      }
      if (this.context.state === 'suspended') await this.context.resume();
      this._started = this.context.state === 'running';
      if (this._started) this._unlockCleanup?.();
      return this._started;
    } catch (error) {
      console.warn('[CozySoundscape] Audio could not start.', error);
      return false;
    }
  }

  /** Attach one-shot unlock listeners and return a cleanup function. */
  attachUnlock(target = globalThis.document) {
    this._unlockCleanup?.();
    if (!target?.addEventListener) return () => {};

    let cleaned = false;
    let pending = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      target.removeEventListener('pointerdown', unlock);
      target.removeEventListener('touchstart', unlock);
      globalThis.document?.removeEventListener?.('keydown', unlock);
      if (this._unlockCleanup === cleanup) this._unlockCleanup = null;
    };
    const unlock = () => {
      if (pending) return;
      pending = true;
      this.start().then((started) => {
        if (started) {
          this.playChime('soft', { gain: 0.24 });
          cleanup();
        } else {
          pending = false;
        }
      });
    };

    target.addEventListener('pointerdown', unlock, { passive: true });
    target.addEventListener('touchstart', unlock, { passive: true });
    globalThis.document?.addEventListener?.('keydown', unlock);
    this._unlockCleanup = cleanup;
    return cleanup;
  }

  _buildGraph() {
    const context = this.context;
    if (!context) return;

    this.master = context.createGain();
    this.ambientBus = context.createGain();
    this.effectsBus = context.createGain();
    this.master.gain.value = this._muted ? 0 : this.volume;
    this.ambientBus.gain.value = this.ambienceVolume;
    this.effectsBus.gain.value = this.effectsVolume;
    this.ambientBus.connect(this.master);
    this.effectsBus.connect(this.master);
    this.master.connect(context.destination);

    // Soft, looped filtered noise makes breeze/rain without an audio asset.
    this._noiseBuffer = this._makeCozyNoiseBuffer(2.5);
    const noise = context.createBufferSource();
    noise.buffer = this._noiseBuffer;
    noise.loop = true;
    this.noiseFilter = context.createBiquadFilter();
    this.noiseFilter.type = 'lowpass';
    this.noiseFilter.frequency.value = 760;
    this.noiseFilter.Q.value = 0.25;
    this.noiseGain = context.createGain();
    this.noiseGain.gain.value = 0.055;
    noise.connect(this.noiseFilter);
    this.noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.ambientBus);
    noise.start();
    this._sources.push(noise);

    // Barely audible root/fifth sine bed; the filter changes with day/night.
    this.padFilter = context.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 520;
    this.padFilter.Q.value = 0.4;
    this.padFilter.connect(this.ambientBus);

    const padNotes = [110, 164.81, 220];
    const padLevels = [0.018, 0.009, 0.005];
    padNotes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index === 2 ? 4 : -3;
      gain.gain.value = padLevels[index];
      oscillator.connect(gain);
      gain.connect(this.padFilter);
      oscillator.start();
      this._sources.push(oscillator);
    });

    // Slow modulation makes the procedural bed feel organic instead of static.
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.075;
    lfoGain.gain.value = 0.018;
    lfo.connect(lfoGain);
    lfoGain.connect(this.noiseGain.gain);
    lfo.start();
    this._sources.push(lfo);
  }

  _makeCozyNoiseBuffer(duration) {
    const context = this.context;
    const frames = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(2, frames, context.sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      let smooth = 0;
      for (let i = 0; i < frames; i += 1) {
        const white = Math.random() * 2 - 1;
        smooth = smooth * 0.965 + white * 0.035;
        data[i] = smooth * 1.8;
      }
    }
    return buffer;
  }

  /** Advance ambience transitions and optional sparse world chimes. */
  update(dt, state = {}) {
    if (typeof state.isNight === 'boolean') this._isNight = state.isNight;
    if (state.weather) this._weather = state.weather;

    const safeDt = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
    this._footstepCooldown = Math.max(0, this._footstepCooldown - safeDt);
    if (!this.isStarted) return;

    const now = this.context.currentTime;
    const drizzle = this._weather === 'drizzle';
    const targetNoise = drizzle ? 0.14 : (this._isNight ? 0.035 : 0.055);
    const targetCutoff = drizzle ? 1350 : (this._isNight ? 440 : 760);
    const targetPad = this.ambienceVolume * (this._isNight ? 1.1 : 0.82);
    this.noiseGain.gain.setTargetAtTime(targetNoise, now, 0.8);
    this.noiseFilter.frequency.setTargetAtTime(targetCutoff, now, 1.2);
    this.padFilter.frequency.setTargetAtTime(this._isNight ? 360 : 520, now, 1.4);
    this.ambientBus.gain.setTargetAtTime(targetPad, now, 0.7);

    if (this.autoChimes) {
      this._chimeTimer -= safeDt;
      if (this._chimeTimer <= 0) {
        this.playChime(this._isNight ? 'ambientNight' : 'ambientDay', { gain: 0.18 });
        this._chimeTimer = this.chimeInterval * (0.72 + Math.random() * 0.72);
      }
    }
  }

  /** Play a tiny glassy arpeggio through synthesized oscillators. */
  playChime(pattern = 'soft', options = {}) {
    if (!this.isStarted || !this.effectsBus) return false;
    const notes = CHIME_PATTERNS[pattern] || CHIME_PATTERNS.soft;
    const now = this.context.currentTime + 0.008;
    const overallGain = clamp(options.gain ?? 0.36, 0, 1);
    const detune = Number(options.detune) || 0;

    notes.forEach(([name, delay], index) => {
      const frequency = NOTE_FREQUENCIES[name];
      if (!frequency) return;
      const startAt = now + delay;
      const duration = 0.72 + index * 0.09;
      const oscillator = this.context.createOscillator();
      const shimmer = this.context.createOscillator();
      const gain = this.context.createGain();
      const shimmerGain = this.context.createGain();
      const panner = this.context.createStereoPanner?.();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startAt);
      oscillator.detune.setValueAtTime(detune, startAt);
      shimmer.type = 'sine';
      shimmer.frequency.setValueAtTime(frequency * 2.01, startAt);

      const peak = overallGain * (0.115 - index * 0.012);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), startAt + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      shimmerGain.gain.setValueAtTime(0.0001, startAt);
      shimmerGain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak * 0.18), startAt + 0.01);
      shimmerGain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration * 0.62);

      oscillator.connect(gain);
      shimmer.connect(shimmerGain);
      shimmerGain.connect(gain);
      if (panner) {
        panner.pan.value = ((index % 2) * 2 - 1) * 0.22;
        gain.connect(panner);
        panner.connect(this.effectsBus);
      } else {
        gain.connect(this.effectsBus);
      }

      oscillator.start(startAt);
      shimmer.start(startAt);
      oscillator.stop(startAt + duration + 0.04);
      shimmer.stop(startAt + duration + 0.04);
    });
    return true;
  }

  playInteraction(kind = 'kindness') {
    const pattern = CHIME_PATTERNS[kind] ? kind : 'magic';
    return this.playChime(pattern, { gain: kind === 'bell' ? 0.55 : 0.42 });
  }

  /** Optional light footstep puff. Rate-limited to prevent audio overload. */
  playFootstep(intensity = 0.5) {
    if (!this.isStarted || this._footstepCooldown > 0 || !this._noiseBuffer) return false;
    this._footstepCooldown = 0.12;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this._noiseBuffer;
    source.playbackRate.value = 0.72 + Math.random() * 0.18;
    filter.type = 'bandpass';
    filter.frequency.value = 180 + Math.random() * 90;
    filter.Q.value = 0.8;
    const level = 0.018 * clamp(intensity, 0.1, 1.5);
    gain.gain.setValueAtTime(level, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.effectsBus);
    source.start(now, Math.random() * 1.5, 0.09);
    source.stop(now + 0.1);
    return true;
  }

  setDayNight(isNight) {
    this._isNight = Boolean(isNight);
    return this;
  }

  setWeather(weather) {
    this._weather = weather || 'mixed';
    return this;
  }

  setVolume(volume) {
    this.volume = clamp(volume, 0, 1);
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this._muted ? 0 : this.volume, this.context.currentTime, 0.05);
    }
    return this;
  }

  setMuted(muted) {
    this._muted = Boolean(muted);
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this._muted ? 0 : this.volume, this.context.currentTime, 0.04);
    }
    return this;
  }

  async suspend() {
    if (!this.context || this.context.state !== 'running') return false;
    await this.context.suspend();
    this._started = false;
    return true;
  }

  async dispose() {
    this._unlockCleanup?.();
    this._unlockCleanup = null;
    this._startPromise = null;
    this._started = false;
    for (const source of this._sources) {
      try { source.stop(); } catch { /* already stopped */ }
      try { source.disconnect(); } catch { /* no-op */ }
    }
    this._sources.length = 0;

    const context = this.context;
    this.context = null;
    this.master = null;
    this.ambientBus = null;
    this.effectsBus = null;
    this.noiseFilter = null;
    this.noiseGain = null;
    this.padFilter = null;
    this._noiseBuffer = null;
    if (context && context.state !== 'closed') await context.close();
  }
}
