// Procedural Audio
const AudioContext = window.AudioContext || window.webkitAudioContext;

export class SoundManager {
  constructor() {
    this.ctx = new AudioContext();
    this.enabled = true;
  }

  ensureContext() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, vol = 0.1) {
    if (!this.enabled) return;
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
  }

  playClick() {
    this.playTone(400, 'sine', 0.1, 0.1);
  }

  playFlip() {
    // White noise burst for card flip
    if (!this.enabled) return;
    const bufferSize = this.ctx.sampleRate * 0.1; // 0.1s
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    noise.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  playWin() {
    this.playTone(600, 'triangle', 0.1, 0.1);
    setTimeout(() => this.playTone(800, 'triangle', 0.2, 0.1), 100);
  }

  playLoss() {
    this.playTone(300, 'sawtooth', 0.3, 0.2);
    setTimeout(() => this.playTone(150, 'sawtooth', 0.4, 0.2), 200);
  }

  // --- NEW INTENSE SOUNDS ---

  playHeartbeat() {
    if (!this.enabled) return;
    // Two thuds: lub-dub
    const thud = (time) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(60, time);
        osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + 0.2);
    };
    thud(this.ctx.currentTime);
    thud(this.ctx.currentTime + 0.25);
  }

  playSting() {
    if (!this.enabled) return;
    // Dramatic impact
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Low rumble
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.5);
  }

  playCheer() {
      if (!this.enabled) return;
      // Filtered noise
      const duration = 2.0;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1000;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
  }

  playSadTrombone() {
      if (!this.enabled) return;
      const notes = [400, 380, 360, 340];
      let t = this.ctx.currentTime;
      notes.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, t);
          if (i === 3) {
            // Long slide on last note
             osc.frequency.linearRampToValueAtTime(200, t + 1.0);
             gain.gain.setValueAtTime(0.3, t);
             gain.gain.linearRampToValueAtTime(0, t + 1.0);
             osc.start(t);
             osc.stop(t + 1.0);
          } else {
             gain.gain.setValueAtTime(0.3, t);
             gain.gain.linearRampToValueAtTime(0, t + 0.3);
             osc.start(t);
             osc.stop(t + 0.3);
          }
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          t += 0.4;
      });
  }
}
