// main.js
import { Engine } from './engine.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';
import { WaveManager } from './waves.js';
import { Bridge } from './bridge.js';
import { SoundManager } from './sfx.js';
import { mulberry32, getQueryParams } from './utils.js';

const canvas = document.getElementById('gameCanvas');
const params = getQueryParams();

// Seed PRNG
const seedStr = params.seed || new Date().toISOString().split('T')[0];
// Simple hash of seed string to integer
let seedVal = 0;
for(let i=0; i<seedStr.length; i++) seedVal = (seedVal << 5) - seedVal + seedStr.charCodeAt(i);
const rng = mulberry32(seedVal >>> 0);

// Components
const bridge = new Bridge();
const sfx = new SoundManager();
const waveManager = new WaveManager(rng);
const engine = new Engine(10, 10, rng, waveManager, bridge, sfx); // 10x10 Grid
const renderer = new Renderer(canvas, engine);
const input = new InputManager(canvas, engine, renderer);

// Init
bridge.init();
engine.init();
input.init();
renderer.resize();

window.addEventListener('resize', () => renderer.resize());

// Build Palette UI Logic
// We need to listen to keys 1-4 or clicks on the HUD?
// HUD clicks are part of canvas input?
// My InputManager only passes grid coordinates.
// The HUD is drawn on the canvas, so clicks there map to grid coords that might be off-grid or negative?
// Renderer `screenToGrid` returns coords. If they are outside 0..width, handleInput checks bounds.
// We need a way to select buildings.
// Let's add simple key listeners for now: 1, 2, 3.
window.addEventListener('keydown', (e) => {
    if (e.key === '1') engine.selectedBuildingType = 'house';
    if (e.key === '2') engine.selectedBuildingType = 'shop';
    if (e.key === '3') engine.selectedBuildingType = 'park';
    if (e.key === '4') engine.selectedBuildingType = 'road';
});

// Also handle clicks on the bottom palette area.
// We need to modify InputManager or Engine to detect palette clicks.
// For MVP, keys are safer.
// But mobile?
// Let's add a "palette" check in input/engine.
// The renderer knows where the palette is.
// Let's update `InputManager` to expose raw clicks or handle UI?
// Easier: update `InputManager` to just pass everything to Engine, or have a UI layer.
// Actually, let's keep it simple:
// Engine.handleInput will check if y is out of bounds? No, `getGridPos` returns grid coords.
// If I click the bottom of the screen, `getGridPos` returns y > 10.
// So in `engine.handleInput`, if y >= height, we can check UI.
// But `renderer` draws UI at absolute pixels relative to canvas bottom.
// `screenToGrid` converts to grid.
// It's better if `InputManager` handles UI clicks separately if we want robust UI.
// But for this MVP, I'll rely on Keyboard for Desktop.
// For Mobile/Touch, I really need touch controls for the palette.
// Let's inject a simple DOM overlay for the palette instead of Canvas UI?
// It's cleaner for "Input" handling.
// The prompt said "Input ... Build palette ...".
// Let's add a DOM overlay in index.html for the palette to ensure it works on mobile easily.

// Loop
let lastTime = 0;
function loop(timestamp) {
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  engine.update(timestamp);
  renderer.draw();

  requestAnimationFrame(loop);
}

// Start
// Wait for interaction for audio?
window.addEventListener('click', () => sfx.init(), { once: true });
window.addEventListener('touchstart', () => sfx.init(), { once: true });

requestAnimationFrame(loop);

// DOM Palette Setup
const palette = document.getElementById('palette');
if (palette) {
    const types = ['house', 'shop', 'park', 'road'];
    types.forEach(t => {
        const btn = document.createElement('button');
        btn.innerText = t.charAt(0).toUpperCase() + t.slice(1);
        btn.className = 'palette-btn';
        btn.onclick = (e) => {
            e.stopPropagation(); // Prevent canvas click
            engine.selectedBuildingType = t;
            // Update visuals
            document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
        palette.appendChild(btn);
    });
}
