export class SFX {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
    }

    ensureContext() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
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

    playNoise(duration, vol = 0.1) {
         if (!this.enabled) return;
         const bufferSize = this.ctx.sampleRate * duration;
         const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
         const data = buffer.getChannelData(0);
         for (let i = 0; i < bufferSize; i++) {
             data[i] = Math.random() * 2 - 1;
         }

         const noise = this.ctx.createBufferSource();
         noise.buffer = buffer;
         const gain = this.ctx.createGain();
         gain.gain.setValueAtTime(vol, this.ctx.currentTime);
         gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

         noise.connect(gain);
         gain.connect(this.ctx.destination);
         noise.start();
    }

    hit() {
        this.playTone(200, 'square', 0.1, 0.1);
        this.playTone(100, 'sawtooth', 0.1, 0.1);
    }

    bumper() {
        this.playTone(400, 'triangle', 0.15, 0.15);
    }

    wall() {
        this.playTone(150, 'sine', 0.05, 0.2);
    }

    dash() {
        this.playNoise(0.2, 0.05);
    }

    goal() {
        // Celebratory arpeggio
        let now = this.ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.frequency.value = freq;
            osc.type = 'square';
            gain.gain.setValueAtTime(0.1, now + i*0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i*0.1 + 0.3);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + i*0.1);
            osc.stop(now + i*0.1 + 0.3);
        });
    }
}
