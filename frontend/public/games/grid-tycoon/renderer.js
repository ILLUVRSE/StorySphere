// renderer.js
import { lerp } from './utils.js';

export class Renderer {
  constructor(canvas, engine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.engine = engine;

    this.tileSize = 40;
    this.offsetX = 0;
    this.offsetY = 0;

    // Colors
    this.colors = {
      bg: '#002620',       // Very Dark Teal
      grid: '#004d40',     // Primary
      hover: 'rgba(255, 215, 0, 0.3)', // Gold transparent
      text: '#fdfbf7',     // Cream
      shop: '#ff9800',     // Orange
      house: '#03a9f4',    // Light Blue
      park: '#4caf50',     // Green
      road: '#607d8b',     // Blue Grey
      customer: '#e91e63', // Pink
      vip: '#ffd700'       // Gold
    };
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;

      // Calculate tile size to fit grid with some padding
      // Account for Top HUD (40px)
      const hudHeight = 40;
      const availHeight = this.canvas.height - hudHeight;
      const availWidth = this.canvas.width;

      const gridW = this.engine.width;
      const gridH = this.engine.height;

      // Fit within available space
      const scaleX = (availWidth - 20) / gridW;
      const scaleY = (availHeight - 20) / gridH;
      this.tileSize = Math.floor(Math.min(scaleX, scaleY));

      this.offsetX = Math.floor((availWidth - gridW * this.tileSize) / 2);
      this.offsetY = hudHeight + Math.floor((availHeight - gridH * this.tileSize) / 2);
    }
  }

  screenToGrid(x, y) {
    const gx = Math.floor((x - this.offsetX) / this.tileSize);
    const gy = Math.floor((y - this.offsetY) / this.tileSize);
    return { x: gx, y: gy };
  }

  draw() {
    // Clear
    this.ctx.fillStyle = this.colors.bg;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw Grid & Buildings
    this.drawGrid();

    // Draw Customers
    this.drawCustomers();

    // Draw UI Overlay (Hover)
    this.drawHover();

    // Draw HUD
    this.drawHUD();

    // Draw Floating Text
    this.drawFloatingTexts();
  }

  drawGrid() {
    const { width, height, grid } = this.engine;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        const px = this.offsetX + x * this.tileSize;
        const py = this.offsetY + y * this.tileSize;

        // Base tile
        this.ctx.fillStyle = this.colors.grid;
        this.ctx.fillRect(px + 1, py + 1, this.tileSize - 2, this.tileSize - 2);

        // Building
        if (tile.building) {
          this.drawBuilding(px, py, tile.building);
        }
      }
    }
  }

  drawBuilding(px, py, building) {
    const pad = 4;
    const size = this.tileSize - pad * 2;

    let color = '#ccc';
    let label = '?';

    switch(building.type) {
      case 'house': color = this.colors.house; label = 'H'; break;
      case 'shop': color = this.colors.shop; label = '$'; break;
      case 'park': color = this.colors.park; label = 'P'; break;
      case 'road': color = this.colors.road; label = ''; break;
    }

    if (building.type === 'road') {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(px + this.tileSize/3, py, this.tileSize/3, this.tileSize);
        this.ctx.fillRect(px, py + this.tileSize/3, this.tileSize, this.tileSize/3);
    } else {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(px + pad, py + pad, size, size);

        // Icon/Label
        this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
        this.ctx.font = `${Math.floor(size/1.5)}px monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label, px + this.tileSize/2, py + this.tileSize/2);

        // Capacity indicator for shops
        if (building.type === 'shop') {
            const pct = building.queue.length / building.capacity;
            const barH = 4;
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(px + pad, py + pad - 6, size, barH);
            this.ctx.fillStyle = pct >= 1 ? 'red' : 'lime';
            this.ctx.fillRect(px + pad, py + pad - 6, size * pct, barH);
        }
    }
  }

  drawCustomers() {
    this.engine.customers.forEach(c => {
      // Interpolate position based on tick progress would be better, but for MVP tick-based is fine
      // Or we can assume simple linear interpolation if engine stores previous pos
      // For MVP, just draw at current tile with a small offset if moving

      const px = this.offsetX + c.x * this.tileSize + this.tileSize/2;
      const py = this.offsetY + c.y * this.tileSize + this.tileSize/2;

      this.ctx.fillStyle = c.vip ? this.colors.vip : this.colors.customer;
      this.ctx.beginPath();
      this.ctx.arc(px, py, this.tileSize/4, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  drawHover() {
    const { hoverX, hoverY, selectedBuildingType } = this.engine;
    if (hoverX >= 0 && hoverX < this.engine.width && hoverY >= 0 && hoverY < this.engine.height) {
      const px = this.offsetX + hoverX * this.tileSize;
      const py = this.offsetY + hoverY * this.tileSize;

      this.ctx.strokeStyle = '#ffd700';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(px, py, this.tileSize, this.tileSize);

      // Ghost preview if building selected
      if (selectedBuildingType && this.engine.canBuild(hoverX, hoverY, selectedBuildingType)) {
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          this.ctx.fillRect(px, py, this.tileSize, this.tileSize);
      }
    }
  }

  drawHUD() {
    // Top bar
    this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
    this.ctx.fillRect(0, 0, this.canvas.width, 40);

    this.ctx.fillStyle = this.colors.text;
    this.ctx.font = '16px sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';

    const timeStr = this.formatTime(this.engine.timeLeft);
    const scoreStr = `$${Math.floor(this.engine.money)}`;
    const revenueStr = `Rev: $${Math.floor(this.engine.totalRevenue)}`;
    const waveStr = `Wave: ${this.engine.waveIndex + 1}`;

    this.ctx.fillText(`${timeStr} | ${scoreStr} | ${revenueStr} | ${waveStr}`, 10, 20);
  }

  drawFloatingTexts() {
    this.ctx.font = 'bold 16px sans-serif';
    this.ctx.textAlign = 'center';

    const now = Date.now();
    this.engine.floatingTexts = this.engine.floatingTexts.filter(ft => now - ft.start < ft.duration);

    this.engine.floatingTexts.forEach(ft => {
        const elapsed = now - ft.start;
        const progress = elapsed / ft.duration;
        const yOffset = progress * 30; // Float up

        const px = this.offsetX + ft.x * this.tileSize + this.tileSize/2;
        const py = this.offsetY + ft.y * this.tileSize + this.tileSize/2 - yOffset;

        this.ctx.fillStyle = `rgba(255, 215, 0, ${1 - progress})`;
        this.ctx.fillText(ft.text, px, py);
    });
  }

  formatTime(ms) {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}:${ss.toString().padStart(2, '0')}`;
  }
}
