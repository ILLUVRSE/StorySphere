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

    step() {
        // High tick
        this.playTone(800, 'square', 0.05, 0.05);
    },

    alert() {
        // Warning blare
        this.playTone(150, 'sawtooth', 0.3, 0.2);
        setTimeout(() => this.playTone(100, 'sawtooth', 0.3, 0.2), 100);
    },

    loot() {
        // Coin sound
        this.playTone(1200, 'sine', 0.1, 0.1);
        setTimeout(() => this.playTone(1800, 'sine', 0.2, 0.1), 50);
    },

    win() {
        // Victory jingle
        this.playTone(400, 'sine', 0.2, 0.1);
        setTimeout(() => this.playTone(500, 'sine', 0.2, 0.1), 150);
        setTimeout(() => this.playTone(600, 'sine', 0.4, 0.1), 300);
    },

    fail() {
        // Sad trombone
        this.playTone(300, 'sawtooth', 0.4, 0.2);
        setTimeout(() => this.playTone(250, 'sawtooth', 0.4, 0.2), 300);
    }
};
