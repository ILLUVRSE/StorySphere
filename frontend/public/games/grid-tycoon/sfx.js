// sfx.js

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.enabled = true;
  }

  init() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3; // Default volume
    this.masterGain.connect(this.ctx.destination);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, startTime = 0) {
    if (!this.ctx || !this.enabled) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

    gain.gain.setValueAtTime(0.5, this.ctx.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + startTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(this.ctx.currentTime + startTime);
    osc.stop(this.ctx.currentTime + startTime + duration);
  }

  playBuild() {
    this.playTone(440, 'square', 0.1);
    this.playTone(660, 'square', 0.1, 0.1);
  }

  playRevenue() {
    this.playTone(880, 'sine', 0.15);
    this.playTone(1760, 'sine', 0.25, 0.1);
  }

  playError() {
    this.playTone(150, 'sawtooth', 0.2);
    this.playTone(100, 'sawtooth', 0.2, 0.1);
  }

  playWaveAlert() {
    this.playTone(300, 'triangle', 0.3);
    this.playTone(300, 'triangle', 0.3, 0.4);
  }
}
