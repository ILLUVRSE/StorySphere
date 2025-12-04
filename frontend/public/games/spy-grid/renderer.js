import { TILE, DIR } from './engine.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tileSize = 64;
        this.offsetX = 0;
        this.offsetY = 0;
        this.colors = {
            floor: '#222',
            wall: '#444',
            cover: '#333',
            vent: '#2a2a4a',
            exit: '#2a4a2a',
            player: '#00ccff',
            guardPatrol: '#aaaaaa',
            guardAlert: '#ffaa00',
            guardChase: '#ff0000',
            loot: '#ffd700',
            visionSafe: 'rgba(255, 255, 255, 0.1)',
            visionAlert: 'rgba(255, 0, 0, 0.3)'
        };
    }

    resize(gameState) {
        const parent = this.canvas.parentElement;
        const size = Math.min(parent.clientWidth, parent.clientHeight);
        this.canvas.width = size;
        this.canvas.height = size; // Square aspect ratio for now

        if (gameState) {
            // Calculate tile size to fit grid
            const cols = gameState.width;
            const rows = gameState.height;
            this.tileSize = Math.floor(size / Math.max(cols, rows));
            this.offsetX = (size - cols * this.tileSize) / 2;
            this.offsetY = (size - rows * this.tileSize) / 2;
        }
    }

    draw(gameState) {
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!gameState) return;

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);

        // Draw Grid
        for (let y = 0; y < gameState.height; y++) {
            for (let x = 0; x < gameState.width; x++) {
                this.drawTile(x, y, gameState.grid[y][x]);
            }
        }

        // Draw Items
        gameState.entities.items.forEach(item => {
            this.drawItem(item);
        });

        // Draw Player
        this.drawEntity(gameState.entities.player, this.colors.player, true);

        // Draw Guards
        gameState.entities.guards.forEach(guard => {
            let color = this.colors.guardPatrol;
            if (guard.alertState === 'investigate') color = this.colors.guardAlert;
            if (guard.alertState === 'chase') color = this.colors.guardChase;
            this.drawEntity(guard, color, false);
            this.drawVisionCone(guard, gameState);
        });

        this.ctx.restore();
    }

    drawTile(x, y, type) {
        const ts = this.tileSize;
        const cx = x * ts;
        const cy = y * ts;

        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(cx, cy, ts, ts);

        if (type === TILE.WALL) {
            this.ctx.fillStyle = this.colors.wall;
            this.ctx.fillRect(cx, cy, ts, ts);
            // 3D effect
            this.ctx.fillStyle = '#555';
            this.ctx.fillRect(cx, cy, ts, ts * 0.1);
        } else if (type === TILE.COVER) {
            this.ctx.fillStyle = this.colors.cover;
            this.ctx.fillRect(cx + ts*0.2, cy + ts*0.2, ts*0.6, ts*0.6);
        } else if (type === TILE.VENT) {
            this.ctx.fillStyle = this.colors.vent;
            this.ctx.beginPath();
            this.ctx.arc(cx + ts/2, cy + ts/2, ts * 0.3, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (type === TILE.EXIT) {
            this.ctx.fillStyle = this.colors.exit;
            this.ctx.fillRect(cx, cy, ts, ts);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `${ts*0.5}px monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('EXIT', cx + ts/2, cy + ts/2);
        } else if (type === TILE.NOISE) {
             this.ctx.fillStyle = '#332222';
             this.ctx.fillRect(cx + 2, cy + 2, ts - 4, ts - 4);
        }
    }

    drawItem(item) {
        const ts = this.tileSize;
        const cx = item.x * ts + ts/2;
        const cy = item.y * ts + ts/2;

        this.ctx.fillStyle = this.colors.loot;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy - ts*0.25);
        this.ctx.lineTo(cx + ts*0.2, cy);
        this.ctx.lineTo(cx, cy + ts*0.25);
        this.ctx.lineTo(cx - ts*0.2, cy);
        this.ctx.fill();
    }

    drawEntity(entity, color, isPlayer) {
        const ts = this.tileSize;
        const cx = entity.x * ts + ts/2;
        const cy = entity.y * ts + ts/2;

        this.ctx.fillStyle = color;

        if (isPlayer) {
            // Circle
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, ts * 0.35, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            // Triangle for guard
            this.ctx.beginPath();
            const angle = this.dirToAngle(entity.dir);

            // Rotate context to simplify drawing
            this.ctx.save();
            this.ctx.translate(cx, cy);
            this.ctx.rotate(angle);

            this.ctx.moveTo(ts*0.4, 0);
            this.ctx.lineTo(-ts*0.3, ts*0.3);
            this.ctx.lineTo(-ts*0.3, -ts*0.3);
            this.ctx.fill();

            this.ctx.restore();
        }
    }

    drawVisionCone(guard, gameState) {
        // Simple visualization of vision
        // We need the computed visible tiles from the AI logic, but for now lets approximate or assume AI has attached it
        if (!guard.visibleTiles) return;

        this.ctx.fillStyle = guard.alertState === 'chase' || guard.alertState === 'investigate'
            ? this.colors.visionAlert
            : this.colors.visionSafe;

        guard.visibleTiles.forEach(pt => {
             this.ctx.fillRect(pt.x * this.tileSize, pt.y * this.tileSize, this.tileSize, this.tileSize);
        });
    }

    dirToAngle(dir) {
        if (dir === DIR.E) return 0;
        if (dir === DIR.S) return Math.PI / 2;
        if (dir === DIR.W) return Math.PI;
        if (dir === DIR.N) return -Math.PI / 2;
        return 0;
    }

    getGridFromScreen(screenX, screenY) {
        const gridX = Math.floor((screenX - this.offsetX) / this.tileSize);
        const gridY = Math.floor((screenY - this.offsetY) / this.tileSize);
        return { x: gridX, y: gridY };
    }
}
