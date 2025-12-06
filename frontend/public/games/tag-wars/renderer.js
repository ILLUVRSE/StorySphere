export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.tileSize = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.colors = {
      wall: '#263238',
      floor: '#37474f',
      slow: '#5d4037',
      fast: '#004d40',
      trap: '#b71c1c',
      bounce: '#ff6f00',
      ice: '#81d4fa'
    };
  }

  resize() {
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    // Scale 9x7 grid to fit screen
    const aspect = 9 / 7;
    const screenAspect = this.width / this.height;

    if (screenAspect > aspect) {
      this.tileSize = this.height / 7;
      this.offsetX = (this.width - (this.tileSize * 9)) / 2;
      this.offsetY = 0;
    } else {
      this.tileSize = this.width / 9;
      this.offsetX = 0;
      this.offsetY = (this.height - (this.tileSize * 7)) / 2;
    }
  }

  draw(state, alpha) {
    if (!state) return;

    this.ctx.fillStyle = '#102027'; // BG
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);

    // Draw Map
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        const tile = state.grid[y][x];
        const px = x * this.tileSize;
        const py = y * this.tileSize;

        // Base
        this.ctx.fillStyle = this.colors.floor;
        if (tile.type === 1) this.ctx.fillStyle = this.colors.wall;
        else if (tile.type === 2) this.ctx.fillStyle = this.colors.slow;
        else if (tile.type === 3) this.ctx.fillStyle = this.colors.fast;
        else if (tile.type === 4) this.ctx.fillStyle = this.colors.trap;
        else if (tile.type === 5) this.ctx.fillStyle = this.colors.bounce;
        else if (tile.type === 6) this.ctx.fillStyle = this.colors.ice;

        this.ctx.fillRect(px, py, this.tileSize, this.tileSize);

        // Grid lines
        this.ctx.strokeStyle = '#00000033';
        this.ctx.strokeRect(px, py, this.tileSize, this.tileSize);

        // Trap active indicator
        if (tile.type === 4 && tile.timer > 0) {
             this.ctx.fillStyle = '#ff0000';
             this.ctx.globalAlpha = 0.5;
             this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
             this.ctx.globalAlpha = 1.0;
        }
      }
    }

    // Draw KotH Hill
    if (state.mode === 'koth' && state.hill) {
        const hx = state.hill.x * this.tileSize;
        const hy = state.hill.y * this.tileSize;
        const hr = state.hill.radius * this.tileSize;

        this.ctx.beginPath();
        this.ctx.arc(hx, hy, hr, 0, Math.PI*2);
        this.ctx.fillStyle = 'rgba(255, 215, 0, 0.3)'; // Gold area
        this.ctx.fill();
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = '#ffd700';
        this.ctx.stroke();
    }

    // Draw Powerups
    state.powerups.forEach(p => {
        const px = p.x * this.tileSize; // center is handled by drawing circle
        const py = p.y * this.tileSize;

        // We need center coords, but p.x/y are logical coords (0.5 centers)
        // Wait, engine uses x+0.5 for centers.
        // So p.x is center.

        const cx = p.x * this.tileSize; // p.x is e.g. 1.5
        const cy = p.y * this.tileSize;
        const r = this.tileSize * 0.3;

        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r, 0, Math.PI*2);

        let color = '#fff';
        let icon = '?';
        if (p.type === 'speed') { color = '#00e676'; icon = '⚡'; }
        else if (p.type === 'shield') { color = '#2979ff'; icon = '🛡️'; }
        else if (p.type === 'invis') { color = '#b0bec5'; icon = '👻'; }
        else if (p.type === 'teleport') { color = '#ab47bc'; icon = '🌀'; }

        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = '#fff';
        this.ctx.stroke();

        // Icon
        this.ctx.fillStyle = '#000';
        this.ctx.font = `${this.tileSize*0.4}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(icon, cx, cy);
    });

    // Draw Particles
    if (state.particles) {
        state.particles.forEach(p => {
            const px = p.x * this.tileSize;
            const py = p.y * this.tileSize;
            const size = p.size * this.tileSize;
            this.ctx.globalAlpha = p.life / p.maxLife;
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(px - size/2, py - size/2, size, size);
        });
        this.ctx.globalAlpha = 1.0;
    }

    // Draw Players
    state.entities.forEach(e => {
        const cx = e.x * this.tileSize;
        const cy = e.y * this.tileSize;
        const r = this.tileSize * 0.35;

        // Ghost check
        const isGhost = e.effects.some(ef => ef.type === 'invis');
        if (isGhost) {
            this.ctx.globalAlpha = 0.4;
        }

        // Glow for IT
        if (e.isIt) {
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#ff1744';
        }

        this.ctx.beginPath();

        // Shape based on Class
        if (e.className === 'speedster') {
             // Triangle
             this.ctx.moveTo(cx, cy - r);
             this.ctx.lineTo(cx + r, cy + r);
             this.ctx.lineTo(cx - r, cy + r);
             this.ctx.closePath();
        } else if (e.className === 'tank') {
             // Square
             this.ctx.rect(cx - r, cy - r, r*2, r*2);
        } else {
             // Circle (Balanced)
             this.ctx.arc(cx, cy, r, 0, Math.PI*2);
        }

        this.ctx.fillStyle = e.color;
        this.ctx.fill();

        this.ctx.shadowBlur = 0;

        // Border
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = '#fff';
        this.ctx.stroke();

        // ID / Role
        this.ctx.fillStyle = '#fff';
        this.ctx.font = `${this.tileSize*0.4}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(e.isIt ? 'IT' : 'P'+(e.id+1), cx, cy);

        // Shield Effect
        const shield = e.effects.find(ef => ef.type === 'shield');
        if (shield) {
             this.ctx.beginPath();
             this.ctx.arc(cx, cy, r + 5, 0, Math.PI*2);
             this.ctx.strokeStyle = '#2979ff';
             this.ctx.lineWidth = 2;
             this.ctx.stroke();
        }

        this.ctx.globalAlpha = 1.0;
    });

    this.ctx.restore();

    // Draw HUD
    this.drawHUD(state);
  }

  drawHUD(state) {
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '20px sans-serif';
      this.ctx.textAlign = 'center';
      let title = `Time: ${Math.ceil(state.timeRemaining)}`;
      if (state.mode === 'koth') title += " - KotH";
      this.ctx.fillText(title, this.width / 2, 30);

      // Scores
      // Simple Corner lists
      this.ctx.textAlign = 'left';
      state.entities.forEach((e, i) => {
          const score = state.scores[e.id];
          let txt = `P${e.id+1}: ${score.tags} Tags`;
          if (state.mode === 'koth') {
             txt = `P${e.id+1}: ${Math.floor(score.hillTime)}s`;
          }
          this.ctx.fillStyle = e.color;
          this.ctx.fillText(txt, 10, 30 + i*25);
      });

      if (state.gameOver) {
          this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
          this.ctx.fillRect(0, 0, this.width, this.height);
          this.ctx.fillStyle = '#fff';
          this.ctx.font = '40px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText('GAME OVER', this.width/2, this.height/2);
      }
  }
}
