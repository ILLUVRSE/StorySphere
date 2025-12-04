export class UIManager {
  constructor(callbacks) {
      this.callbacks = callbacks;

      this.screens = {
          lobby: document.getElementById('lobby-screen'),
          gameover: document.getElementById('gameover-screen')
      };

      this.hud = {
          p1: document.getElementById('hud-p1'),
          timer: document.getElementById('hud-timer'),
          others: document.getElementById('hud-others'),
          remote: document.getElementById('btn-remote')
      };

      this.bindEvents();
  }

  bindEvents() {
      // Lobby
      document.getElementById('btn-start').addEventListener('click', () => {
          const total = parseInt(document.getElementById('select-total').value);
          const humans = parseInt(document.getElementById('select-humans').value);
          this.callbacks.onStart(total, humans);
      });

      // Game Over
      document.getElementById('btn-retry').addEventListener('click', () => {
          this.callbacks.onRetry();
      });

      document.getElementById('btn-menu').addEventListener('click', () => {
          this.showScreen('lobby');
      });
  }

  showScreen(name) {
      Object.values(this.screens).forEach(s => s.classList.add('hidden'));
      if (this.screens[name]) this.screens[name].classList.remove('hidden');
  }

  hideAllScreens() {
      Object.values(this.screens).forEach(s => s.classList.add('hidden'));
  }

  updateHUD(engine) {
      // Timer
      this.hud.timer.textContent = `TIME: ${Math.ceil(engine.timeLeft)}`;

      // P1 Status
      const p1 = engine.players.find(p => p.id === 1);
      if (p1) {
          this.hud.p1.textContent = p1.alive ? "P1: ALIVE" : "P1: DEAD";
          this.hud.p1.style.color = p1.alive ? '#00e676' : '#ff1744';

          // Show remote button if owned (Mobile only usually, but good visual indicator)
          if (p1.stats.hasRemote) {
              this.hud.remote.style.display = 'block';
          } else {
              this.hud.remote.style.display = 'none';
          }
      } else {
          this.hud.p1.textContent = "";
      }

      // Others
      const others = engine.players.filter(p => p.id !== 1 && p.alive).length;
      this.hud.others.textContent = `ENEMIES: ${others}`;
  }

  showGameOver(winner, score) {
      this.showScreen('gameover');
      const title = document.getElementById('go-title');
      const scoreTxt = document.getElementById('go-score');

      if (winner) {
          if (winner.isBot) {
              title.textContent = "Bot Wins!";
              title.style.color = '#ff1744';
          } else {
              title.textContent = `Player ${winner.id} Wins!`;
              title.style.color = '#ffd700';
          }
      } else {
          title.textContent = "Draw!";
          title.style.color = '#fff';
      }

      scoreTxt.textContent = `Score: ${score}`;
  }
}
