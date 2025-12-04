export class AudioController {
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

    playDeal() {
        this.playTone(600, 'sine', 0.1, 0.05);
        setTimeout(() => this.playTone(800, 'sine', 0.1, 0.03), 50);
    }

    playChip() {
        this.playTone(1200, 'triangle', 0.05, 0.05);
    }

    playWin() {
        this.playTone(400, 'sine', 0.1);
        setTimeout(() => this.playTone(600, 'sine', 0.1), 100);
        setTimeout(() => this.playTone(800, 'sine', 0.2), 200);
    }

    playLose() {
        this.playTone(300, 'sawtooth', 0.2);
        setTimeout(() => this.playTone(200, 'sawtooth', 0.3), 150);
    }

    playPush() {
        this.playTone(400, 'square', 0.1);
        setTimeout(() => this.playTone(400, 'square', 0.1), 150);
    }
}
