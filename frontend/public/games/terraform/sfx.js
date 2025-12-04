// Procedural audio generation using Web Audio API

export class Sfx {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.enabled = true;
  }

  ensureContext() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, vol = 0.1) {
    if (!this.enabled) return;
    this.ensureContext();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playPlant() {
    // Soft pluck
    this.playTone(400 + Math.random() * 50, 'triangle', 0.1, 0.1);
  }

  playMerge(tier) {
    // Ascending chime based on tier
    const baseFreq = 440;
    const freq = baseFreq * Math.pow(1.5, tier - 1);
    this.playTone(freq, 'sine', 0.3, 0.15);
    // Add a second harmonic for richness
    setTimeout(() => this.playTone(freq * 1.5, 'sine', 0.3, 0.1), 50);
  }

  playHarvest(count, maxTier) {
    // Major chord arpeggio
    const base = 440 + (maxTier * 50);
    this.playTone(base, 'square', 0.2, 0.1);
    setTimeout(() => this.playTone(base * 1.25, 'square', 0.2, 0.1), 100);
    setTimeout(() => this.playTone(base * 1.5, 'square', 0.4, 0.1), 200);
  }

  playError() {
    this.playTone(150, 'sawtooth', 0.2, 0.1);
  }

  playCombo() {
    // High pitched burst
    this.playTone(880, 'sine', 0.1, 0.1);
    setTimeout(() => this.playTone(1760, 'sine', 0.2, 0.1), 50);
  }
}
