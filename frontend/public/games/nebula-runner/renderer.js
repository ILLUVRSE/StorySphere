import { CONSTANTS } from './utils.js';
import { SPRITES, PALETTE } from './sprites.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.particles = [];
    this.resize();
  }

  resize() {
      this.canvas.width = CONSTANTS.CANVAS_WIDTH;
      this.canvas.height = CONSTANTS.CANVAS_HEIGHT;

      // Calculate tile size. We want pixel perfect.
      // 480 / 12 = 40px wide tiles
      // 320 / 8 = 40px high tiles. Perfect square tiles.
      this.tileW = this.canvas.width / CONSTANTS.COLS;
      this.tileH = this.canvas.height / CONSTANTS.ROWS;
  }

  render(engine, dt, progress, queuedMove) {
    const ctx = this.ctx;

    // Clear Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw Stars
    const starOffset = (engine.distance * 0.5 + progress * 0.5) * this.tileW;
    this.drawStars(ctx, starOffset);

    // Grid Scroll Offset
    const scrollX = -progress * this.tileW;

    // 1. Draw Grid Tiles
    for (let c = 0; c < engine.grid.length; c++) {
        const col = engine.grid[c];
        const x = c * this.tileW + scrollX;

        if (x < -this.tileW || x > this.canvas.width) continue;

        for (let r = 0; r < col.length; r++) {
            const tile = col[r];
            const y = r * this.tileH;

            if (tile.type === 'meteor') {
                this.drawSprite(ctx, 'meteor', x, y, this.tileW, this.tileH);
            } else if (tile.type === 'pickup') {
                this.drawSprite(ctx, tile.variant === 'shield' ? 'pickup_shield' : 'pickup_boost', x, y, this.tileW, this.tileH);
            }
        }
    }

    // 2. Draw Entities
    // Note: Entity X is in "Column Units".
    // We must apply the 'scrollX' visual offset IF the entity coordinates are grid-relative.
    // In Engine update: "bullets.forEach(b => b.x -= 1)" on scroll.
    // This means Entity X stays relative to the "World Origin" (current screen left edge).
    // So Entity X=0 means "Left Edge of Screen" (at start of tick).
    // But during the tick animation (progress 0..1), the world shifts LEFT.
    // So visually, everything should shift LEFT by 'progress'.
    // Including Entities?
    // If Entity X is continuous (updated by dt), it already accounts for movement.
    // Engine updates Entity X every frame? No, Engine update(dt) updates X continuously.
    // If Engine update includes "move left due to scroll", then we just draw at X.
    // But Engine "scroll speed" is discrete (advanceColumn).
    // This is tricky.
    // If I use `engine.update(dt)` to move enemies left, that's their speed relative to GROUND.
    // But Ground is moving.
    // Let's assume Entity X is SCREEN COORDINATE (0..12).
    // So we just draw at X * tileW.
    // AND we must apply the `scrollX` visual offset?
    // If `advanceColumn` happened, X jumped -1. Visual offset jumps from -tileW to 0.
    // So: ScreenX = (Entity.x * tileW) + (progress * tileW)?
    // No.
    // Time 0: progress=0. EntityX=5. Draw at 5.
    // Time 0.5: progress=0.5. Visual Grid at -0.5. EntityX should be 4.5 visually?
    // If Entity is "flying", does it move with the grid or separate?
    // Separate.
    // So Entity X is absolute Screen X. We draw at Entity.x * tileW.
    // We ignore `scrollX` for entities unless they are "attached" to the ground.
    // Bullets/Enemies are flying. Draw absolute.

    // Draw Bullets
    // Apply scrollX to match grid movement
    engine.bullets.forEach(b => {
        // Center the small bullet in the tile
        const x = b.x * this.tileW + scrollX;
        const y = b.row * this.tileH;
        this.drawSprite(ctx, 'bullet', x + this.tileW*0.25, y + this.tileH*0.25, this.tileW/2, this.tileH/2);
    });

    // Draw Enemies
    engine.enemies.forEach(e => {
        const x = e.x * this.tileW + scrollX;
        const y = e.row * this.tileH;
        this.drawSprite(ctx, e.type === 'turret' ? 'enemy_turret' : 'enemy_chaser', x, y, this.tileW, this.tileH);
    });

    // 3. Draw Player
    // Player Y is interpolated
    const targetRow = Math.max(0, Math.min(CONSTANTS.ROWS - 1, engine.shipRow + queuedMove));
    const currentY = engine.shipRow * this.tileH;
    const targetY = targetRow * this.tileH;
    // We use progress for smoothing Y movement?
    // progress is 0..1 for the Grid Scroll tick.
    // But player move might happen faster/independent?
    // engine.shipRow updates on tick. So yes, use progress.
    const interpY = currentY + (targetY - currentY) * progress;
    const shipX = CONSTANTS.SHIP_COL * this.tileW;

    this.drawSprite(ctx, 'ship', shipX, interpY, this.tileW, this.tileH);

    if (engine.shield > 0) {
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(shipX, interpY, this.tileW, this.tileH);
    }

    // 4. Particles
    this.updateAndDrawParticles(ctx, dt);
  }

  drawStars(ctx, scrollX) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 40; i++) {
          const x = (i * 137 + scrollX * 0.5) % this.canvas.width;
          const y = (i * 233) % this.canvas.height;
          // Blinking stars
          if ((Date.now() + i*100) % 1000 < 500) {
              ctx.fillRect(this.canvas.width - x, y, 2, 2);
          }
      }
  }

  drawSprite(ctx, name, x, y, w, h) {
      const sprite = SPRITES[name];
      if (!sprite) return;

      const pixelW = w / sprite.w;
      const pixelH = h / sprite.h;

      for (let r = 0; r < sprite.h; r++) {
          const rowStr = sprite.data[r];
          for (let c = 0; c < sprite.w; c++) {
              const char = rowStr[c];
              const color = PALETTE[char];
              if (color) {
                  ctx.fillStyle = color;
                  // Draw pixel slightly larger to avoid gaps
                  ctx.fillRect(Math.floor(x + c * pixelW), Math.floor(y + r * pixelH), Math.ceil(pixelW), Math.ceil(pixelH));
              }
          }
      }
  }

  addExplosion(x, y) {
      // Add particles
      for(let i=0; i<8; i++) {
          this.particles.push({
              x: x, y: y,
              vx: (Math.random() - 0.5) * 100,
              vy: (Math.random() - 0.5) * 100,
              life: 1.0,
              color: i % 2 === 0 ? '#ff0000' : '#ffff00'
          });
      }
  }

  updateAndDrawParticles(ctx, dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
          const p = this.particles[i];
          p.life -= dt / 500; // 0.5s life
          p.x += p.vx * (dt / 1000);
          p.y += p.vy * (dt / 1000);

          if (p.life <= 0) {
              this.particles.splice(i, 1);
          } else {
              ctx.fillStyle = p.color;
              ctx.globalAlpha = p.life;
              ctx.fillRect(p.x, p.y, 4, 4);
              ctx.globalAlpha = 1.0;
          }
      }
  }
}
