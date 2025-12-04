import { GameEngine } from './engine.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { Bridge } from './bridge.js';
import { Sfx } from './sfx.js';

const canvas = document.getElementById('gameCanvas');
const bridge = new Bridge();
const sfx = new Sfx();
const game = new GameEngine(bridge, sfx);
const renderer = new Renderer(canvas);
const input = new InputHandler(canvas, game, renderer);

function resize() {
  const container = document.getElementById('game-container');
  const aspect = 3/4;
  let w = container.clientWidth;
  let h = container.clientHeight;

  if (w / h > aspect) {
    w = h * aspect;
  } else {
    h = w / aspect;
  }

  canvas.width = w;
  canvas.height = h;
  renderer.resize();
}

window.addEventListener('resize', resize);
resize();

// Game Loop
function loop(time) {
  game.update(time);
  renderer.render(game);
  requestAnimationFrame(loop);
}

// Start
game.start();
requestAnimationFrame(loop);
