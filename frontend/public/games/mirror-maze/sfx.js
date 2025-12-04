export class SFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  ensureContext() {
    if (!this.enabled) return;
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, vol = 0.1) {
    if (!this.ctx) return;
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

  playRotate() {
    this.ensureContext();
    this.playTone(400, 'sine', 0.1, 0.1);
  }

  playHit() {
    this.ensureContext();
    // High ping for target hit
    this.playTone(880, 'triangle', 0.2, 0.1);
    setTimeout(() => this.playTone(1760, 'sine', 0.3, 0.05), 50);
  }

  playWin() {
    this.ensureContext();
    this.playTone(523.25, 'square', 0.2, 0.1); // C5
    setTimeout(() => this.playTone(659.25, 'square', 0.2, 0.1), 100); // E5
    setTimeout(() => this.playTone(783.99, 'square', 0.4, 0.1), 200); // G5
  }
}
