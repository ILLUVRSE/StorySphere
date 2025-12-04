import { TileType } from './engine.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tileSize = 40;
    this.offsetX = 0;
    this.offsetY = 0;

    // Theme
    this.colors = {
      bg: '#004d40',
      grid: '#00695c',
      mirror: '#b2dfdb',
      mirrorSide: '#80cbc4',
      target: '#ffd700',
      emitter: '#ff5722',
      beam: '#ffd700', // Gold
      beamGlow: 'rgba(255, 215, 0, 0.4)'
    };
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  draw(engine, dt) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, w, h);

    // Calculate layout
    const gridW = engine.width * this.tileSize;
    const gridH = engine.height * this.tileSize;
    this.offsetX = Math.floor((w - gridW) / 2);
    this.offsetY = Math.floor((h - gridH) / 2);

    // Draw Grid
    ctx.strokeStyle = this.colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let x=0; x<=engine.width; x++) {
       ctx.moveTo(this.offsetX + x*this.tileSize, this.offsetY);
       ctx.lineTo(this.offsetX + x*this.tileSize, this.offsetY + gridH);
    }
    for(let y=0; y<=engine.height; y++) {
       ctx.moveTo(this.offsetX, this.offsetY + y*this.tileSize);
       ctx.lineTo(this.offsetX + gridW, this.offsetY + y*this.tileSize);
    }
    ctx.stroke();

    // Draw Tiles
    engine.grid.forEach(tile => {
       if (tile.type !== TileType.EMPTY) {
         this.drawTile(ctx, tile);
       }
    });

    // Draw Beams
    this.drawBeams(ctx, engine.beams);
  }

  drawTile(ctx, tile) {
    const x = this.offsetX + tile.x * this.tileSize;
    const y = this.offsetY + tile.y * this.tileSize;
    const cx = x + this.tileSize/2;
    const cy = y + this.tileSize/2;
    const s = this.tileSize;

    ctx.save();
    ctx.translate(cx, cy);

    if (tile.type === TileType.MIRROR) {
       // Rotation: 0=/, 1=\, 2=/, 3=\
       // Visual: Base is / (TopRight to BotLeft? Or BotLeft to TopRight?)
       // Logic 0: / (Bottom-Left to Top-Right).
       // Canvas default is y-down.
       // Line from ( -s/2, s/2 ) to ( s/2, -s/2 ).

       // Handle rotation logic mapping
       const rot = tile.rotation % 2; // 0 or 1

       ctx.strokeStyle = this.colors.mirror;
       ctx.lineWidth = 4;
       ctx.lineCap = 'round';

       ctx.beginPath();
       if (rot === 0) {
          // /
          ctx.moveTo(-s/3, s/3);
          ctx.lineTo(s/3, -s/3);
       } else {
          // \
          ctx.moveTo(-s/3, -s/3);
          ctx.lineTo(s/3, s/3);
       }
       ctx.stroke();

       // Draw back/frame indicator if needed to distinguish 4-state
       // Optional: Small dot or notch to show 'orientation'
       // For MVP 2-state visual is enough if physics is 2-state.

    } else if (tile.type === TileType.TARGET) {
       ctx.fillStyle = tile.active ? '#ffff00' : this.colors.target;
       ctx.beginPath();
       ctx.arc(0, 0, s/4, 0, Math.PI*2);
       ctx.fill();
       if (tile.active) {
         ctx.shadowColor = '#ffff00';
         ctx.shadowBlur = 10;
         ctx.stroke();
         ctx.shadowBlur = 0;
       }
    } else if (tile.type === TileType.EMITTER) {
       ctx.fillStyle = this.colors.emitter;
       // Draw Triangle pointing in dir
       ctx.rotate(tile.rotation * Math.PI / 2); // 0=N? No, Logic 0=N. Canvas 0=Right(E)?
       // Logic: 0=N, 1=E, 2=S, 3=W.
       // Canvas 0 angle is Right (E).
       // So we need to rotate:
       // If rot=0 (N), we want -90 deg.
       // If rot=1 (E), we want 0 deg.
       // If rot=2 (S), we want 90 deg.
       // If rot=3 (W), we want 180 deg.
       // Formula: (rot - 1) * 90

       ctx.rotate((tile.rotation - 1) * Math.PI/2);

       ctx.beginPath();
       ctx.moveTo(-s/3, -s/3);
       ctx.lineTo(s/3, 0);
       ctx.lineTo(-s/3, s/3);
       ctx.fill();
    }

    ctx.restore();
  }

  drawBeams(ctx, beams) {
    if (!beams.length) return;

    ctx.save();
    ctx.strokeStyle = this.colors.beam;
    ctx.lineWidth = 3;
    ctx.shadowColor = this.colors.beam;
    ctx.shadowBlur = 8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();

    beams.forEach(b => {
       const x1 = this.offsetX + b.x1 * this.tileSize + this.tileSize/2;
       const y1 = this.offsetY + b.y1 * this.tileSize + this.tileSize/2;
       const x2 = this.offsetX + b.x2 * this.tileSize + this.tileSize/2;
       const y2 = this.offsetY + b.y2 * this.tileSize + this.tileSize/2;

       ctx.moveTo(x1, y1);
       ctx.lineTo(x2, y2);
    });

    ctx.stroke();
    ctx.restore();
  }
}
