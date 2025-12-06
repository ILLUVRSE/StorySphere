export class AudioHandler {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicPlaying = false;
    this.nextNoteTime = 0;
    this.noteIndex = 0;
    this.tempo = 0.15; // Seconds per 16th note

    // Simple Arpeggio Pattern (Dm pentatonic-ish)
    // MIDI note numbers: 62 (D4), 65 (F4), 67 (G4), 69 (A4), 72 (C5), 74 (D5)
    this.sequence = [
       62, 0, 62, 0,  69, 0, 67, 0,
       65, 0, 62, 0,  72, 74, 69, 0,
       50, 0, 50, 0,  57, 0, 55, 0, // Bass octave lower
       62, 62, 65, 67, 69, 0, 0, 0
    ];

    window.addEventListener('keydown', () => this.init(), { once: true });
    window.addEventListener('click', () => this.init(), { once: true });
    window.addEventListener('touchstart', () => this.init(), { once: true });
  }

  init() {
      if (this.ctx) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
          this.ctx = new AudioContext();
          this.nextNoteTime = this.ctx.currentTime + 0.1;
      }
  }

  update(dt) {
      if (!this.ctx || !this.enabled) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const lookahead = 0.1;
      while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
          this.scheduleNote(this.sequence[this.noteIndex], this.nextNoteTime);
          this.nextNoteTime += this.tempo;
          this.noteIndex = (this.noteIndex + 1) % this.sequence.length;
      }
  }

  setTempo(factor) {
      // Base tempo 0.15s. Factor 1.0 -> 0.15. Factor 2.0 -> 0.075?
      // engine.tileAdvanceMs decreases.
      // let's map factor (0..1 progress) to tempo
      // range 0.15 to 0.10
      this.tempo = 0.15 - (factor * 0.05);
  }

  midiToFreq(m) {
      return 440 * Math.pow(2, (m - 69) / 12);
  }

  scheduleNote(note, time) {
      if (note === 0) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square'; // 8-bit sound
      osc.frequency.value = this.midiToFreq(note);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      gain.gain.setValueAtTime(0.05, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

      osc.start(time);
      osc.stop(time + 0.1);
  }

  play(type) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    if (type === 'move') {
      // Short blip
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);

    } else if (type === 'shoot') {
      // Laser PEW
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);

    } else if (type === 'enemy_hit') {
      // Noise hit
      this.playNoise(now, 0.1);

    } else if (type === 'enemy_die') {
      // Explosion
      this.playNoise(now, 0.3);
      // Descending tone
      const sub = this.ctx.createOscillator();
      sub.type = 'sawtooth';
      sub.frequency.setValueAtTime(200, now);
      sub.frequency.exponentialRampToValueAtTime(50, now + 0.3);
      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.1, now);
      subGain.gain.linearRampToValueAtTime(0, now + 0.3);
      sub.connect(subGain);
      subGain.connect(this.ctx.destination);
      sub.start(now);
      sub.stop(now + 0.3);

    } else if (type === 'pickup') {
      // Coin sound
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.setValueAtTime(1600, now + 0.1);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);

    } else if (type === 'crash') {
      this.playNoise(now, 0.5);
    }
  }

  playNoise(time, duration) {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      noise.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(time);
  }
}
