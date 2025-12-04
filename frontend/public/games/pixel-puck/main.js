import { Engine } from './engine.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { AI } from './ai.js';
import { SFX } from './sfx.js';
import { ArcadeBridge } from './bridge.js';
import { mulberry32 } from './utils.js';

// Load map
const params = new URLSearchParams(window.location.search);
const mapName = params.get('map') || 'classic';
const seed = params.get('seed') || new Date().toISOString().split('T')[0]; // Daily seed default
const mode = params.get('mode') || '1p'; // 1p vs 2p

let mapData = null;

async function loadMap() {
    // If daily challenge (random map not authored), we generate it
    if (mapName === 'daily') {
        return generateMap(seed);
    }

    // Authored maps
    try {
        const res = await fetch(`./tracks/${mapName}.json`);
        return await res.json();
    } catch(e) {
        console.error("Failed to load map, falling back to classic", e);
        const res = await fetch(`./tracks/classic.json`);
        return await res.json();
    }
}

function generateMap(seedStr) {
    // Simple generator
    // Consistent with classic dimensions
    const rng = mulberry32(hashCode(seedStr));
    const obstacles = [];
    const tiles = [];

    const count = Math.floor(rng() * 4) + 2; // 2-5 obstacles
    for(let i=0; i<count; i++) {
        const isBumper = rng() > 0.5;
        const x = 2 + rng() * 8; // Keep away from goals
        const y = 1 + rng() * 6;

        if (isBumper) {
             obstacles.push({ x, y, radius: 0.3 + rng()*0.3 });
        } else {
             const type = rng() > 0.5 ? 'speed' : 'slow';
             tiles.push({ type, x: x-1, y: y-0.5, w: 2, h: 1 });
        }
    }

    return {
        gridW: 12,
        gridH: 8,
        walls: [],
        bumpers: obstacles,
        tiles: tiles,
        goals: [
            { "x": 0, "y": 2.5, "w": 0.5, "h": 3, "owner": 1 },
            { "x": 11.5, "y": 2.5, "w": 0.5, "h": 3, "owner": 2 }
        ],
        spawns: {
            "p1": { "x": 3, "y": 4 },
            "p2": { "x": 9, "y": 4 },
            "puck": { "x": 6, "y": 4 }
        }
    };
}

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

async function init() {
    mapData = await loadMap();

    const canvas = document.getElementById('gameCanvas');
    const engine = new Engine(mapData, seed);
    const renderer = new Renderer(canvas);
    const input = new Input(canvas, mapData.gridW, mapData.gridH);
    const sfx = new SFX();
    window.gameSFX = sfx; // Expose for Input to resume context
    const ai = mode === '1p' ? new AI(2) : null;

    ArcadeBridge.init();

    // Fit to window
    function handleResize() {
        renderer.resize(window.innerWidth, window.innerHeight, mapData.gridW, mapData.gridH);
    }
    window.addEventListener('resize', handleResize);
    handleResize();

    // Loop
    let lastTime = performance.now();
    let accumulator = 0;
    const DT = 1000 / 60;

    function loop(now) {
        const frameTime = now - lastTime;
        lastTime = now;
        accumulator += frameTime;

        // Physics Step
        while (accumulator >= DT) {
            let inputState = input.update(); // Get current input state

            // AI Override for P2 if 1p mode
            if (ai) {
                const aiMove = ai.update(DT/1000, engine);
                inputState.p2.moveVector = aiMove.moveVector;
                if (aiMove.dash) inputState.p2.dash = true;
            }

            engine.update(inputState);

            // Process SFX Events from engine
            while(engine.events.length > 0) {
                const e = engine.events.shift();
                if(sfx[e]) sfx[e]();
            }

            // Clear one-shot inputs handled by engine if necessary
            // e.g. input.resetDash() if we want strict one-tap
            input.resetDash();

            accumulator -= DT;
        }

        // Render
        renderer.draw(engine);

        if (!engine.gameOver) {
            requestAnimationFrame(loop);
        } else {
            // Submit Score
            ArcadeBridge.submitScore({
                winner: engine.winner === 1, // Assumes player is P1 in 1p mode or strictly P1
                goalsFor: engine.p1.score,
                goalsAgainst: engine.p2.score,
                timeMs: engine.timeMs,
                seed: seed
            });
            renderer.draw(engine); // Draw final state
        }
    }

    requestAnimationFrame(loop);
}

init();
