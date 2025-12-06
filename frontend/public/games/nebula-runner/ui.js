import { CONSTANTS } from './utils.js';

export class UI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.setupDOM();
  }

  setupDOM() {
    this.container.innerHTML = `
      <div id="hud" style="position: absolute; top: 10px; left: 10px; color: #ffd700; font-family: 'Press Start 2P', monospace; font-size: 16px; pointer-events: none; z-index: 10; text-shadow: 2px 2px #000;">
        <div>SCORE <span id="score">0</span></div>
        <div style="margin-top: 5px;">DIST <span id="dist">0</span>m</div>
        <div style="font-size: 8px; opacity: 0.7; margin-top: 4px;">SEED: <span id="seed-display"></span></div>
      </div>

      <div id="controls-hint" style="position: absolute; bottom: 10px; width: 100%; text-align: center; color: rgba(255,255,255,0.5); font-family: 'Press Start 2P', monospace; font-size: 8px; pointer-events: none;">
         DESKTOP: ARROWS MOVE / SPACE SHOOT<br>
         MOBILE: LEFT SIDE MOVE / RIGHT SIDE SHOOT
      </div>

      <div id="game-over" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #000; border: 4px solid #ffd700; padding: 20px; color: #fff; text-align: center; font-family: 'Press Start 2P', monospace; min-width: 280px; z-index: 20; box-shadow: 0 0 20px #000; pointer-events: auto; image-rendering: pixelated;">
        <h2 style="margin: 0 0 20px; color: #ff0000; text-transform: uppercase; font-size: 20px;">GAME OVER</h2>
        <div style="font-size: 16px; margin-bottom: 10px;">SCORE: <span id="final-score" style="color: #ffd700;">0</span></div>
        <div style="font-size: 10px; margin-bottom: 20px; opacity: 0.8;">DIST: <span id="final-dist">0</span>m</div>

        <div style="text-align: left; margin-bottom: 20px; background: #222; padding: 10px; border: 2px solid #555;">
            <div style="border-bottom: 2px solid #555; margin-bottom: 5px; font-size: 8px; color: #00e5ff;">TOP SCORES (SEED)</div>
            <div id="leaderboard" style="font-size: 8px; max-height: 100px; overflow-y: auto;"></div>
        </div>

        <button id="retry-btn" style="background: #ff0000; color: #fff; border: 4px solid #fff; padding: 12px 24px; font-family: 'Press Start 2P', monospace; cursor: pointer; font-size: 12px; text-transform: uppercase;">RETRY</button>
      </div>
    `;

    this.scoreEl = document.getElementById('score');
    this.distEl = document.getElementById('dist');
    this.seedEl = document.getElementById('seed-display');
    this.gameOverEl = document.getElementById('game-over');
    this.finalScoreEl = document.getElementById('final-score');
    this.finalDistEl = document.getElementById('final-dist');
    this.leaderboardEl = document.getElementById('leaderboard');
    this.retryBtn = document.getElementById('retry-btn');

    // Hide mobile hints on desktop if wanted, but simpler to show generic text
    // The visual hints overlay is removed in favor of text at bottom
  }

  updateHUD(score, distance, seed) {
    this.scoreEl.textContent = Math.floor(score);
    this.distEl.textContent = Math.floor(distance);
    if (seed) this.seedEl.textContent = seed;
  }

  showGameOver(score, distance, seed, onRetry) {
    this.gameOverEl.style.display = 'block';
    this.finalScoreEl.textContent = Math.floor(score);
    this.finalDistEl.textContent = Math.floor(distance);

    this.updateLocalLeaderboard(score, distance, seed);

    this.retryBtn.onclick = () => {
      this.gameOverEl.style.display = 'none';
      onRetry();
    };
  }

  updateLocalLeaderboard(score, distance, seed) {
    const key = 'nebula-runner:leaderboard';
    let data = [];
    try {
        data = JSON.parse(localStorage.getItem(key) || '[]');
    } catch(e) {}

    data.push({
        score: Math.floor(score),
        distance: Math.floor(distance),
        seed,
        date: new Date().toISOString()
    });

    data.sort((a, b) => b.score - a.score);
    if (data.length > 50) data = data.slice(0, 50);
    localStorage.setItem(key, JSON.stringify(data));

    const relevant = data.filter(d => d.seed === seed).slice(0, 5);

    if (relevant.length === 0) {
         this.leaderboardEl.innerHTML = '<div style="opacity: 0.5">No scores yet</div>';
    } else {
         this.leaderboardEl.innerHTML = relevant.map((d, i) =>
            `<div style="display: flex; justify-content: space-between; padding: 2px 0;">
                <span>${i+1}. ${d.score}</span>
                <span style="opacity: 0.7">${d.distance}m</span>
            </div>`
        ).join('');
    }
  }
}
