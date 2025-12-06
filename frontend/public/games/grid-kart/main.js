import { Engine, Kart } from './engine.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { TrackGenerator } from './generator.js';
import { SFX } from './sfx.js';

export class Game {
    constructor() {
        this.engine = new Engine();
        this.renderer = new Renderer('gameCanvas');
        this.lastTime = 0;

        this.init();
    }

    init() {
        Input.init();

        // Load Map
        // Use daily seed or random
        const seed = new Date().toISOString().slice(0, 10);
        const mapData = TrackGenerator.generate(seed);
        this.engine.loadMap(mapData);
        this.renderer.buildMap(mapData);

        // Spawn Player
        this.player = new Kart(mapData.start);
        this.engine.addKart(this.player);
        this.renderer.createKart();

        // UI Setup
        document.getElementById('start-btn').addEventListener('click', () => {
            this.startRace();
        });

        document.getElementById('restart-btn').addEventListener('click', () => {
             location.reload();
        });

        // Start Loop
        requestAnimationFrame((t) => this.loop(t));
    }

    startRace() {
        document.getElementById('start-screen').classList.add('hidden');
        SFX.init(); // Unlock AudioContext
        this.engine.state = 'RUNNING';
    }

    loop(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 16.66, 2.0); // Cap dt
        this.lastTime = timestamp;

        if (this.engine.state === 'RUNNING') {
            // Update Physics
            // Substep for stability?
            this.engine.update(dt); // engine updates SFX
            this.player.update(Input.keys, this.engine.map, dt); // player physics

            // Update UI
            this.updateHUD();

            // Check Finish
            if (this.player.lap >= 3) { // 3 Laps
                this.finishRace();
            }
        }

        // Render
        this.renderer.update(this.player, dt);

        requestAnimationFrame((t) => this.loop(t));
    }

    updateHUD() {
        const speedKmh = Math.floor(Math.hypot(this.player.vx, this.player.vy) * 200);
        document.getElementById('speedometer').innerText = speedKmh + " KM/H";

        const mins = Math.floor(this.player.currentLapTime / 1000 / 60);
        const secs = Math.floor((this.player.currentLapTime / 1000) % 60);
        const ms = Math.floor((this.player.currentLapTime % 1000) / 10);
        document.getElementById('lap-timer').innerText =
            `TIME: ${mins}:${secs.toString().padStart(2,'0')}.${ms.toString().padStart(2,'0')}`;

        document.getElementById('lap-counter').innerText = `LAP: ${Math.min(this.player.lap + 1, 3)}/3`;

        // Drift Bar
        const bar = document.getElementById('drift-bar');
        const container = document.getElementById('drift-gauge-container');
        if (this.player.isDrifting) {
             container.style.display = 'block';
             let pct = 0;
             if (this.player.driftLevel === 0) pct = 33;
             if (this.player.driftLevel === 1) pct = 66;
             if (this.player.driftLevel === 2) pct = 100;
             bar.style.width = pct + '%';
             bar.style.backgroundColor = this.player.driftLevel === 2 ? '#ff3d00' : (this.player.driftLevel === 1 ? '#00e5ff' : '#00e676');
        } else {
             container.style.display = 'none';
        }
    }

    finishRace() {
        this.engine.state = 'FINISHED';
        document.getElementById('results-screen').classList.remove('hidden');

        // Sum times
        const total = this.player.lapTimes.reduce((a,b)=>a+b, 0);
        const mins = Math.floor(total / 1000 / 60);
        const secs = Math.floor((total / 1000) % 60);
        const ms = Math.floor((total % 1000) / 10);
        document.getElementById('final-time').innerText =
            `TOTAL: ${mins}:${secs.toString().padStart(2,'0')}.${ms.toString().padStart(2,'0')}`;
    }
}
