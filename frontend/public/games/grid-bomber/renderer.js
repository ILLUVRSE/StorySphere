import { CONSTANTS } from './utils.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.resize();
  }

  resize() {
      // Logic to handle responsiveness if needed, for now fixed to constants
      this.canvas.width = CONSTANTS.CANVAS_WIDTH;
      this.canvas.height = CONSTANTS.CANVAS_HEIGHT;
  }

  render(engine, dt) {
    const ctx = this.ctx;
    const ts = CONSTANTS.TILE_SIZE;

    // Clear
    ctx.fillStyle = CONSTANTS.COLORS.BG;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw Grid
    for (let r = 0; r < CONSTANTS.ROWS; r++) {
        for (let c = 0; c < CONSTANTS.COLS; c++) {
            const tile = engine.grid[r][c];
            const x = c * ts;
            const y = r * ts;

            // Floor
            ctx.fillStyle = ((c+r)%2 === 0) ? CONSTANTS.COLORS.FLOOR : '#1f2e45';
            ctx.fillRect(x, y, ts, ts);

            // Objects
            if (tile.type === 'wall') {
                this.drawWall(ctx, x, y, ts);
            } else if (tile.type === 'destructible') {
                this.drawDestructible(ctx, x, y, ts);
            }
        }
    }

    // Draw Bombs
    for (const bomb of engine.bombs) {
        this.drawBomb(ctx, bomb, ts);
    }

    // Draw Explosions
    for (const exp of engine.explosions) {
        this.drawExplosion(ctx, exp, ts);
    }

    // Draw Powerups (that are revealed)
    for (const p of engine.powerups) {
        this.drawPowerup(ctx, p, ts);
    }

    // Draw Players/Bots
    for (const p of engine.players) {
        if (!p.alive) continue;
        this.drawPlayer(ctx, p, ts);
    }
  }

  drawWall(ctx, x, y, s) {
      ctx.fillStyle = CONSTANTS.COLORS.WALL;
      ctx.fillRect(x, y, s, s);
      // Bevel
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(x, y, s, 4);
      ctx.fillRect(x, y, 4, s);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x + s - 4, y, 4, s);
      ctx.fillRect(x, y + s - 4, s, 4);
  }

  drawDestructible(ctx, x, y, s) {
      ctx.fillStyle = CONSTANTS.COLORS.DESTRUCTIBLE;
      ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
      // Bricks pattern
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(x + 6, y + s/2 - 2, s - 12, 4);
      ctx.fillRect(x + s/2 - 2, y + 6, 4, s - 12);
  }

  drawPlayer(ctx, p, s) {
      const x = p.x;
      const y = p.y;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(x + s/2, y + s - 4, s/3, s/6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = p.isBot ? CONSTANTS.COLORS.BOT : (p.id === 1 ? CONSTANTS.COLORS.P1 : CONSTANTS.COLORS.P2);
      ctx.beginPath();
      ctx.arc(x + s/2, y + s/2, s/2 - 4, 0, Math.PI * 2);
      ctx.fill();

      // Eyes (Directional indicator if needed, but simple white dots work)
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(x + s/2 - 6, y + s/2 - 4, 3, 0, Math.PI * 2);
      ctx.arc(x + s/2 + 6, y + s/2 - 4, 3, 0, Math.PI * 2);
      ctx.fill();

      // Shield/Overlay if powerup active? (Later)
  }

  drawBomb(ctx, bomb, s) {
      const x = bomb.col * s;
      const y = bomb.row * s;

      // Pulse effect
      const pulse = Math.sin(Date.now() / 100) * 2;

      ctx.fillStyle = CONSTANTS.COLORS.BOMB;
      ctx.beginPath();
      ctx.arc(x + s/2, y + s/2, s/2 - 6 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Fuse
      ctx.fillStyle = '#ff5722';
      ctx.beginPath();
      ctx.arc(x + s/2 + 4, y + s/2 - 10, 3, 0, Math.PI * 2);
      ctx.fill();

      if (bomb.remote) {
           ctx.strokeStyle = '#00e5ff';
           ctx.lineWidth = 2;
           ctx.stroke();
      }
  }

  drawExplosion(ctx, exp, s) {
      // exp has { col, row, type } where type could be center, horiz, vert, end_left, etc.
      // MVP: Just draw colored rects
      const x = exp.col * s;
      const y = exp.row * s;

      ctx.fillStyle = CONSTANTS.COLORS.EXPLOSION;
      ctx.fillRect(x, y, s, s);

      ctx.fillStyle = '#fff9c4'; // Core
      ctx.fillRect(x + 10, y + 10, s - 20, s - 20);
  }

  drawPowerup(ctx, p, s) {
      const x = p.col * s;
      const y = p.row * s;

      // Background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(x+s/2, y+s/2, s/3, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      let symbol = '?';
      if (p.type === 'range') symbol = '💥'; // Blast
      else if (p.type === 'count') symbol = '💣'; // Extra bomb
      else if (p.type === 'speed') symbol = '⚡'; // Speed
      else if (p.type === 'remote') symbol = '📡'; // Remote

      ctx.fillText(symbol, x + s/2, y + s/2 + 2);
  }
}
