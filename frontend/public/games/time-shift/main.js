
import { Engine } from './engine.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { PUZZLES } from './puzzles.js';
import { ArcadeBridge } from './bridge.js';
import { SFX } from './sfx.js';
import { formatTime } from './utils.js';

const TICK_MS = 140;

let currentLevelIdx = 0;
let engine = null;
let renderer = null;
let input = null;
let loopId = null;
let lastTime = 0;
let accum = 0;

// Stats
let startTime = 0;
let totalRewinds = 0;
let gameActive = false;

function init() {
  const canvas = document.getElementById('gameCanvas');
  renderer = new Renderer(canvas);
  input = new Input();

  // UI Bindings
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('restart-btn').addEventListener('click', () => loadLevel(currentLevelIdx));
  document.getElementById('next-btn').addEventListener('click', nextLevel);

  // Mobile UI
  bindMobileControls();

  // Initial Screen
  showScreen('start-screen');

  // Init Audio Context on first interaction
  window.addEventListener('click', () => SFX.init(), { once: true });
  window.addEventListener('keydown', () => SFX.init(), { once: true });

  ArcadeBridge.sendReady();
}

function bindMobileControls() {
  // Simple D-pad logic
  const leftZone = document.getElementById('touch-left');
  const rightZone = document.getElementById('touch-right');
  const upZone = document.getElementById('touch-up');
  const downZone = document.getElementById('touch-down');
  const rewindZone = document.getElementById('touch-rewind');

  const handleTouch = (key) => {
    input.keys[key] = true;
    input.queue.push(getDir(key));
    setTimeout(() => input.keys[key] = false, 100);
  };

  const getDir = (key) => {
    if (key === 'ArrowUp') return {x:0, y:-1};
    if (key === 'ArrowDown') return {x:0, y:1};
    if (key === 'ArrowLeft') return {x:-1, y:0};
    if (key === 'ArrowRight') return {x:1, y:0};
    return null;
  };

  // Helpers
  const bind = (el, key) => {
    el.addEventListener('touchstart', (e) => { e.preventDefault(); handleTouch(key); });
  };

  if(leftZone) bind(leftZone, 'ArrowLeft');
  if(rightZone) bind(rightZone, 'ArrowRight');
  if(upZone) bind(upZone, 'ArrowUp');
  if(downZone) bind(downZone, 'ArrowDown');

  if (rewindZone) {
    rewindZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        input.keys['Space'] = true;
        input.rewindPressed = true;
    });
    rewindZone.addEventListener('touchend', (e) => {
        e.preventDefault();
        input.keys['Space'] = false;
        input.rewindPressed = false;
    });
  }
}

function startGame() {
  currentLevelIdx = 0;
  startTime = Date.now();
  totalRewinds = 0;
  loadLevel(0);
}

function loadLevel(idx) {
  if (idx >= PUZZLES.length) {
    finishGame();
    return;
  }

  currentLevelIdx = idx;
  const puzzle = PUZZLES[idx];

  engine = new Engine(puzzle, onLevelWin, onLevelFail);
  gameActive = true;

  input.clear();
  showScreen('ui-layer'); // Ensure UI is visible, hide others
  hideScreen('start-screen');
  hideScreen('results-screen');
  hideScreen('fail-screen');

  document.getElementById('level-info').innerText = `LEVEL ${idx + 1} / ${PUZZLES.length}`;
  document.getElementById('hint-text').innerText = puzzle.hint || "";

  if (loopId) cancelAnimationFrame(loopId);
  lastTime = performance.now();
  loop();
}

function onLevelWin() {
  gameActive = false;
  // Delay slightly
  setTimeout(() => {
    if (currentLevelIdx < PUZZLES.length - 1) {
        loadLevel(currentLevelIdx + 1);
    } else {
        finishGame();
    }
  }, 500);
}

function onLevelFail() {
  gameActive = false;
  showScreen('fail-screen');
}

function finishGame() {
  const timeMs = Date.now() - startTime;
  const score = Math.max(0, 10000 - Math.floor(timeMs / 100)); // Simple scoring

  document.getElementById('final-time').innerText = formatTime(timeMs);
  document.getElementById('final-score').innerText = score;

  showScreen('results-screen');

  ArcadeBridge.sendScore({
    score: score,
    timeMs: timeMs,
    rewinds: totalRewinds
  });
}

function nextLevel() {
    loadLevel(currentLevelIdx + 1);
}

function loop(timestamp) {
  if (!gameActive) return;

  const dt = timestamp - lastTime;
  lastTime = timestamp;
  accum += dt;

  // Fixed Tick
  while (accum >= TICK_MS) {
    if (input.isRewinding()) {
        totalRewinds++;
        engine.update(input);
        // If rewinding, consume tick time? Yes, to regulate speed.
    } else {
        engine.update(input);
    }
    accum -= TICK_MS;
  }

  renderer.draw(engine.state, engine.width, engine.height, input.isRewinding());

  // Update UI
  const totalTime = Date.now() - startTime;
  document.getElementById('timer').innerText = formatTime(totalTime);

  loopId = requestAnimationFrame(loop);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  if (id === 'ui-layer') document.getElementById('ui-layer').classList.remove('hidden'); // Logic fix
}

function hideScreen(id) {
  document.getElementById(id).classList.add('hidden');
}

window.onload = init;
