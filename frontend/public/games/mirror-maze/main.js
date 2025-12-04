import { Engine } from './engine.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { LevelGenerator } from './generator.js';
import { Bridge } from './bridge.js';
import { SFX } from './sfx.js';
import { Utils } from './utils.js';

const bridge = new Bridge();
const sfx = new SFX();
const utils = new Utils();

const canvas = document.getElementById('gameCanvas');
const engine = new Engine(8, 8);
const renderer = new Renderer(canvas);
const input = new Input(canvas, engine, sfx);
input.setRenderer(renderer);

const generator = new LevelGenerator();

let lastTime = 0;
let timeLeft = 60 * 1000;
let isGameOver = false;
let seed = '';

function getSeed() {
  const params = new URLSearchParams(window.location.search);
  return params.get('seed') || new Date().toISOString().split('T')[0];
}

function init() {
  seed = getSeed();
  const level = generator.generate(seed, 8, 8);
  engine.loadLevel(level);

  // Fit to screen
  const size = Math.min(window.innerWidth, window.innerHeight - 100);
  renderer.resize(window.innerWidth, window.innerHeight);
  renderer.tileSize = Math.floor(Math.min(window.innerWidth, window.innerHeight) / 10);

  bridge.sendReady(8, 8);
  requestAnimationFrame(loop);
}

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  if (!isGameOver && !engine.isWin) {
    timeLeft -= dt;
    if (timeLeft <= 0) {
       timeLeft = 0;
       isGameOver = true;
       // Lose
    }
  } else if (engine.isWin && !isGameOver) {
     isGameOver = true;
     sfx.playWin();
     // Score: Time remaining * 100 + move bonus
     const timeScore = Math.floor(timeLeft / 100);
     const moveBonus = Math.max(0, 500 - engine.rotateCount * 10);
     const score = timeScore + moveBonus;
     bridge.sendScore(score, seed, 60000 - timeLeft, { moves: engine.rotateCount });
  }

  // Engine Update (beams are updated on input, but animations might need tick)
  // engine.update(dt);

  renderer.draw(engine, dt);

  // Draw HUD
  const ctx = renderer.ctx;
  ctx.fillStyle = 'white';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Time: ${(timeLeft/1000).toFixed(1)}`, 10, 30);

  if (engine.isWin) {
     ctx.fillStyle = '#ffd700';
     ctx.font = '40px sans-serif';
     ctx.textAlign = 'center';
     ctx.fillText("CLEARED!", canvas.width/2, canvas.height/2);
  } else if (isGameOver) {
     ctx.fillStyle = '#ff5722';
     ctx.font = '40px sans-serif';
     ctx.textAlign = 'center';
     ctx.fillText("TIME UP", canvas.width/2, canvas.height/2);
  }

  requestAnimationFrame(loop);
}

window.addEventListener('resize', () => {
   renderer.resize(window.innerWidth, window.innerHeight);
   renderer.tileSize = Math.floor(Math.min(window.innerWidth, window.innerHeight) / 10);
});

init();
