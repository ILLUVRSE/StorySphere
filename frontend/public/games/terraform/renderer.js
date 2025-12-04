export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;

    // Tier colors
    this.colors = [
      '#2d2d2d', // 0: Empty (Dark soil)
      '#8bc34a', // 1: Sprout (Light Green)
      '#4caf50', // 2: Leafy (Green)
      '#009688', // 3: Bush (Teal)
      '#ffeb3b', // 4: Flower (Yellow)
      '#ff9800', // 5: Fruit (Orange)
      '#f44336', // 6: Mega (Red)
    ];
  }

  resize() {
    this.width = this.canvas.width;
    this.height = this.canvas.height;
  }

  render(game) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, this.width, this.height);

    // Calculate grid metrics
    const cols = game.width;
    const rows = game.height;

    // HUD Space
    const hudHeight = 60;
    const gridY = hudHeight + 20;
    const availWidth = this.width - 20;
    const availHeight = this.height - gridY - 20;

    const cellSize = Math.min(availWidth / cols, availHeight / rows);
    const gridW = cellSize * cols;
    const gridH = cellSize * rows;
    const startX = (this.width - gridW) / 2;

    this.gridMetrics = { startX, gridY, cellSize };

    // Draw HUD
    this.drawHUD(ctx, game);

    // Draw Grid
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        this.drawTile(ctx, game.grid[x][y], startX + x * cellSize, gridY + y * cellSize, cellSize);
      }
    }

    if (game.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 30px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("TIME'S UP", this.width/2, this.height/2 - 20);

        ctx.font = '20px monospace';
        ctx.fillText(`Score: ${game.score}`, this.width/2, this.height/2 + 20);
    }
  }

  drawTile(ctx, tile, x, y, size) {
    const pad = 4;
    const cx = x + size/2;
    const cy = y + size/2;
    const drawSize = (size - pad * 2) * tile.animScale;

    // Slot bg
    ctx.fillStyle = '#333';
    ctx.fillRect(x + pad, y + pad, size - pad*2, size - pad*2);

    if (tile.tier > 0) {
      ctx.fillStyle = this.colors[tile.tier] || '#fff';

      ctx.beginPath();
      // Draw rounded rect or circle based on tier
      if (tile.tier <= 2) {
          ctx.arc(cx, cy, drawSize/3, 0, Math.PI * 2);
      } else {
          const r = drawSize/2;
          ctx.rect(cx - r, cy - r, r*2, r*2);
      }
      ctx.fill();

      // Tier number
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.font = `bold ${size/3}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tile.tier, cx, cy);
    }
  }

  drawHUD(ctx, game) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.fillText(`Score: ${game.score}`, 10, 10);

    const timeStr = (game.timeLeft / 1000).toFixed(1);
    ctx.textAlign = 'right';
    ctx.fillText(`Time: ${timeStr}`, this.width - 10, 10);

    // Combo bar
    if (game.comboCount > 0) {
        ctx.fillStyle = '#ff9800';
        ctx.textAlign = 'center';
        ctx.font = '16px monospace';
        ctx.fillText(`Combo x${game.comboCount}!`, this.width/2, 40);

        // Bar
        const barW = 200;
        const barH = 5;
        const progress = Math.max(0, (game.comboWindowMs - (performance.now() - game.lastHarvestTime)) / game.comboWindowMs);

        ctx.fillStyle = '#333';
        ctx.fillRect(this.width/2 - barW/2, 50, barW, barH);

        ctx.fillStyle = '#ff9800';
        ctx.fillRect(this.width/2 - barW/2, 50, barW * progress, barH);
    }
  }
}
