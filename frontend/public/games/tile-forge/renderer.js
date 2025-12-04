export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tileSize = 40;
        this.offsetX = (480 - (8 * 40)) / 2; // Center horizontally
        this.offsetY = 20;
    }

    renderMatch(engine, dt) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Grid BG
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(this.offsetX - 5, this.offsetY - 5, (8 * 40) + 10, (8 * 40) + 10);

        // Draw Tiles
        engine.grid.forEach(row => {
            row.forEach(tile => {
                if (tile) {
                    this.drawTile(tile, engine.selectedTile);
                }
            });
        });
    }

    drawTile(tile, selected) {
        const x = this.offsetX + tile.col * this.tileSize;
        const y = this.offsetY + tile.row * this.tileSize;

        const isSelected = selected && selected.r === tile.row && selected.c === tile.col;

        let color = '#555';
        let symbol = '';

        switch(tile.type) {
            case 'fire': color = '#e53935'; symbol = '🔥'; break;
            case 'ice': color = '#039be5'; symbol = '❄️'; break;
            case 'metal': color = '#757575'; symbol = '⚙️'; break;
            case 'energy': color = '#fdd835'; symbol = '⚡'; break;
        }

        this.ctx.fillStyle = color;
        this.ctx.fillRect(x + 2, y + 2, this.tileSize - 4, this.tileSize - 4);

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '20px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(symbol, x + this.tileSize/2, y + this.tileSize/2);

        if (isSelected) {
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(x+2, y+2, this.tileSize-4, this.tileSize-4);
        }
    }

    // Helper for input
    getGridCoords(screenX, screenY) {
        // Adjust for canvas scaling if necessary (assuming 1:1 for now)
        // The click event gives client coords, we need canvas relative
        const rect = this.canvas.getBoundingClientRect();
        const x = (screenX - rect.left) * (this.canvas.width / rect.width);
        const y = (screenY - rect.top) * (this.canvas.height / rect.height);

        const c = Math.floor((x - this.offsetX) / this.tileSize);
        const r = Math.floor((y - this.offsetY) / this.tileSize);

        return {r, c};
    }

    renderCombat(engine, dt) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Arena Grid
        const cellW = 40;
        const startX = (480 - (9 * cellW)) / 2;
        const startY = (320 - (7 * cellW)) / 2;

        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(startX - 5, startY - 5, (9 * cellW) + 10, (7 * cellW) + 10);

        // Draw grid lines
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for(let i=0; i<=9; i++) {
             this.ctx.moveTo(startX + i*cellW, startY);
             this.ctx.lineTo(startX + i*cellW, startY + 7*cellW);
        }
        for(let j=0; j<=7; j++) {
             this.ctx.moveTo(startX, startY + j*cellW);
             this.ctx.lineTo(startX + 9*cellW, startY + j*cellW);
        }
        this.ctx.stroke();

        // Draw Entities
        engine.entities.forEach(e => {
             const cx = startX + e.x * cellW + cellW/2;
             const cy = startY + e.y * cellW + cellW/2;

             if (e.type === 'player') {
                 this.ctx.fillStyle = '#4caf50';
                 this.ctx.beginPath();
                 this.ctx.arc(cx, cy, 14, 0, Math.PI*2);
                 this.ctx.fill();

                 // Facing indicator
                 this.ctx.strokeStyle = '#fff';
                 this.ctx.lineWidth = 2;
                 this.ctx.beginPath();
                 this.ctx.moveTo(cx, cy);
                 this.ctx.lineTo(cx + engine.player.facing.x * 20, cy + engine.player.facing.y * 20);
                 this.ctx.stroke();

             } else if (e.type === 'enemy') {
                 this.ctx.fillStyle = e.color || '#f44336';
                 this.ctx.beginPath();
                 this.ctx.arc(cx, cy, 12, 0, Math.PI*2);
                 this.ctx.fill();
             }
        });

        // Projectiles
        engine.projectiles.forEach(p => {
            const cx = startX + p.x * cellW + cellW/2;
            const cy = startY + p.y * cellW + cellW/2;

            this.ctx.fillStyle = p.color || '#ffeb3b';
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, 4, 0, Math.PI*2);
            this.ctx.fill();
        });

        // HUD Overlay
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '14px monospace';
        this.ctx.fillText(`HP: ${Math.ceil(engine.player.hp)}`, 10, 20);
        this.ctx.fillText(`Score: ${engine.score}`, 10, 40);
        this.ctx.fillText(`Time: ${Math.ceil((engine.timeLimit - engine.elapsed)/1000)}s`, 400, 20);
    }
}
