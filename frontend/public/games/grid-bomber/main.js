import { GridEngine } from './engine.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';
import { UIManager } from './ui.js';
import { SoundManager } from './sfx.js';
import { Bridge } from './bridge.js';
import { BotController } from './ai.js';
import { CONSTANTS, getDailySeed } from './utils.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new Renderer(this.canvas);
    this.input = new InputManager();
    this.audio = new SoundManager();
    this.bridge = new Bridge();

    this.engine = null;
    this.bots = [];
    this.loopId = null;
    this.lastTime = 0;

    // Config
    this.totalPlayers = 4;
    this.humanCount = 1;

    this.ui = new UIManager({
        onStart: (total, humans) => this.startGame(total, humans),
        onRetry: () => this.startGame(this.totalPlayers, this.humanCount)
    });

    // Initial Setup
    this.bridge.sendReady(CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);
  }

  startGame(total, humans) {
      this.totalPlayers = total;
      this.humanCount = humans;

      const seed = getDailySeed() + '-' + Date.now(); // Unique seed per run? Or daily?
      // Spec says "One map template plus a random generator seeded by ?seed=".
      // But also "Daily/challenge maps are reproducible".
      // Let's use daily seed for the MAP layout, but maybe random spawn points?
      // For Arcade score integrity, usually the whole match should be seeded if possible,
      // but interactions diverge immediately.
      // I'll pass the seed to engine.

      this.engine = new GridEngine(seed);

      // Add Players
      // 0..humans-1 are Humans
      // humans..total-1 are Bots
      for (let i = 0; i < total; i++) {
          const isBot = i >= humans;
          const id = i + 1;
          this.engine.addPlayer(id, isBot, i); // i is spawn index 0..3
      }

      // Setup Bots
      this.bots = this.engine.players.filter(p => p.isBot).map(p => new BotController(p.id, this.engine));

      this.ui.showScreen(null); // Hide all
      this.lastTime = performance.now();
      this.loopId = requestAnimationFrame(t => this.loop(t));

      // Notify parent
      // this.bridge.sendReady? Already sent.
  }

  loop(now) {
      const dt = Math.min((now - this.lastTime) / 1000, 0.1); // Cap dt
      this.lastTime = now;

      if (!this.engine.gameOver) {
          // 1. Bot Updates
          this.bots.forEach(b => b.update(dt * 1000));

          // 2. Collect Inputs
          // Humans
          const inputs = this.input.getInputs(this.engine.players);

          // Bots
          this.bots.forEach(b => {
              inputs.push(b.getInput());
          });

          // 3. Engine Update
          // Track events for SFX
          const preBombs = this.engine.bombs.length;
          const preExplosions = this.engine.explosions.length;
          const prePowerups = this.engine.powerups.length;
          const preAlive = this.engine.players.filter(p => p.alive).length;

          this.engine.update(dt, inputs);
          this.engine.timeLeft -= dt;
          if (this.engine.timeLeft <= 0) {
             this.engine.gameOver = true;
             // Timeout: Winner is highest score? Or draw?
             // MVP: Draw if timeout.
          }

          // SFX Triggers
          if (this.engine.bombs.length > preBombs) this.audio.play('bomb_place');
          if (this.engine.explosions.length > preExplosions) this.audio.play('explode');
          if (this.engine.powerups.length < prePowerups) this.audio.play('powerup'); // Assuming pickup
          if (this.engine.players.filter(p => p.alive).length < preAlive) this.audio.play('die');

          this.ui.updateHUD(this.engine);

          if (this.engine.gameOver) {
              this.endGame();
          }
      }

      this.renderer.render(this.engine, dt);

      if (!this.engine.gameOver) {
          this.loopId = requestAnimationFrame(t => this.loop(t));
      }
  }

  endGame() {
      cancelAnimationFrame(this.loopId);

      const winner = this.engine.winner;
      const score = winner ? (winner.isBot ? 0 : 1000 + Math.floor(this.engine.timeLeft) * 10) : 0;

      this.ui.showGameOver(winner, score);

      if (winner && !winner.isBot) {
          this.bridge.sendScore(score, this.engine.seedStr, 120 - this.engine.timeLeft, {
             killed: this.totalPlayers - 1
          });
      }
  }
}

// Start
window.onload = () => {
    new Game();
};
