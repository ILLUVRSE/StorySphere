import { CONSTANTS } from './utils.js';

export class Enemy {
    constructor(id, type, x, y) {
        this.id = id;
        this.type = type; // 'grunt', 'shooter'
        this.x = x;
        this.y = y;
        this.hp = type === 'grunt' ? 2 : 1;
        this.alive = true;

        // AI State
        this.lastMoveTick = 0;
        this.moveInterval = type === 'grunt' ? 2 : 3; // Grunt faster than Shooter
    }

    update(tick, player, room, engine) {
        if (!this.alive) return;

        // Simple tick throttle
        if ((tick - this.lastMoveTick) >= this.moveInterval) {
            this.takeTurn(player, room, engine);
            this.lastMoveTick = tick;
        }
    }

    takeTurn(player, room, engine) {
        if (this.type === 'grunt') {
            this.behaviorChase(player, room, engine);
        } else if (this.type === 'shooter') {
            this.behaviorShooter(player, room, engine);
        }
    }

    behaviorChase(player, room, engine) {
        // Simple heuristic: Move towards player
        const dx = Math.sign(player.x - this.x);
        const dy = Math.sign(player.y - this.y);

        // Prefer axis with larger distance
        const distX = Math.abs(player.x - this.x);
        const distY = Math.abs(player.y - this.y);

        // Try primary axis
        let moveX = 0, moveY = 0;
        if (distX > distY) moveX = dx;
        else moveY = dy;

        // If adjacent to player, Attack!
        if (Math.abs(player.x - this.x) + Math.abs(player.y - this.y) === 1) {
            // Attack!
            // TODO: engine.damagePlayer(1);
            console.log(`Grunt attacks player!`);
            engine.damagePlayer(1);
            return;
        }

        // Try move
        if (!this.tryMove(moveX, moveY, room, engine)) {
            // Blocked, try secondary axis
            if (moveX !== 0) { moveX = 0; moveY = dy; }
            else { moveY = 0; moveX = dx; }

            if (!this.tryMove(moveX, moveY, room, engine)) {
                // Still blocked, stand still
            }
        }
    }

    behaviorShooter(player, room, engine) {
        // Line of sight check (Cardinal directions only)
        const dx = player.x - this.x;
        const dy = player.y - this.y;

        const isAlignedX = (dy === 0);
        const isAlignedY = (dx === 0);

        if (isAlignedX || isAlignedY) {
            // Check for walls in between? (Simplified: Just shoot)
            // Fire projectile
            const dirX = Math.sign(dx);
            const dirY = Math.sign(dy);
            engine.spawnProjectile(this.x, this.y, dirX, dirY, 'enemy');
            return;
        }

        // If not aligned, move randomly or towards alignment
        // Simple random wander to find alignment
        if (Math.random() < 0.5) {
            const dirs = [{x:1,y:0}, {x:-1,y:0}, {x:0,y:1}, {x:0,y:-1}];
            const dir = dirs[Math.floor(Math.random()*dirs.length)];
            this.tryMove(dir.x, dir.y, room, engine);
        }
    }

    tryMove(dx, dy, room, engine) {
        const nx = this.x + dx;
        const ny = this.y + dy;

        // Bounds
        if (nx < 0 || nx >= CONSTANTS.COLS || ny < 0 || ny >= CONSTANTS.ROWS) return false;

        // Walls
        if (room.tiles[ny][nx].type === 'wall') return false;

        // Other Enemies
        if (engine.enemies.some(e => e.alive && e.x === nx && e.y === ny)) return false;

        // Player collision (should be attack, handled separately)
        if (player.x === nx && player.y === ny) return false;

        this.x = nx;
        this.y = ny;
        return true;
    }
}
