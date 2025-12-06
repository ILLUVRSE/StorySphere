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
        this.player = new Kart(mapData.start, false, this.engine);
        this.engine.addKart(this.player);

        // Spawn Bots
        for(let i=0; i<3; i++) {
             // Offset start positions slightly
             const offset = i + 1;
             const startPos = {
                 x: mapData.start.x + (i%2===0 ? -0.6 : 0.6) * Math.ceil(offset/2),
                 y: mapData.start.y - Math.floor((offset+1)/2) * 0.8,
                 angle: mapData.start.angle
             };
             const bot = new Kart(startPos, true, this.engine);
             this.engine.addKart(bot);
        }

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
            // Update Engine (Collision, Physics, Items, Projectiles)
            this.engine.update(dt);

            // Update Individual Karts
            this.engine.karts.forEach(k => {
                 k.update(Input.keys, this.engine.map, dt);
            });

            // Update UI
            this.updateHUD();

            // Check Finish
            if (this.player.lap > 3) { // Finished 3 laps
                this.finishRace();
            }
        }

        // Render
        this.renderer.update(this.player, this.engine.karts, this.engine.items, this.engine.projectiles, dt);

        requestAnimationFrame((t) => this.loop(t));
    }

    updateHUD() {
        // Speed
        const speedKmh = Math.floor(Math.hypot(this.player.vx, this.player.vy) * 200);
        document.getElementById('speedometer').innerText = speedKmh + " KM/H";

        // Time
        const mins = Math.floor(this.player.currentLapTime / 1000 / 60);
        const secs = Math.floor((this.player.currentLapTime / 1000) % 60);
        const ms = Math.floor((this.player.currentLapTime % 1000) / 10);
        document.getElementById('lap-timer').innerText =
            `TIME: ${mins}:${secs.toString().padStart(2,'0')}.${ms.toString().padStart(2,'0')}`;

        // Laps
        document.getElementById('lap-counter').innerText = `LAP: ${Math.min(this.player.lap + 1, 3)}/3`;

        // Rank
        const rankSuffix = ["st", "nd", "rd", "th"];
        const r = this.player.rank || 1;
        document.getElementById('rank-display').innerText = `${r}${rankSuffix[r-1] || "th"}`;

        // Item
        const itemBox = document.getElementById('item-slot');
        if (this.player.item) {
             if(this.player.item === 'TURBO') { itemBox.innerText = '⚡'; itemBox.style.color = '#ffea00'; }
             else if(this.player.item === 'MISSILE') { itemBox.innerText = '🚀'; itemBox.style.color = '#ff0000'; }
             else if(this.player.item === 'MINE') { itemBox.innerText = '💣'; itemBox.style.color = '#ffaa00'; }
        } else {
             itemBox.innerText = '';
        }

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

        // Show Final Rank
        const rankSuffix = ["st", "nd", "rd", "th"];
        const r = this.player.rank;
        document.getElementById('final-rank').innerText = `Finished ${r}${rankSuffix[r-1] || "th"}`;
    }
}
