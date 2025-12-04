
import { TILE, TileLogic } from './tiles.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tileSize = 32;
    this.width = 0;
    this.height = 0;

    this.colors = {
      bg: '#004d40',
      wall: '#00695c',
      floor: '#004d40',
      player: '#ffd700',
      goal: '#00e676',
      hazard: '#ff5252',
      hazardSafe: '#5d4037', // inactive hazard
      rewindTint: 'rgba(0, 230, 118, 0.2)', // Tint when rewinding
      trace: 'rgba(255, 215, 0, 0.3)' // Past positions
    };

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    // Fit to container, but keep aspect ratio or just fill?
    // GameGrid usually likes distinct canvas size.
    // For now, let's assume full screen but we scale the drawing to center it.
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  draw(state, mapWidth, mapHeight, isRewinding) {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    // Clear
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, cw, ch);

    // Calculate scale
    // 9x7 base
    const maxTileW = Math.floor(cw / (mapWidth + 2));
    const maxTileH = Math.floor(ch / (mapHeight + 2));
    this.tileSize = Math.min(maxTileW, maxTileH, 64);

    const offsetX = (cw - mapWidth * this.tileSize) / 2;
    const offsetY = (ch - mapHeight * this.tileSize) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Draw Map
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        this.drawTile(ctx, x, y, state.tiles[y][x], state.tick);
      }
    }

    // Draw Ghost/Trace (optional, from history?)
    // If we passed history, we could draw it. For MVP, maybe skip or assume passed.

    // Draw Player
    this.drawPlayer(ctx, state.player.x, state.player.y);

    // Rewind VFX
    if (isRewinding) {
      ctx.fillStyle = this.colors.rewindTint;
      ctx.fillRect(0, 0, mapWidth * this.tileSize, mapHeight * this.tileSize);

      // Draw "REWIND" text or icon
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 30px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText("<< REWINDING", (mapWidth * this.tileSize) / 2, -20);
    }

    ctx.restore();
  }

  drawTile(ctx, x, y, type, tick) {
    const s = this.tileSize;
    const px = x * s;
    const py = y * s;

    // Base Floor
    ctx.fillStyle = ((x + y) % 2 === 0) ? '#004d40' : '#00584b';
    ctx.fillRect(px, py, s, s);

    switch (type) {
      case TILE.WALL:
        ctx.fillStyle = this.colors.wall;
        ctx.fillRect(px, py, s, s);
        // Bevel
        ctx.strokeStyle = '#003d33';
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, s, s);
        break;

      case TILE.GOAL:
        ctx.fillStyle = this.colors.goal;
        ctx.beginPath();
        ctx.arc(px + s/2, py + s/2, s/3, 0, Math.PI * 2);
        ctx.fill();
        break;

      case TILE.START:
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + s*0.2, py + s*0.2, s*0.6, s*0.6);
        break;

      case TILE.TOGGLE_BLOCK:
        const solid = TileLogic.isSolid(type, x, y, tick);
        ctx.fillStyle = solid ? '#5d4037' : 'rgba(93, 64, 55, 0.3)';
        ctx.fillRect(px + 4, py + 4, s - 8, s - 8);
        if (solid) {
            ctx.fillStyle = '#8d6e63'; // detail
            ctx.fillRect(px + 8, py + 8, s - 16, s - 16);
        }
        break;

      case TILE.LASER_H:
      case TILE.LASER_V:
        ctx.fillStyle = '#333';
        ctx.fillRect(px + s*0.2, py + s*0.2, s*0.6, s*0.6);

        // Laser beam logic?
        // Wait, the tile itself is the emitter.
        // Rendering the BEAM needs to happen separately or here if we know beam length.
        // For MVP, if it fires, we can draw a line across the row/col.
        // But we need to know if it's hitting walls.
        // For simplicity, let's just draw the emitter red if active.
        const isActive = ((tick + (x+y)%3) % 6) < 3;
        if (isActive) {
          ctx.fillStyle = this.colors.hazard;
          ctx.beginPath();
          ctx.arc(px + s/2, py + s/2, s/4, 0, Math.PI*2);
          ctx.fill();

          // Draw beam
          ctx.strokeStyle = this.colors.hazard;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(px + s/2, py + s/2);
          if (type === TILE.LASER_H) {
            // Draw full horizontal line for now, clipped by walls ideally but simple for MVP
             ctx.lineTo(px + s/2 + (this.tileSize * 10), py + s/2); // Right
             ctx.lineTo(px + s/2 - (this.tileSize * 10), py + s/2); // Left
          } else {
             ctx.lineTo(px + s/2, py + s/2 + (this.tileSize * 10)); // Down
             ctx.lineTo(px + s/2, py + s/2 - (this.tileSize * 10)); // Up
          }
          ctx.stroke();
        }
        break;

      case TILE.ONE_WAY_U:
      case TILE.ONE_WAY_D:
      case TILE.ONE_WAY_L:
      case TILE.ONE_WAY_R:
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        const cx = px + s/2;
        const cy = py + s/2;
        const off = s/4;

        if (type === TILE.ONE_WAY_U) {
             ctx.moveTo(cx, cy - off); ctx.lineTo(cx - off, cy + off); ctx.lineTo(cx + off, cy + off);
        } else if (type === TILE.ONE_WAY_D) {
             ctx.moveTo(cx, cy + off); ctx.lineTo(cx - off, cy - off); ctx.lineTo(cx + off, cy - off);
        } else if (type === TILE.ONE_WAY_L) {
             ctx.moveTo(cx - off, cy); ctx.lineTo(cx + off, cy - off); ctx.lineTo(cx + off, cy + off);
        } else if (type === TILE.ONE_WAY_R) {
             ctx.moveTo(cx + off, cy); ctx.lineTo(cx - off, cy - off); ctx.lineTo(cx - off, cy + off);
        }
        ctx.fill();
        break;
    }
  }

  drawPlayer(ctx, x, y) {
    const s = this.tileSize;
    const px = x * s + s/2;
    const py = y * s + s/2;

    ctx.fillStyle = this.colors.player;
    ctx.beginPath();
    ctx.arc(px, py, s/2.5, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(px - s/8, py - s/8, s/10, 0, Math.PI * 2);
    ctx.arc(px + s/8, py - s/8, s/10, 0, Math.PI * 2);
    ctx.fill();
  }
}
