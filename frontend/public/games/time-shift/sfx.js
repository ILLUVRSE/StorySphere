
export const SFX = {
  ctx: null,

  init() {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  playTone(freq, type, duration, vol = 0.1) {
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },

  move() {
    this.playTone(300, 'square', 0.1, 0.05);
  },

  bump() {
    this.playTone(150, 'sawtooth', 0.1, 0.1);
  },

  rewind() {
    // A rising/falling weird sound
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 0.1);
    osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  },

  win() {
    this.playTone(440, 'sine', 0.1, 0.1);
    setTimeout(() => this.playTone(554, 'sine', 0.1, 0.1), 100);
    setTimeout(() => this.playTone(659, 'sine', 0.2, 0.1), 200);
  },

  die() {
    this.playTone(100, 'sawtooth', 0.3, 0.2);
  }
};
