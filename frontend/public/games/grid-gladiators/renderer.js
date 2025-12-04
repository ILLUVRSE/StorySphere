export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.tileSize = 64; // Base size, scales

    // Colors
    this.colors = {
      floor: '#263238',
      wall: '#37474f',
      trap: '#bf360c',
      bounce: '#0d47a1',
      heal: '#1b5e20',
      hazard: '#b71c1c',
      p1: '#00e676',
      p2: '#ffea00',
      enemy: '#d50000',
      text: '#eceff1'
    };
  }

  resize() {
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    // Calculate tile size to fit grid 9x7 with padding
    const gw = 9;
    const gh = 7;
    const m = 20; // margin
    const availW = this.width - m*2;
    const availH = this.height - m*2;
    this.tileSize = Math.floor(Math.min(availW / gw, availH / gh));
    this.offsetX = Math.floor((this.width - gw * this.tileSize) / 2);
    this.offsetY = Math.floor((this.height - gh * this.tileSize) / 2);
  }

  draw(state, alpha) {
    this.ctx.fillStyle = '#001014'; // Dark background
    this.ctx.fillRect(0, 0, this.width, this.height);

    if (!state) return;

    // Draw Grid
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        const tile = state.grid[y][x];
        const tx = this.offsetX + x * this.tileSize;
        const ty = this.offsetY + y * this.tileSize;

        // Base
        this.ctx.fillStyle = this.getTileColor(tile.type);
        this.ctx.fillRect(tx + 1, ty + 1, this.tileSize - 2, this.tileSize - 2);

        // Details
        if (tile.type === 1) { // Wall/Cover
           this.ctx.fillStyle = '#546e7a';
           this.ctx.fillRect(tx + 5, ty + 5, this.tileSize - 10, this.tileSize - 10);
        } else if (tile.type === 2) { // Trap
           this.ctx.beginPath();
           this.ctx.arc(tx + this.tileSize/2, ty + this.tileSize/2, this.tileSize/4, 0, Math.PI*2);
           this.ctx.fillStyle = '#ff5722';
           this.ctx.fill();
        } else if (tile.type === 3) { // Bounce
           this.ctx.beginPath();
           this.ctx.arc(tx + this.tileSize/2, ty + this.tileSize/2, this.tileSize/3, 0, Math.PI*2);
           this.ctx.strokeStyle = '#4fc3f7';
           this.ctx.lineWidth = 3;
           this.ctx.stroke();
        } else if (tile.type === 4) { // Heal
           this.ctx.fillStyle = '#69f0ae';
           this.ctx.font = '20px sans-serif';
           this.ctx.textAlign = 'center';
           this.ctx.textBaseline = 'middle';
           this.ctx.fillText('+', tx + this.tileSize/2, ty + this.tileSize/2);
        } else if (tile.type === 5) { // Hazard
           this.ctx.globalAlpha = 0.5 + Math.sin(Date.now()/100)*0.5;
           this.ctx.fillStyle = '#ff1744';
           this.ctx.fillRect(tx, ty, this.tileSize, this.tileSize);
           this.ctx.globalAlpha = 1.0;
        }
      }
    }

    // Draw Entities
    state.entities.forEach(ent => {
        if (ent.hp <= 0) return;
        // Interpolate? For now just use pos (assume high tick rate or synced draw)
        // With alpha: pos = prev + (curr - prev) * alpha
        // But for MVP simple direct draw is often fine if tick is 60fps or we use engine update loop
        // If engine is separate 120ms tick, we need interpolation.
        // Let's assume passed state is the render state (interpolated in main loop before passed here)

        const cx = this.offsetX + ent.x * this.tileSize;
        const cy = this.offsetY + ent.y * this.tileSize;
        const r = ent.def.radius * this.tileSize;

        this.ctx.fillStyle = ent.def.color;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r, 0, Math.PI*2);
        this.ctx.fill();

        // Direction/Aim
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy);
        this.ctx.lineTo(cx + ent.aim.x * r * 1.5, cy + ent.aim.y * r * 1.5);
        this.ctx.stroke();

        // HP Bar
        const barW = r * 2;
        const barH = 4;
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(cx - r, cy - r - 8, barW, barH);
        this.ctx.fillStyle = '#0f0';
        const hpPct = Math.max(0, ent.hp / ent.def.hp);
        this.ctx.fillRect(cx - r, cy - r - 8, barW * hpPct, barH);
    });

    // Projectiles
    state.projectiles.forEach(p => {
        const cx = this.offsetX + p.x * this.tileSize;
        const cy = this.offsetY + p.y * this.tileSize;
        this.ctx.fillStyle = '#ffeb3b';
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, 4, 0, Math.PI*2);
        this.ctx.fill();
    });

    // Particles/FX
    state.particles.forEach(p => {
        const cx = this.offsetX + p.x * this.tileSize;
        const cy = this.offsetY + p.y * this.tileSize;
        this.ctx.fillStyle = p.color;
        this.ctx.globalAlpha = p.life;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, p.size, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
    });

    // UI Overlay
    this.drawUI(state);
  }

  drawUI(state) {
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '16px monospace';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(`Time: ${Math.floor(state.timeRemaining)}s`, 10, 10);

      // Scores
      state.scores.forEach((s, i) => {
          this.ctx.fillText(`P${i+1}: ${s}`, 10, 30 + i*20);
      });

      if (state.gameOver) {
          this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
          this.ctx.fillRect(0, 0, this.width, this.height);
          this.ctx.fillStyle = '#fff';
          this.ctx.font = '40px monospace';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText("MATCH OVER", this.width/2, this.height/2 - 20);

          this.ctx.font = '20px monospace';
          const winner = state.scores[0] > state.scores[1] ? "Player 1 Wins" : (state.scores[1] > state.scores[0] ? "Player 2 Wins" : "Draw");
          this.ctx.fillText(winner, this.width/2, this.height/2 + 30);
          this.ctx.fillText("Click to Restart", this.width/2, this.height/2 + 60);
      }
  }

  getTileColor(type) {
      switch(type) {
          case 0: return this.colors.floor;
          case 1: return this.colors.wall;
          case 2: return '#3e2723'; // trap base
          case 3: return '#01579b'; // bounce base
          case 4: return '#1b5e20'; // heal base
          case 5: return '#b71c1c'; // hazard
          default: return '#000';
      }
  }
}
