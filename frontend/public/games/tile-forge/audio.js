// Procedural Audio using Web Audio API

export class AudioHandler {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3; // Keep volume reasonable
        this.masterGain.connect(this.ctx.destination);
    }

    play(type) {
        if (this.ctx.state === 'suspended') this.ctx.resume();

        switch (type) {
            case 'match': this.playMatch(); break;
            case 'craft': this.playCraft(); break;
            case 'shoot': this.playShoot(); break;
            case 'hit': this.playHit(); break;
            case 'explosion': this.playExplosion(); break;
            case 'powerup': this.playPowerup(); break;
            case 'win': this.playWin(); break;
            case 'lose': this.playLose(); break;
        }
    }

    playMatch() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playCraft() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.2);

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playShoot() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.type = 'square';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playHit() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playExplosion() {
        // White noise buffer
        const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 sec
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

        noise.connect(gain);
        gain.connect(this.masterGain);
        noise.start();
    }

    playPowerup() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 0.1);
        osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.3);

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
    }

    playWin() {
        // Simple arpeggio
        const now = this.ctx.currentTime;
        [440, 554, 659, 880].forEach((freq, i) => {
             const osc = this.ctx.createOscillator();
             const gain = this.ctx.createGain();
             osc.connect(gain);
             gain.connect(this.masterGain);

             osc.type = 'square';
             osc.frequency.value = freq;
             gain.gain.setValueAtTime(0.2, now + i*0.1);
             gain.gain.linearRampToValueAtTime(0, now + i*0.1 + 0.2);

             osc.start(now + i*0.1);
             osc.stop(now + i*0.1 + 0.2);
        });
    }

    playLose() {
        const now = this.ctx.currentTime;
        [440, 415, 392, 370].forEach((freq, i) => {
             const osc = this.ctx.createOscillator();
             const gain = this.ctx.createGain();
             osc.connect(gain);
             gain.connect(this.masterGain);

             osc.type = 'sawtooth';
             osc.frequency.value = freq;
             gain.gain.setValueAtTime(0.2, now + i*0.2);
             gain.gain.linearRampToValueAtTime(0, now + i*0.2 + 0.3);

             osc.start(now + i*0.2);
             osc.stop(now + i*0.2 + 0.3);
        });
    }
}
