import { CONSTANTS } from './utils.js';

export class Projectile {
    constructor(x, y, dx, dy, owner) {
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.owner = owner; // 'enemy' or 'player'
        this.active = true;
    }

    update(room, engine) {
        if (!this.active) return;

        // Move 1 tile per tick
        const nextX = this.x + this.dx;
        const nextY = this.y + this.dy;

        // Check Bounds
        if (nextX < 0 || nextX >= CONSTANTS.COLS || nextY < 0 || nextY >= CONSTANTS.ROWS) {
            this.active = false;
            return;
        }

        // Check Walls
        if (room.tiles[nextY][nextX].type === 'wall') {
            this.active = false;
            return;
        }

        // Check Hits
        if (this.owner === 'enemy') {
            if (engine.player.x === nextX && engine.player.y === nextY) {
                engine.damagePlayer(1);
                this.active = false;
                return;
            }
        } else {
            // Player projectile vs Enemies
            const hitEnemy = engine.enemies.find(e => e.alive && e.x === nextX && e.y === nextY);
            if (hitEnemy) {
                engine.damageEnemy(hitEnemy, 1);
                this.active = false;
                return;
            }
        }

        this.x = nextX;
        this.y = nextY;
    }
}
