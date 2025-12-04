// Renderer

class Renderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.laneCount = 6;
    this.laneWidth = 0;
    this.hitLineY = 0;

    // Config
    this.noteSpeed = 0.5; // pixels per ms? No, let's do unit/ms then scale
    // Actually, Engine will likely provide normalized positions or we calculate Y based on time
    // Standard approach: Y = hitLineY - (targetTime - currentTime) * speed
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Layout
    this.laneWidth = Math.min(this.width / this.laneCount, 100); // Max lane width
    this.totalGridWidth = this.laneWidth * this.laneCount;
    this.gridOffsetX = (this.width - this.totalGridWidth) / 2;
    this.hitLineY = this.height * 0.85; // 85% down
  }

  draw(state, interpolation) {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw Background/Lanes
    this.drawLanes();

    // Draw Hit Line
    this.drawHitLine();

    // Draw Notes
    this.drawNotes(state.notes, state.currentTime, state.scrollSpeed);

    // Draw Effects (Hit confirmations)
    this.drawEffects(state.effects);

    // Draw HUD
    this.drawHUD(state.score, state.combo, state.multiplier);
  }

  drawLanes() {
    this.ctx.save();
    this.ctx.translate(this.gridOffsetX, 0);

    for (let i = 0; i < this.laneCount; i++) {
        const x = i * this.laneWidth;
        // Lane background
        this.ctx.fillStyle = (i % 2 === 0) ? '#1a1a1a' : '#222';
        this.ctx.fillRect(x, 0, this.laneWidth, this.height);

        // Lane divider
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.height);
        this.ctx.stroke();
    }
    // Rightmost border
    this.ctx.beginPath();
    this.ctx.moveTo(this.laneCount * this.laneWidth, 0);
    this.ctx.lineTo(this.laneCount * this.laneWidth, this.height);
    this.ctx.stroke();

    // Key hints
    this.ctx.fillStyle = '#666';
    this.ctx.font = '20px sans-serif';
    this.ctx.textAlign = 'center';
    const keys = ['S','D','F','J','K','L'];
    for(let i=0; i<this.laneCount; i++) {
        this.ctx.fillText(keys[i], i * this.laneWidth + this.laneWidth/2, this.hitLineY + 50);
    }

    this.ctx.restore();
  }

  drawHitLine() {
    this.ctx.save();
    this.ctx.translate(this.gridOffsetX, 0);

    this.ctx.strokeStyle = '#009688'; // Teal
    this.ctx.lineWidth = 4;
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = '#009688';

    this.ctx.beginPath();
    this.ctx.moveTo(0, this.hitLineY);
    this.ctx.lineTo(this.totalGridWidth, this.hitLineY);
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawNotes(notes, currentTime, speed) {
    this.ctx.save();
    this.ctx.translate(this.gridOffsetX, 0);

    // Notes are objects: { timeMs, lane, type, ... }
    // Y = hitLineY - (noteTime - currentTime) * pixelsPerMs
    const pixelsPerMs = speed; // e.g. 0.5

    notes.forEach(note => {
        // Only draw visible notes
        const timeDiff = note.timeMs - currentTime;
        const y = this.hitLineY - (timeDiff * pixelsPerMs);

        // Culling
        if (y < -50 || y > this.height + 50) return;

        const x = note.lane * this.laneWidth;
        const w = this.laneWidth;
        const h = 20; // Note height

        // Draw Note
        this.ctx.fillStyle = this.getNoteColor(note.lane);
        this.ctx.shadowBlur = 0;

        // Simple Rect for now
        this.ctx.fillRect(x + 5, y - h/2, w - 10, h);

        // Inner detail
        this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
        this.ctx.fillRect(x + 5, y - h/2, w - 10, 4);
    });

    this.ctx.restore();
  }

  getNoteColor(lane) {
    // S, D, F -> Teal/Greenish
    // J, K, L -> Blueish?
    // Let's use standard Rhythm colors often: Blue, White, Blue, ... or simple
    const colors = [
        '#e91e63', // Pink
        '#2196f3', // Blue
        '#4caf50', // Green
        '#4caf50', // Green
        '#2196f3', // Blue
        '#e91e63'  // Pink
    ];
    return colors[lane] || '#fff';
  }

  drawEffects(effects) {
     this.ctx.save();
     this.ctx.translate(this.gridOffsetX, 0);
     this.ctx.textAlign = 'center';

     effects.forEach(eff => {
        const x = eff.lane * this.laneWidth + this.laneWidth / 2;
        const y = this.hitLineY - 50 - (Date.now() - eff.startTime) * 0.1;
        const age = Date.now() - eff.startTime;
        const alpha = 1 - Math.min(age / 500, 1);

        if (alpha > 0) {
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = eff.color;
            this.ctx.font = 'bold 30px sans-serif';
            this.ctx.fillText(eff.text, x, y);
        }
     });

     this.ctx.restore();
  }

  drawHUD(score, combo, multiplier) {
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '24px sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Score: ${score}`, 20, 40);

    if (combo > 0) {
        this.ctx.textAlign = 'center';
        this.ctx.font = 'bold 40px sans-serif';
        this.ctx.fillStyle = '#ffd700';
        this.ctx.fillText(`${combo} COMBO`, this.width / 2, this.height / 2);

        this.ctx.font = '20px sans-serif';
        this.ctx.fillText(`x${multiplier.toFixed(1)}`, this.width / 2, this.height / 2 + 30);
    }
  }
}

window.Renderer = Renderer;
