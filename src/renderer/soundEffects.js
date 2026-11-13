/**
 * StickyPad — Procedural Web Audio Sound Generator
 * 100% royalty-free, 0KB assets, lightweight synthesized audio effects.
 */

class SoundEffects {
  constructor() {
    this.ctx = null;
    this.soundsEnabled = true;
    this.initSetting();
  }

  async initSetting() {
    if (window.stickyAPI && window.stickyAPI.getSetting) {
      try {
        const val = await window.stickyAPI.getSetting('soundsEnabled', true);
        this.soundsEnabled = val !== false;
      } catch (_) {
        this.soundsEnabled = true;
      }
    }
  }

  getAudioContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Soft paper peel sound (played when a note is created/opened)
   */
  async playPeelSound() {
    await this.initSetting();
    if (!this.soundsEnabled) return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const duration = 0.22;
      const now = ctx.currentTime;

      // 1. White noise buffer for paper texture
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      // Bandpass filter swept downwards (mimics adhesive peeling from desk/pad)
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(320, now + duration);
      filter.Q.setValueAtTime(2.5, now);

      // Volume envelope
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + duration);
    } catch (_) {}
  }

  /**
   * Soft paper crumple sound (played when note is tossed to trash)
   */
  async playCrumpleSound() {
    await this.initSetting();
    if (!this.soundsEnabled) return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const duration = 0.32;
      const now = ctx.currentTime;

      // Noise buffer for crinkles
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      // Resonant bandpass filter
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.linearRampToValueAtTime(1200, now + 0.15);
      filter.frequency.exponentialRampToValueAtTime(450, now + duration);
      filter.Q.setValueAtTime(1.8, now);

      // Multi-burst envelope for paper crunch texture
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.03);
      gain.gain.linearRampToValueAtTime(0.03, now + 0.1);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + duration);
    } catch (_) {}
  }

  /**
   * Soft melodious chime (played when timer finishes)
   */
  async playChimeSound() {
    await this.initSetting();
    if (!this.soundsEnabled) return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Two gentle harmonious chime bells: C5 (523.25Hz) and G5 (783.99Hz)
      const frequencies = [523.25, 783.99];

      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startDelay = idx * 0.12;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + startDelay);

        gain.gain.setValueAtTime(0.0001, now + startDelay);
        gain.gain.linearRampToValueAtTime(0.08, now + startDelay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + startDelay + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + startDelay);
        osc.stop(now + startDelay + 1.25);
      });
    } catch (_) {}
  }
}

window.soundEffects = new SoundEffects();
