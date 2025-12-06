import { Engine } from './engine.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { Sfx } from './sfx.js';
import { Bridge } from './bridge.js';
import { generateSeed } from './utils.js';

const sfx = new Sfx();
const bridge = new Bridge();

const canvas = document.getElementById('game-canvas');
const engine = new Engine(sfx, bridge);
const renderer = new Renderer(canvas);
const input = new Input();

let lastTime = 0;
let isRunning = false;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  renderer.resize();
}

window.addEventListener('resize', resize);
resize();

// Loop
function loop(timestamp) {
  if (!isRunning) return;

  if (!lastTime) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  const safeDt = Math.min(dt, 0.1);

  input.update();
  engine.update(safeDt, input);
  renderer.draw(engine.state, 1.0);

  if (engine.state.gameOver) {
      // Just keep drawing for a bit or show overlay
      // For now loop continues to show Game Over screen drawn by renderer
  }

  requestAnimationFrame(loop);
}

// Lobby Logic
const lobby = document.getElementById('lobby');
const startBtn = document.getElementById('start-btn');
const modeSelect = document.getElementById('mode-select');
const playerSelect = document.getElementById('player-select');
const classSelect = document.getElementById('class-select');

startBtn.addEventListener('click', () => {
    const seed = generateSeed();
    const mode = modeSelect.value;
    const players = parseInt(playerSelect.value);
    const p1Class = classSelect.value;

    lobby.classList.add('hidden');

    engine.init(seed, mode, players, true, p1Class);
    isRunning = true;
    lastTime = 0;

    // Sfx init
    sfx.ensureContext();

    requestAnimationFrame(loop);
});

// Restart listener (simple refresh for now or reload logic)
// To make it nicer, we can add a listener for Enter to restart if Game Over
window.addEventListener('keydown', (e) => {
    if (engine.state && engine.state.gameOver && e.key === 'Enter') {
        window.location.reload();
    }
});
