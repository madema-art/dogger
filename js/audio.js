// Dogger sound effects. Nothing is loaded from disk: every cue is synthesised with WebAudio.
// Forward hops climb a pentatonic ladder, so a long run across the street sounds like a melody.
(function (global) {
  'use strict';

  const PENTA = [0, 2, 4, 7, 9];

  class Sound {
    constructor() {
      this.ctx = null;
      this.master = null;
    }

    // Browsers only allow audio after a user gesture, so this runs from input handlers.
    unlock() {
      if (!this.ctx) {
        const AudioCtx = global.AudioContext || global.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        const limiter = this.ctx.createDynamicsCompressor();
        limiter.threshold.value = -14;
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(limiter);
        limiter.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    get clock() {
      return this.ctx ? this.ctx.currentTime : 0;
    }

    tone({ freq, slideTo = null, dur = 0.15, type = 'sine', vol = 0.3, delay = 0 }) {
      if (!this.ctx) return;
      const t = this.clock + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }

    noise({ dur = 0.2, vol = 0.2, type = 'bandpass', f0 = 1200, f1 = null, q = 1, delay = 0 }) {
      if (!this.ctx) return;
      const t = this.clock + delay;
      const length = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = type;
      filter.Q.value = q;
      filter.frequency.setValueAtTime(f0, t);
      if (f1) filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t);
      src.stop(t + dur + 0.05);
    }

    arp(freqs, { step = 0.09, dur = 0.3, type = 'triangle', vol = 0.26, delay = 0 } = {}) {
      freqs.forEach((f, i) => this.tone({ freq: f, dur, type, vol, delay: delay + i * step }));
    }

    // ---- movement ----

    // A new row climbs the scale. `step` is the number of new rows reached in this crossing.
    hop(step) {
      const octave = Math.min(Math.floor(step / 5), 3);
      const freq = 392 * 2 ** (PENTA[step % 5] / 12) * 2 ** octave;
      this.tone({ freq, slideTo: freq * 1.25, dur: 0.11, type: 'triangle', vol: 0.22 });
      this.noise({ dur: 0.05, vol: 0.05, type: 'highpass', f0: 2500 });
    }

    backstep() {
      this.tone({ freq: 330, slideTo: 220, dur: 0.12, type: 'triangle', vol: 0.18 });
    }

    sidestep() {
      this.tone({ freq: 260, slideTo: 300, dur: 0.07, type: 'sine', vol: 0.14 });
    }

    blocked() {
      this.tone({ freq: 170, slideTo: 90, dur: 0.14, type: 'square', vol: 0.07 });
      this.noise({ dur: 0.07, vol: 0.09, f0: 700, q: 2 });
    }

    // ---- rewards ----

    // Bone chimes climb with the combo, so chaining pickups feels like winning a melody.
    bone(combo) {
      const step = Math.min(combo - 1, 14);
      const freq = 659 * 2 ** (PENTA[step % 5] / 12) * 2 ** Math.floor(step / 5);
      this.tone({ freq, dur: 0.2, type: 'sine', vol: 0.28 });
      this.tone({ freq: freq * 1.5, dur: 0.26, type: 'triangle', vol: 0.16, delay: 0.05 });
      this.tone({ freq: freq * 2, dur: 0.34, type: 'sine', vol: 0.1, delay: 0.1 });
    }

    closeCall() {
      this.noise({ dur: 0.3, vol: 0.22, type: 'bandpass', f0: 2600, f1: 500, q: 1.2 });
      this.tone({ freq: 880, slideTo: 1320, dur: 0.12, type: 'sine', vol: 0.14, delay: 0.08 });
    }

    crossing() {
      this.arp([523, 659, 784, 1047], { step: 0.07, dur: 0.38, type: 'triangle', vol: 0.24 });
    }

    extraLife() {
      this.arp([784, 988, 1175, 1568], { step: 0.06, dur: 0.3, type: 'sine', vol: 0.26 });
    }

    levelClear() {
      this.arp([523, 659, 784, 1047, 1319], { step: 0.085, dur: 0.3, type: 'triangle', vol: 0.24 });
      this.arp([523, 659, 784, 1047], { step: 0, dur: 0.9, type: 'sine', vol: 0.12, delay: 0.5 });
      this.noise({ dur: 0.5, vol: 0.06, type: 'highpass', f0: 4000, delay: 0.4 });
    }

    win() {
      this.arp([523, 523, 523, 659, 523, 659, 784], { step: 0.11, dur: 0.25, type: 'square', vol: 0.11 });
      this.arp([523, 659, 784, 1047], { step: 0, dur: 1.4, type: 'triangle', vol: 0.2, delay: 0.85 });
      this.noise({ dur: 0.7, vol: 0.07, type: 'highpass', f0: 3500, delay: 0.85 });
    }

    // ---- flow ----

    countdown(final) {
      if (final) this.arp([880, 1320], { step: 0.07, dur: 0.3, type: 'square', vol: 0.14 });
      else this.tone({ freq: 440, dur: 0.12, type: 'square', vol: 0.12 });
    }

    start() {
      this.arp([523, 659, 784, 1047], { step: 0.06, dur: 0.25, type: 'square', vol: 0.1 });
    }

    pause() {
      this.tone({ freq: 600, slideTo: 400, dur: 0.12, type: 'square', vol: 0.08 });
    }

    resume() {
      this.tone({ freq: 400, slideTo: 600, dur: 0.12, type: 'square', vol: 0.08 });
    }

    gamepad() {
      this.arp([660, 990], { step: 0.08, dur: 0.2, type: 'sine', vol: 0.2 });
    }

    // ---- failure ----

    hit() {
      this.tone({ freq: 240, slideTo: 60, dur: 0.32, type: 'sine', vol: 0.38 });
      this.noise({ dur: 0.22, vol: 0.28, type: 'lowpass', f0: 1400, f1: 200, q: 0.7 });
      this.tone({ freq: 760, slideTo: 300, dur: 0.22, type: 'sawtooth', vol: 0.08, delay: 0.02 });
    }

    gameOver() {
      this.arp([392, 349, 311, 262], { step: 0.3, dur: 0.45, type: 'triangle', vol: 0.24 });
    }
  }

  global.Dogger = global.Dogger || {};
  global.Dogger.Sound = Sound;
})(window);
