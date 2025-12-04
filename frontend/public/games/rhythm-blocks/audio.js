// Procedural Audio Engine

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isPlaying = false;
    this.startTime = 0;
    this.bpm = 120;
    this.beatDuration = 60 / 120; // seconds
    this.lookahead = 25.0; // ms to look ahead for scheduling
    this.scheduleAheadTime = 0.1; // sec to schedule ahead
    this.nextNoteTime = 0.0;
    this.timerID = null;
    this.currentBeat = 0;

    // Drum Patterns
    this.patterns = {
      kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
    };
  }

  init() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);
    console.log("[Audio] Initialized");
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // Synthesis methods
  createKick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

    osc.start(time);
    osc.stop(time + 0.5);
  }

  createSnare(time) {
    const noiseBuffer = this.createNoiseBuffer();
    const node = this.ctx.createBufferSource();
    node.buffer = noiseBuffer;

    const gain = this.ctx.createGain();
    // Bandpass filter for snare snap
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1000;

    node.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    node.start(time);
    node.stop(time + 0.2);
  }

  createHiHat(time) {
    // Uses a fundamental frequency ratio spectrum for metallic sound
    const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 10000;

    const gain = this.ctx.createGain();

    ratios.forEach(ratio => {
        const osc = this.ctx.createOscillator();
        osc.type = "square";
        osc.frequency.value = 40 * ratio;
        osc.connect(bandpass);
        osc.start(time);
        osc.stop(time + 0.1);
    });

    bandpass.connect(gain);
    gain.connect(this.masterGain);

    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
  }

  createNoiseBuffer() {
    if (this._noiseBuffer) return this._noiseBuffer;
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this._noiseBuffer = buffer;
    return buffer;
  }

  // Play SFX (Hit sounds)
  playHitSound(type) {
    if (!this.ctx) return;
    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);

    if (type === 'perfect') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, time); // A5
        osc.frequency.exponentialRampToValueAtTime(1760, time + 0.1);
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.linearRampToValueAtTime(0, time + 0.1);
    } else if (type === 'great') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, time); // A4
        gain.gain.setValueAtTime(0.15, time);
        gain.gain.linearRampToValueAtTime(0, time + 0.1);
    } else if (type === 'good') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, time); // A3
        gain.gain.setValueAtTime(0.05, time);
        gain.gain.linearRampToValueAtTime(0, time + 0.05);
    }

    osc.start(time);
    osc.stop(time + 0.1);
  }

  // Scheduling Loop
  scheduler() {
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentBeat, this.nextNoteTime);
      this.nextNote();
    }
    if (this.isPlaying) {
        this.timerID = requestAnimationFrame(this.scheduler.bind(this));
    }
  }

  nextNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    // 16th notes
    this.nextNoteTime += 0.25 * secondsPerBeat;
    this.currentBeat++;
    if (this.currentBeat === 16) {
      this.currentBeat = 0;
    }
  }

  scheduleNote(beatNumber, time) {
    if (this.patterns.kick[beatNumber]) this.createKick(time);
    if (this.patterns.snare[beatNumber]) this.createSnare(time);
    if (this.patterns.hihat[beatNumber]) this.createHiHat(time);
  }

  play(bpm = 120) {
    this.bpm = bpm;
    this.currentBeat = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.isPlaying = true;
    this.startTime = this.ctx.currentTime;
    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    cancelAnimationFrame(this.timerID);
  }

  // Exposed master time in ms
  getCurrentTimeMs() {
    if (!this.ctx || !this.isPlaying) return 0;
    return (this.ctx.currentTime - this.startTime) * 1000;
  }
}

window.AudioEngine = AudioEngine;
