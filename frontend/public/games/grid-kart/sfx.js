// Procedural Audio Generator for Grid Kart
export const SFX = {
    ctx: null,
    engineOsc: null,
    engineGain: null,
    isInit: false,

    init: () => {
        if (SFX.isInit) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        SFX.ctx = new AudioContext();
        SFX.isInit = true;

        // Engine Loop
        SFX.engineOsc = SFX.ctx.createOscillator();
        SFX.engineOsc.type = 'sawtooth';
        SFX.engineGain = SFX.ctx.createGain();
        SFX.engineGain.gain.value = 0;

        // Lowpass filter for engine "muffle"
        const filter = SFX.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        SFX.engineOsc.connect(filter);
        filter.connect(SFX.engineGain);
        SFX.engineGain.connect(SFX.ctx.destination);

        SFX.engineOsc.start();
    },

    updateEngine: (rpmPercent) => {
        if (!SFX.ctx) return;
        // Pitch: 50Hz idle -> 200Hz max
        const freq = 60 + (rpmPercent * 140);
        SFX.engineOsc.frequency.setTargetAtTime(freq, SFX.ctx.currentTime, 0.1);

        // Volume: Idle 0.1 -> Max 0.3
        const vol = 0.1 + (rpmPercent * 0.15);
        SFX.engineGain.gain.setTargetAtTime(vol, SFX.ctx.currentTime, 0.1);
    },

    playBoost: () => {
        if (!SFX.ctx) return;
        const osc = SFX.ctx.createOscillator();
        const gain = SFX.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(200, SFX.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, SFX.ctx.currentTime + 0.3);

        gain.gain.setValueAtTime(0.2, SFX.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, SFX.ctx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(SFX.ctx.destination);
        osc.start();
        osc.stop(SFX.ctx.currentTime + 0.3);
    },

    playJump: () => {
        if (!SFX.ctx) return;
        const osc = SFX.ctx.createOscillator();
        const gain = SFX.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, SFX.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(500, SFX.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.2, SFX.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, SFX.ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(SFX.ctx.destination);
        osc.start();
        osc.stop(SFX.ctx.currentTime + 0.1);
    },

    playBump: () => {
        if (!SFX.ctx) return;
        const osc = SFX.ctx.createOscillator();
        const gain = SFX.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, SFX.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, SFX.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.3, SFX.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, SFX.ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(SFX.ctx.destination);
        osc.start();
        osc.stop(SFX.ctx.currentTime + 0.1);
    },

    playLap: () => {
        if (!SFX.ctx) return;
        const osc = SFX.ctx.createOscillator();
        const gain = SFX.ctx.createGain();

        // High pitched chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, SFX.ctx.currentTime); // A5
        osc.frequency.setValueAtTime(1760, SFX.ctx.currentTime + 0.1); // A6

        gain.gain.setValueAtTime(0.3, SFX.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, SFX.ctx.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(SFX.ctx.destination);
        osc.start();
        osc.stop(SFX.ctx.currentTime + 0.5);
    },

    playItem: () => {
        if (!SFX.ctx) return;
        const osc = SFX.ctx.createOscillator();
        const gain = SFX.ctx.createGain();

        // Magic shimmer
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, SFX.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(2000, SFX.ctx.currentTime + 0.2);

        gain.gain.setValueAtTime(0.3, SFX.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, SFX.ctx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(SFX.ctx.destination);
        osc.start();
        osc.stop(SFX.ctx.currentTime + 0.3);
    },

    playShoot: () => {
        if (!SFX.ctx) return;
        const osc = SFX.ctx.createOscillator();
        const gain = SFX.ctx.createGain();

        // Laser pew
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, SFX.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, SFX.ctx.currentTime + 0.2);

        gain.gain.setValueAtTime(0.2, SFX.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, SFX.ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(SFX.ctx.destination);
        osc.start();
        osc.stop(SFX.ctx.currentTime + 0.2);
    },

    playExplosion: () => {
        if (!SFX.ctx) return;
        const bufferSize = SFX.ctx.sampleRate * 0.5; // 0.5 sec
        const buffer = SFX.ctx.createBuffer(1, bufferSize, SFX.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = SFX.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = SFX.ctx.createGain();

        gain.gain.setValueAtTime(0.5, SFX.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, SFX.ctx.currentTime + 0.5);

        noise.connect(gain);
        gain.connect(SFX.ctx.destination);
        noise.start();
    }
};
