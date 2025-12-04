import { CONSTANTS } from './utils.js';

export class Renderer {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.canvas.width = CONSTANTS.CANVAS_WIDTH;
        this.canvas.height = CONSTANTS.CANVAS_HEIGHT;

        // Disable anti-aliasing for crisp pixel art look (optional, but good for grids)
        this.ctx.imageSmoothingEnabled = false;
    }

    clear() {
        this.ctx.fillStyle = CONSTANTS.COLORS.BG;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawGrid() {
        // Debug grid
        this.ctx.strokeStyle = '#222';
        this.ctx.lineWidth = 1;
        for (let x = 0; x <= CONSTANTS.COLS; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * CONSTANTS.TILE_SIZE, 0);
            this.ctx.lineTo(x * CONSTANTS.TILE_SIZE, CONSTANTS.CANVAS_HEIGHT);
            this.ctx.stroke();
        }
        for (let y = 0; y <= CONSTANTS.ROWS; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * CONSTANTS.TILE_SIZE);
            this.ctx.lineTo(CONSTANTS.CANVAS_WIDTH, y * CONSTANTS.TILE_SIZE);
            this.ctx.stroke();
        }
    }

    drawLevel(room) {
        if (!room) return;

        for (let r = 0; r < CONSTANTS.ROWS; r++) {
            for (let c = 0; c < CONSTANTS.COLS; c++) {
                const tile = room.tiles[r][c];
                this.drawTile(c, r, tile);
            }
        }
    }

    drawTile(col, row, tile) {
        const x = col * CONSTANTS.TILE_SIZE;
        const y = row * CONSTANTS.TILE_SIZE;
        const s = CONSTANTS.TILE_SIZE;

        // Base Floor
        this.ctx.fillStyle = CONSTANTS.COLORS.FLOOR;
        this.ctx.fillRect(x, y, s, s);

        if (tile.type === 'wall') {
            this.ctx.fillStyle = CONSTANTS.COLORS.WALL;
            this.ctx.fillRect(x, y, s, s);
            // Highlights
            this.ctx.fillStyle = '#555';
            this.ctx.fillRect(x, y, s, 4);
        } else if (tile.type === 'door_next' || tile.type === 'door_prev') {
            this.ctx.fillStyle = '#664422'; // Door Brown
            this.ctx.fillRect(x + s*0.25, y + s*0.1, s*0.5, s*0.8);
        } else if (tile.type === 'stairs_down') {
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(x + s*0.25, y + s*0.25, s*0.5, s*0.5);
            this.ctx.strokeStyle = '#fff';
            this.ctx.strokeRect(x + s*0.25, y + s*0.25, s*0.5, s*0.5);
        }
    }

    // Placeholder for entity rendering
    drawEntity(x, y, color, label) {
        const ts = CONSTANTS.TILE_SIZE;
        // Center drawing
        const cx = x + ts / 2;
        const cy = y + ts / 2;
        const r = ts * 0.35;

        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        this.ctx.fill();

        if (label) {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(label, cx, cy);
        }
    }
}
