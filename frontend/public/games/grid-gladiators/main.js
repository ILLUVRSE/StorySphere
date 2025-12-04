import { Engine } from './engine.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { Sfx } from './sfx.js';
import { Bridge } from './bridge.js';
import { generateSeed } from './utils.js';

const canvas = document.getElementById('game-canvas');
const bridge = new Bridge();
const sfx = new Sfx();
const input = new Input();
const engine = new Engine(sfx, bridge);
const renderer = new Renderer(canvas);

let lastTime = 0;
const targetFPS = 60;
const timeStep = 1 / targetFPS;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  renderer.resize();
}

window.addEventListener('resize', resize);
resize();

// Init Game
const urlParams = new URLSearchParams(window.location.search);
const seed = urlParams.get('seed') ? parseInt(urlParams.get('seed')) : generateSeed();
const mode = urlParams.get('mode') || 'pve'; // pve or pvp

engine.init(seed, mode);

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  // We can just use dt directly for smooth movement or accumulate for fixed step
  // For MVP, variable timestep with clamped dt is often smoother for canvas
  const safeDt = Math.min(dt, 0.1);

  // Pass Input State to Engine
  input.update();

  // Handle Mouse Aim for P1
  if (input.mouse.active && engine.state) {
      const p1 = engine.state.entities.find(e => e.team === 0 && !e.isBot);
      if (p1) {
          const screenX = renderer.offsetX + p1.x * renderer.tileSize;
          const screenY = renderer.offsetY + p1.y * renderer.tileSize;
          const aim = input.getMouseAim(screenX, screenY);
          if (aim) {
              input.p1.aim = aim;
          }
      }
  }

  engine.update(safeDt, input);

  renderer.draw(engine.state, 1.0);

  requestAnimationFrame(loop);
}

// User Interaction for Audio Context
window.addEventListener('click', () => sfx.ensureContext(), { once: true });
window.addEventListener('keydown', () => sfx.ensureContext(), { once: true });

requestAnimationFrame(loop);
