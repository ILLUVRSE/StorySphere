import { TILE, DIR } from './engine.js';
import { dist } from './utils.js';

export function updateGuards(gameState) {
    gameState.entities.guards.forEach(guard => {
        // Clear previous vision
        guard.visibleTiles = [];

        // Behavior State Machine
        if (guard.alertState === 'patrol') {
            handlePatrol(guard, gameState);
        } else if (guard.alertState === 'investigate') {
            handleInvestigate(guard, gameState);
        } else if (guard.alertState === 'chase') {
            handleChase(guard, gameState);
        }

        // Recalculate vision after move
        guard.visibleTiles = calculateVision(guard, gameState);
    });
}

function handlePatrol(guard, gameState) {
    if (!guard.patrol || guard.patrol.length === 0) return;

    // Move to next patrol point
    // Patrol is list of {x,y}. guard.patrolIndex tracks current target.
    // If at target, increment index.

    // Check if we are at the current target
    const target = guard.patrol[guard.patrolIndex];
    if (guard.x === target.x && guard.y === target.y) {
        // Advance index
        guard.patrolIndex++;
        if (guard.patrolIndex >= guard.patrol.length) {
            guard.patrolIndex = 0; // Loop
        }
    }

    const nextTarget = guard.patrol[guard.patrolIndex];

    // Determine move direction towards target
    moveTowards(guard, nextTarget.x, nextTarget.y, gameState);
}

function handleInvestigate(guard, gameState) {
    // Move towards investigation target
    if (guard.x === guard.investigateTarget.x && guard.y === guard.investigateTarget.y) {
        // Reached target, look around for a turn then return to patrol
        // For MVP: Return to patrol immediately if nothing found
        guard.alertState = 'patrol';
        // Need to find nearest patrol point or just resume?
        // Simplest: Resume current patrolIndex target.
    } else {
        moveTowards(guard, guard.investigateTarget.x, guard.investigateTarget.y, gameState);
    }
}

function handleChase(guard, gameState) {
    // Move towards player
    moveTowards(guard, gameState.entities.player.x, gameState.entities.player.y, gameState);
}

function moveTowards(guard, tx, ty, gameState) {
    const dx = Math.sign(tx - guard.x);
    const dy = Math.sign(ty - guard.y);

    // Prioritize axis with larger distance or just X then Y?
    // Simple Manhattan movement: try X, then Y.

    let moved = false;

    // Try primary axis
    if (dx !== 0 && !gameState.isOccupiedByGuard(guard.x + dx, guard.y) && gameState.isWalkable(guard.x + dx, guard.y)) {
        guard.x += dx;
        guard.dir = dx > 0 ? DIR.E : DIR.W;
        moved = true;
    } else if (dy !== 0 && !gameState.isOccupiedByGuard(guard.x, guard.y + dy) && gameState.isWalkable(guard.x, guard.y + dy)) {
        guard.y += dy;
        guard.dir = dy > 0 ? DIR.S : DIR.N;
        moved = true;
    }

    // Update facing even if didn't move, to face target?
    // If stuck, facing target is good.
    if (!moved) {
        if (Math.abs(tx - guard.x) > Math.abs(ty - guard.y)) {
             guard.dir = (tx > guard.x) ? DIR.E : DIR.W;
        } else if (ty !== guard.y) {
             guard.dir = (ty > guard.y) ? DIR.S : DIR.N;
        }
    }
}

export function checkDetection(gameState) {
    // Check if player is in any guard's vision
    for (const guard of gameState.entities.guards) {
        // Re-run vision check just in case (though updateGuards does it)
        // But detection happens AFTER player move AND AFTER guard move.
        // Actually: Player move -> Detection Check? -> Guard Move -> Detection Check?
        // Rules: "If any guard sees the player after guard step resolution"
        // So we only check once per turn, at end.

        // However, if player steps into vision, they might be seen immediately before guard moves?
        // Usually: Player Move -> Check -> Guard Move -> Check.
        // Let's rely on the calling loop to call this.

        // Check if player position is in visibleTiles
        const p = gameState.entities.player;
        const seen = guard.visibleTiles.some(t => t.x === p.x && t.y === p.y);

        if (seen) {
            return true;
        }
    }
    return false;
}

export function calculateVision(guard, gameState) {
    const tiles = [];
    const fov = 3; // Tiles range

    // Cone logic:
    // N: (0,-1). Cone is triangle widening away.
    // Scan standard directions relative to facing.

    // We can just iterate a box around guard and check if in cone + LOS
    const range = fov;

    for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
            const tx = guard.x + dx;
            const ty = guard.y + dy;

            if (tx < 0 || tx >= gameState.width || ty < 0 || ty >= gameState.height) continue;

            // 1. Check Distance
            if (Math.abs(dx) + Math.abs(dy) > range) continue; // Manhattan distance or simple radius? Blueprint says "cone/ray of tiles up to fov". Let's use Chebyshev or Manhattan? Manhattan fits grid better.

            // 2. Check Cone
            if (!isInCone(dx, dy, guard.dir)) continue;

            // 3. Raycast (LOS)
            if (hasLineOfSight(guard.x, guard.y, tx, ty, gameState)) {
                tiles.push({x: tx, y: ty});
            }
        }
    }
    return tiles;
}

function isInCone(dx, dy, dir) {
    if (dx === 0 && dy === 0) return true; // Can see own tile

    // Simple 90 degree cone (45 deg each side)
    // If N (0, -1): dy < 0, |dx| <= |dy|
    // If S (0, 1): dy > 0, |dx| <= |dy|
    // If E (1, 0): dx > 0, |dy| <= |dx|
    // If W (-1, 0): dx < 0, |dy| <= |dx|

    if (dir === DIR.N) return dy < 0 && Math.abs(dx) <= Math.abs(dy);
    if (dir === DIR.S) return dy > 0 && Math.abs(dx) <= Math.abs(dy);
    if (dir === DIR.E) return dx > 0 && Math.abs(dy) <= Math.abs(dx);
    if (dir === DIR.W) return dx < 0 && Math.abs(dy) <= Math.abs(dx);
    return false;
}

function hasLineOfSight(x0, y0, x1, y1, gameState) {
    // Bresenham's Line Algorithm
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = (x0 < x1) ? 1 : -1;
    let sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    let x = x0;
    let y = y0;

    while (true) {
        if (x === x1 && y === y1) return true; // Reached target without hitting wall

        // If this is not start, check if it blocks
        if (x !== x0 || y !== y0) {
             const tile = gameState.grid[y][x];
             if (tile === TILE.WALL || tile === TILE.COVER || tile === TILE.VENT) return false; // Cover blocks LOS
        }

        let e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x += sx;
        }
        if (e2 < dx) {
            err += dx;
            y += sy;
        }
    }
}
