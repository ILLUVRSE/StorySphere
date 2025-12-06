import { GridEngine } from './gridEngine.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { Bridge } from './bridge.js';
import { UI } from './ui.js';
import { getDailySeed } from './utils.js';
import { AudioHandler } from './audio.js';

const params = new URLSearchParams(window.location.search);
const seed = params.get('seed') || getDailySeed();

const bridge = new Bridge('nebula-runner');
const ui = new UI('ui-layer');
const input = new InputHandler();
const audio = new AudioHandler();
const canvas = document.getElementById('game-canvas');
const renderer = new Renderer(canvas);

let engine;
let lastTime = 0;
let tickAccumulator = 0;
let gameActive = false;
let startTime = 0;

function init() {
    bridge.sendReady(canvas.width, canvas.height);

    // Instructions Overlay
    // We reuse existing UI structure or just start
    startGame();
    requestAnimationFrame(loop);
}

function startGame() {
    engine = new GridEngine(seed);
    input.reset();
    gameActive = true;
    tickAccumulator = 0;
    lastTime = performance.now();
    startTime = Date.now();
    ui.gameOverEl.style.display = 'none';
    ui.updateHUD(0, 0, seed);
    audio.musicPlaying = true;
}

function loop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    if (gameActive) {
        // Continuous Updates
        audio.update(dt);

        // Engine Update (Entities)
        const updateRes = engine.update(dt, input.getFireState(), timestamp);
        if (updateRes.events) processEvents(updateRes.events);

        // Grid Tick
        tickAccumulator += dt;
        if (tickAccumulator >= engine.tileAdvanceMs) {
            const move = input.popMove();
            const res = engine.advanceColumn(move);

            if (res.events) processEvents(res.events);

            if (res && res.gameOver) {
                audio.play('crash');
                gameOver(res.crashType);
            }

            tickAccumulator -= engine.tileAdvanceMs;

            // Adjust music tempo based on speed
            // Base is 200ms. If we are at 100ms, tempo is faster.
            const speedFactor = 1.0 - ((engine.tileAdvanceMs - 100) / 100);
            // 200ms -> factor 0. 100ms -> factor 1.
            audio.setTempo(speedFactor);

            ui.updateHUD(engine.score, engine.distance, seed);
        }
    }

    // Render
    const progress = Math.min(1, Math.max(0, tickAccumulator / engine.tileAdvanceMs));
    renderer.render(engine, dt, progress, input.queuedMove);

    requestAnimationFrame(loop);
}

function processEvents(events) {
    events.forEach(e => {
        // Events are objects now { type: ... }
        const type = e.type || e;

        if (type === 'move') audio.play('move');
        if (type === 'pickup') audio.play('pickup');
        if (type === 'shoot') audio.play('shoot');
        if (type === 'enemy_hit') {
            audio.play('enemy_hit');
            // Visual?
        }
        if (type === 'enemy_die') {
             audio.play('enemy_die');
             // Add explosion visual
             // Coords in grid space. Renderer expects pixel space?
             // Renderer.addExplosion uses pixels.
             // We need to convert grid (col, row) to pixels.
             // But we need the current 'scroll' offset if we want it perfect?
             // Yes, or approximate. The explosion is brief.
             // However, renderer.addExplosion takes X,Y.
             const x = e.x * renderer.tileW;
             const y = e.row * renderer.tileH;
             renderer.addExplosion(x, y);
        }
        if (type === 'shield_break') audio.play('warning');
    });
}

function gameOver(crashType) {
    gameActive = false;
    const durationMs = Date.now() - startTime;
    bridge.sendScore(engine.score, seed, durationMs, { crashType, distance: engine.distance });
    ui.showGameOver(engine.score, engine.distance, seed, () => {
        startGame();
    });
}

init();
