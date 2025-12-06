import { WheelEngine } from './engine.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { mulberry32, getDailySeed, shuffle } from './utils.js';
import * as SFX from './sfx.js';
import './bridge.js';

let engine, renderer, input;
let lastTime = 0;
let puzzles = [];
let rng;

async function preInit() {
    // Load Puzzles
    try {
        const resp = await fetch('puzzles/puzzles.json');
        const data = await resp.json();
        puzzles = data;
    } catch (e) {
        console.error("Failed to load puzzles", e);
        puzzles = [{ category: 'ERROR', text: 'RELOAD GAME' }];
    }

    // Determine Mode/Seed
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode') || 'daily'; // 'daily' or 'arcade'

    let seedVal;
    if (mode === 'daily') {
        seedVal = getDailySeed();
    } else {
        seedVal = Date.now();
    }

    // RNG
    rng = mulberry32(seedVal);
    shuffle(puzzles, rng);
}

// Global startGame called by HTML overlay
window.startGame = function() {
    // Gather names
    const inputs = document.querySelectorAll('#name-inputs input');
    const names = Array.from(inputs).map(inp => inp.value.trim() || "PLAYER");

    // Hide overlay
    document.getElementById('setup-overlay').style.display = 'none';

    // Init Engine
    engine = new WheelEngine(puzzles, rng, names);

    // Setup Renderer
    const canvas = document.getElementById('game-canvas');
    renderer = new Renderer(canvas, engine);
    renderer.resize();
    window.addEventListener('resize', () => renderer.resize());

    // Setup Input
    input = new InputHandler(engine, renderer);

    // Start Loop
    requestAnimationFrame(loop);
}

function loop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    if (engine) {
        engine.update();
        input.update();
        renderer.draw();

        // Handle Effects
        if (engine.lastEffect) {
            const fx = engine.lastEffect;
            if (fx.type === 'SHAKE') {
                renderer.triggerShake(fx.amount || 10);
            } else if (fx.type === 'PARTICLES') {
                // Use center of screen by default if no coords provided
                const x = fx.x || renderer.canvas.width / 2;
                const y = fx.y || renderer.canvas.height / 2;
                renderer.spawnParticles(x, y, fx.color || '#fff', fx.count || 20);
            }
            engine.lastEffect = null; // Clear
        }

        // Check game over
        if (engine.state === 'GAME_OVER') {
            if (!engine.scoreSent) {
                engine.scoreSent = true;
                // Determine winner score for leaderboard
                const winner = engine.players.reduce((prev, current) => (prev.bank > current.bank) ? prev : current);
                window.parent.postMessage({
                    type: 'arcade-score',
                    score: winner.bank
                }, '*');
            }
        }
    }

    requestAnimationFrame(loop);
}

window.onload = preInit;
