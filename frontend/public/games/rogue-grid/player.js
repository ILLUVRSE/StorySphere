import { CONSTANTS } from './utils.js';

export class Player {
    constructor(startX, startY) {
        this.x = startX; // Grid coordinates
        this.y = startY;
        this.hp = 3;
        this.maxHp = 3;
        this.alive = true;
        this.inventory = [];
    }

    // Try to move. Returns true if moved, false if blocked.
    tryMove(dx, dy, room) {
        if (!this.alive) return false;

        const newX = this.x + dx;
        const newY = this.y + dy;

        // Check Bounds
        if (newX < 0 || newX >= CONSTANTS.COLS || newY < 0 || newY >= CONSTANTS.ROWS) {
            return false;
        }

        // Check Terrain
        const tile = room.tiles[newY][newX];
        if (tile.type === 'wall') {
            return false;
        }

        // Move
        this.x = newX;
        this.y = newY;

        return true;
    }
}
