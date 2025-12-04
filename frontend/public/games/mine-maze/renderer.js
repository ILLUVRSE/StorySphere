import { CONSTANTS } from './utils.js';

export class Renderer {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'gameCanvas';
        this.ctx = this.canvas.getContext('2d');
        document.body.appendChild(this.canvas); // Append to body or container

        this.width = 0;
        this.height = 0;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    init(engine) {
        this.resize();
    }

    resize() {
        // Fit to window but maintain aspect ratio or just fill
        // Arcade standard: often fixed resolution scaled up.
        // Or responsive. Let's do responsive fit.
        const targetW = window.innerWidth;
        const targetH = window.innerHeight;

        // Logical size
        const logicalW = CONSTANTS.COLS * CONSTANTS.TILE_SIZE + 20; // + padding
        const logicalH = CONSTANTS.ROWS * CONSTANTS.TILE_SIZE + 80; // + HUD + padding

        this.canvas.width = logicalW;
        this.canvas.height = logicalH;

        // Scale visual via CSS
        const scale = Math.min(targetW / logicalW, targetH / logicalH);
        this.canvas.style.width = `${logicalW * scale}px`;
        this.canvas.style.height = `${logicalH * scale}px`;
        this.canvas.style.imageRendering = 'pixelated';
        this.canvas.style.position = 'absolute';
        this.canvas.style.left = `${(targetW - logicalW * scale) / 2}px`;
        this.canvas.style.top = `${(targetH - logicalH * scale) / 2}px`;
    }

    clear() {
        this.ctx.fillStyle = CONSTANTS.COLORS.BG;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    render(engine) {
        this.clear();
        this.drawHUD(engine);
        this.drawGrid(engine);
        if (engine.gameOver) {
            this.drawGameOver(engine);
        }
    }

    drawHUD(engine) {
        this.ctx.fillStyle = CONSTANTS.COLORS.ACCENT;
        this.ctx.font = '20px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`MOVES: ${engine.movesLeft}`, 10, 30);

        this.ctx.textAlign = 'right';
        this.ctx.fillText(`SCORE: ${engine.score}`, this.canvas.width - 10, 30);

        this.ctx.fillStyle = '#666';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`SEED: ${engine.seed}`, this.canvas.width / 2, 50);

        // Bank Button
        if (!engine.gameOver) {
            const btnX = this.canvas.width - 90;
            const btnY = 0;
            const btnW = 80;
            const btnH = 30;

            // Background is technically clear or part of HUD
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(btnX, btnY, btnW, btnH);
            this.ctx.strokeStyle = '#fff';
            this.ctx.strokeRect(btnX, btnY, btnW, btnH);

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '14px monospace';
            this.ctx.fillText('BANK', btnX + btnW/2, btnY + btnH/2);
        }
    }

    drawGrid(engine) {
        const offsetX = 10;
        const offsetY = 60;

        for (let y = 0; y < CONSTANTS.ROWS; y++) {
            for (let x = 0; x < CONSTANTS.COLS; x++) {
                const tile = engine.grid[y][x];
                const px = offsetX + x * CONSTANTS.TILE_SIZE;
                const py = offsetY + y * CONSTANTS.TILE_SIZE;

                // Draw Tile BG
                if (tile.revealed) {
                    this.ctx.fillStyle = CONSTANTS.COLORS.TILE_REVEALED_EMPTY;
                } else {
                    this.ctx.fillStyle = CONSTANTS.COLORS.TILE_HIDDEN;
                }

                // Highlight hovered? (Not easily avail without input tracking in renderer, skip for MVP)

                this.ctx.fillRect(px, py, CONSTANTS.TILE_SIZE - 2, CONSTANTS.TILE_SIZE - 2); // -2 for gap

                // Draw Content
                if (tile.revealed) {
                    if (tile.type === 'mine') {
                        this.drawIcon(px, py, '💣');
                    } else if (tile.type === 'treasure') {
                        this.drawIcon(px, py, '💎', '#0af');
                        // Small value text
                        this.ctx.fillStyle = '#000';
                        this.ctx.font = '10px monospace';
                        this.ctx.textAlign = 'right';
                        this.ctx.fillText(tile.value, px + CONSTANTS.TILE_SIZE - 4, py + CONSTANTS.TILE_SIZE - 4);
                    } else if (tile.type === 'powerup') {
                        if (tile.powerupType === 'extraMove') {
                             this.drawIcon(px, py, '⚡', '#ff0');
                             this.ctx.fillStyle = '#000';
                             this.ctx.font = '10px monospace';
                             this.ctx.textAlign = 'right';
                             this.ctx.fillText("+3", px + CONSTANTS.TILE_SIZE - 4, py + CONSTANTS.TILE_SIZE - 4);
                        }
                    } else if (tile.adjacentMines > 0) {
                        this.ctx.fillStyle = this.getNumberColor(tile.adjacentMines);
                        this.ctx.font = 'bold 24px monospace';
                        this.ctx.textAlign = 'center';
                        this.ctx.textBaseline = 'middle';
                        this.ctx.fillText(tile.adjacentMines, px + CONSTANTS.TILE_SIZE/2, py + CONSTANTS.TILE_SIZE/2);
                    }
                } else if (tile.flagged) {
                    this.drawIcon(px, py, '🚩', '#f55');
                }

                // Debug: Show mines if game over
                if (engine.gameOver && tile.type === 'mine' && !tile.revealed) {
                    this.ctx.globalAlpha = 0.5;
                    this.drawIcon(px, py, '💣');
                    this.ctx.globalAlpha = 1.0;
                }
            }
        }
    }

    drawIcon(x, y, char, color = '#000') {
        this.ctx.fillStyle = color;
        this.ctx.font = '32px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(char, x + CONSTANTS.TILE_SIZE/2, y + CONSTANTS.TILE_SIZE/2);
    }

    getNumberColor(n) {
        const colors = ['#000', '#00f', '#080', '#f00', '#008', '#800', '#088', '#000', '#888'];
        return colors[n] || '#000';
    }

    drawGameOver(engine) {
        this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '40px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        let msg = "FINISHED!";
        if (engine.movesLeft > 0 && engine.grid.flat().find(t => t.type === 'mine' && t.revealed)) {
            msg = "BOOM!";
        }

        this.ctx.fillText(msg, this.canvas.width / 2, this.canvas.height / 2 - 20);

        this.ctx.font = '20px monospace';
        this.ctx.fillText(`FINAL SCORE: ${engine.score}`, this.canvas.width / 2, this.canvas.height / 2 + 20);

        this.ctx.fillStyle = '#aaa';
        this.ctx.font = '16px monospace';
        this.ctx.fillText("Refresh to play again", this.canvas.width / 2, this.canvas.height / 2 + 60);
    }
}
