export class Sfx {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bgmOscs = [];
    this.isPlayingMusic = false;
    this.beatTimer = null;
  }

  ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3; // Low volume
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.isPlayingMusic) {
        this.startMusic();
    }
  }

  startMusic() {
      // Scheduling ahead system
      this.isPlayingMusic = true;
      let nextNoteTime = this.ctx.currentTime + 0.1;
      let beat = 0;
      const bpm = 130;
      const secondsPerBeat = 60.0 / bpm;

      const schedule = () => {
          if (!this.isPlayingMusic) return;

          // Schedule notes for next 100ms
          while (nextNoteTime < this.ctx.currentTime + 0.1) {
              this.playBeatAt(nextNoteTime, beat);
              nextNoteTime += secondsPerBeat;
              beat++;
          }
          this.beatTimer = setTimeout(schedule, 25);
      };
      schedule();
  }

  playBeatAt(time, beat) {
      if (!this.ctx) return;

      // Kick on 0, 2
      if (beat % 2 === 0) {
          this.playDrum(time, 150, 0.001, 0.1, 0.8, 'sine'); // Kick
      }

      // Snare on 1, 3
      if (beat % 2 === 1) {
         this.playNoise(time, 0.1, 0.4); // Snare
      }

      // Hi-hats every half beat
      this.playNoise(time, 0.05, 0.1); // Closed Hat

      // Bassline
      const bassNote = [55, 55, 65, 55][beat % 4];
      this.playTone(bassNote, 'sawtooth', 0.2, 0.2, time);
  }

  playDrum(time, freq, attack, decay, vol, type) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(0.01, time + decay);
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + decay);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + decay);
  }

  playNoise(time, duration, vol) {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, time);
      noise.connect(gain);
      gain.connect(this.masterGain);
      noise.start(time);
  }

  playTone(freq, type, duration, vol = 1.0, time = null) {
    if (!this.ctx) return;
    const t = time || this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + duration);
  }

  playTag() {
    // Sharp high pitch hit
    this.playTone(800, 'square', 0.1, 0.8);
    setTimeout(() => this.playTone(600, 'square', 0.1, 0.8), 50);
  }

  playInfect() {
    // Gloomy low slide
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  playPowerup() {
    // Rising major triad
    this.playTone(440, 'sine', 0.1);
    setTimeout(() => this.playTone(554, 'sine', 0.1), 100);
    setTimeout(() => this.playTone(659, 'sine', 0.2), 200);
  }

  playWin() {
    // Victory sequence
    this.playTone(523, 'square', 0.1);
    setTimeout(() => this.playTone(659, 'square', 0.1), 150);
    setTimeout(() => this.playTone(784, 'square', 0.1), 300);
    setTimeout(() => this.playTone(1046, 'square', 0.4), 450);
    // Stop music
    this.isPlayingMusic = false;
    if (this.beatTimer) clearTimeout(this.beatTimer);
  }

  playTeleport() {
      // Sci-fi warp
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.1);
      osc.frequency.linearRampToValueAtTime(200, this.ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
  }

  playHillMove() {
      // Notification sound
      this.playTone(600, 'sine', 0.1, 0.4);
      setTimeout(() => this.playTone(800, 'sine', 0.3, 0.2), 100);
  }
}
