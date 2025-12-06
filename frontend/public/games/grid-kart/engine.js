import { MathUtils } from './utils.js';
import { TILE } from './generator.js';
import { SFX } from './sfx.js';

const CONSTANTS = {
    MAX_SPEED: 0.5,        // Higher for 3D scale
    ACCEL: 0.005,
    BRAKE: 0.015,
    DRAG_ROAD: 0.98,
    DRAG_OFFROAD: 0.92,
    DRAG_MUD: 0.85,
    DRAG_AIR: 0.99,

    TURN_SPEED: 0.04,
    DRIFT_TURN_MOD: 1.6,   // Much sharper turning when drifting

    GRAVITY: 0.015,
    JUMP_FORCE: 0.35,
    HOP_FORCE: 0.15,

    // Drift Mechanics
    MIN_DRIFT_TIME_1: 1000, // ms for level 1 boost (Blue)
    MIN_DRIFT_TIME_2: 2500, // ms for level 2 boost (Red)
    BOOST_FORCE_1: 0.08,
    BOOST_FORCE_2: 0.15,
    BOOST_PAD_FORCE: 0.25,
};

export class Kart {
    constructor(startPos) {
        this.reset(startPos);
    }

    reset(startPos) {
        // Position
        this.x = startPos.x;
        this.y = startPos.y; // In 2D grid logic, Y is "up/down" on map. In 3D we map this to Z usually, but let's keep engine logic 2D-ish (x,y) and renderer map y->z.
                             // Actually, standard Three.js is Y-up. So Map X/Y -> Scene X/Z.
                             // Let's stick to engine using x/y as ground plane coordinates.
        this.z = 0;          // Height off ground

        this.angle = startPos.angle || 0;

        // Velocity
        this.vx = 0;
        this.vy = 0;
        this.vz = 0; // Vertical velocity

        // States
        this.isDrifting = false;
        this.driftDirection = 0; // -1 left, 1 right
        this.driftStartTime = 0;
        this.driftLevel = 0; // 0, 1 (Blue), 2 (Red)

        this.isJumping = false; // In air due to ramp or hop
        this.grounded = true;

        // Boost
        this.boostTimer = 0;

        // Checkpoints
        this.nextCheckpointIndex = 0;
        this.lap = 0;
        this.lapTimes = [];
        this.currentLapTime = 0;
        this.finished = false;

        // For visual lean
        this.steerValue = 0;
    }

    update(input, map, dt) {
        if (this.finished) {
            this.vx *= 0.95;
            this.vy *= 0.95;
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            return;
        }

        // --- 1. Ground Check & Tile Properties ---
        const tileX = Math.floor(this.x);
        const tileY = Math.floor(this.y);

        let tileType = TILE.GRASS;
        if (tileY >= 0 && tileY < map.rows && tileX >= 0 && tileX < map.cols) {
            tileType = map.grid[tileY][tileX];
        }

        // Determine ground height (simplified: 0 everywhere except maybe ramps later)
        let groundHeight = 0;
        // Future: specific ramp tiles could raise groundHeight based on position within tile

        if (this.z <= groundHeight + 0.05) {
            this.grounded = true;
            this.z = groundHeight;
            if (this.vz < 0) this.vz = 0; // Stop falling
        } else {
            this.grounded = false;
        }

        // --- 2. Input & Steering ---
        const speed = Math.hypot(this.vx, this.vy);
        const isMoving = speed > 0.01;

        // Hop / Drift Initiation
        // If grounded and pressing Space (Drift key)
        if (this.grounded && input.drift && !this.isDrifting && isMoving) {
            // Must be turning to start a drift
            if (input.left || input.right) {
                this.isDrifting = true;
                this.driftDirection = input.left ? -1 : 1;
                this.driftStartTime = performance.now();
                // Hop
                this.vz = CONSTANTS.HOP_FORCE;
                this.grounded = false;
                SFX.playJump(); // "Hop" sound
            } else {
                // Just a hop if not turning?
                this.vz = CONSTANTS.HOP_FORCE;
                this.grounded = false;
            }
        }

        // Release Drift
        if ((!input.drift || speed < 0.1) && this.isDrifting) {
            // Apply Boost?
            if (this.driftLevel > 0) {
                const boostPower = this.driftLevel === 2 ? CONSTANTS.BOOST_FORCE_2 : CONSTANTS.BOOST_FORCE_1;
                // Boost adds velocity in facing direction
                this.vx += Math.cos(this.angle) * boostPower;
                this.vy += Math.sin(this.angle) * boostPower;
                SFX.playBoost();
            }
            this.isDrifting = false;
            this.driftLevel = 0;
            this.driftDirection = 0;
        }

        // Update Drift Level
        if (this.isDrifting) {
            const driftDuration = performance.now() - this.driftStartTime;
            if (driftDuration > CONSTANTS.MIN_DRIFT_TIME_2) this.driftLevel = 2;
            else if (driftDuration > CONSTANTS.MIN_DRIFT_TIME_1) this.driftLevel = 1;
            else this.driftLevel = 0;
        }

        // Steering
        if (isMoving || !this.grounded) { // Can steer a bit in air? Maybe less.
            let turnDir = 0;
            if (input.left) turnDir = -1;
            if (input.right) turnDir = 1;

            // Reverse steering logic
            const fwd = (input.up && !input.down) ? 1 : ((input.down && !input.up) ? -1 : 1);
            // Actually, usually you steer normally in reverse in karts, but let's stick to standard behavior
            // If reversing (dot product of vel and angle < 0), invert steering?
            // Simple approach: Input Left always turns Left relative to kart.

            let turnRate = CONSTANTS.TURN_SPEED;
            if (this.isDrifting) {
                turnRate *= CONSTANTS.DRIFT_TURN_MOD;
                // While drifting, if we steer opposite to drift, we don't change drift dir, just angle
                // If we steer same way, we turn sharper.
            }

            // Apply turn
            // If drifting, we force turn in drift direction mostly, but input modulates it
            if (this.isDrifting) {
                // Drift physics: Kart rotates faster into the turn
                // Counter-steering tightens the arc or holds it?
                // Mario Kart: holding OUT widens arc, holding IN tightens it.
                // driftDirection is -1 (Left).
                // input.right (1) -> Widens (turnRate reduces)
                // input.left (-1) -> Tightens (turnRate increases)

                if (this.driftDirection === -1) { // Drifting Left
                    if (input.right) turnRate *= 0.5; // Widen
                    if (input.left) turnRate *= 1.5; // Tighten
                    this.angle -= turnRate * (speed / CONSTANTS.MAX_SPEED);
                } else { // Drifting Right
                    if (input.left) turnRate *= 0.5;
                    if (input.right) turnRate *= 1.5;
                    this.angle += turnRate * (speed / CONSTANTS.MAX_SPEED);
                }
            } else {
                // Normal turning
                // Scale turn by speed (slower moving = can turn, but 0 speed = no turn)
                // Also reverse input if moving backwards?
                // For simplicity:
                const moveDir = (this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle)) < -0.05 ? -1 : 1;
                this.angle += turnDir * turnRate * moveDir * (Math.min(speed*2, 1.0));
            }

            this.steerValue = turnDir;
        } else {
            this.steerValue = 0;
        }

        // --- 3. Acceleration & Physics ---

        let surfaceDrag = CONSTANTS.DRAG_ROAD;
        if (!this.grounded) {
            surfaceDrag = CONSTANTS.DRAG_AIR;
        } else {
            // Surface checks
            if (tileType === TILE.GRASS) surfaceDrag = CONSTANTS.DRAG_OFFROAD;
            if (tileType === TILE.MUD) surfaceDrag = CONSTANTS.DRAG_MUD;
            if (tileType === TILE.BOOST) {
                // Auto boost
                this.vx += Math.cos(this.angle) * 0.05;
                this.vy += Math.sin(this.angle) * 0.05;
                // If not boosting, play sound
                if(speed < CONSTANTS.MAX_SPEED * 1.5) SFX.playBoost();
            }
            if (tileType === TILE.JUMP) {
                 this.vz = CONSTANTS.JUMP_FORCE;
                 this.grounded = false;
                 SFX.playJump();
            }
        }

        // Gas/Brake
        if (input.up) {
            this.vx += Math.cos(this.angle) * CONSTANTS.ACCEL * dt;
            this.vy += Math.sin(this.angle) * CONSTANTS.ACCEL * dt;
        } else if (input.down) {
            this.vx -= Math.cos(this.angle) * CONSTANTS.BRAKE * dt;
            this.vy -= Math.sin(this.angle) * CONSTANTS.BRAKE * dt;
        }

        // Apply Gravity
        if (!this.grounded) {
            this.vz -= CONSTANTS.GRAVITY * dt;
        }

        // Apply Velocity
        this.vx *= Math.pow(surfaceDrag, dt);
        this.vy *= Math.pow(surfaceDrag, dt);

        const nextX = this.x + this.vx * dt;
        const nextY = this.y + this.vy * dt;

        // --- 4. Collision (Walls) ---
        // Simple Tile Collision
        // Check corners of the kart (approx size 0.6 tiles)
        if (this.checkCollision(nextX, nextY, map)) {
            // Bounce
            this.vx *= -0.5;
            this.vy *= -0.5;
            // Dont move
            SFX.playBump();
        } else {
            this.x = nextX;
            this.y = nextY;
        }

        this.z += this.vz * dt;
        if (this.z < 0) { // Floor
             this.z = 0;
             if (this.vz < -0.1) SFX.playBump(); // Land hard
             this.vz = 0;
             this.grounded = true;
        }

        // --- 5. Lap Logic ---
        this.handleCheckpoints(map, dt);
    }

    checkCollision(x, y, map) {
        // Assume kart radius ~0.3
        const r = 0.3;
        // Check 4 points or just center? Center might clip corners.
        // Let's check center against WALL tiles.
        // Better: Check if circle intersects any wall tile.

        // Scan tiles around (x,y)
        const minTx = Math.floor(x - r);
        const maxTx = Math.floor(x + r);
        const minTy = Math.floor(y - r);
        const maxTy = Math.floor(y + r);

        for(let ty = minTy; ty <= maxTy; ty++) {
            for(let tx = minTx; tx <= maxTx; tx++) {
                if (ty < 0 || ty >= map.rows || tx < 0 || tx >= map.cols) return true; // World bounds
                if (map.grid[ty][tx] === TILE.WALL) {
                    // Circle-AABB test
                    // Closest point on tile to circle center
                    const closestX = Math.max(tx, Math.min(x, tx + 1));
                    const closestY = Math.max(ty, Math.min(y, ty + 1));

                    const distX = x - closestX;
                    const distY = y - closestY;
                    const distanceSquared = (distX * distX) + (distY * distY);

                    if (distanceSquared < (r * r)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    handleCheckpoints(map, dt) {
        if (this.finished) return;

        this.currentLapTime += (16.66 * dt); // Approx ms

        const nextCP = map.checkpoints[this.nextCheckpointIndex];
        if (!nextCP) return;

        const dist = MathUtils.dist(this.x, this.y, nextCP.x + 0.5, nextCP.y + 0.5);
        if (dist < 2.5) { // Looser checkpoint radius for 3D speed
            this.nextCheckpointIndex++;
            // SFX.playCheckpoint(); // TODO

            if (this.nextCheckpointIndex >= map.checkpoints.length) {
                // Ready for finish line
            }
        }

        // Start/Finish Line
        const tileX = Math.floor(this.x);
        const tileY = Math.floor(this.y);

        // If we are on a Start tile AND have hit all checkpoints
        if (map.grid[tileY] && map.grid[tileY][tileX] === TILE.START) {
            if (this.nextCheckpointIndex >= map.checkpoints.length) {
                this.lap++;
                this.lapTimes.push(this.currentLapTime);
                this.currentLapTime = 0;
                this.nextCheckpointIndex = 0;
                SFX.playLap();
            }
        }
    }
}

export class Engine {
    constructor() {
        this.karts = [];
        this.map = null;
        this.state = 'MENU';
        this.totalLaps = 3;
    }

    loadMap(mapData) {
        this.map = mapData;
    }

    addKart(kart) {
        this.karts.push(kart);
    }

    update(dt) {
        // Audio engine modulation
        const player = this.karts[0];
        if (player) {
            const speed = Math.hypot(player.vx, player.vy);
            SFX.updateEngine(Math.min(speed / CONSTANTS.MAX_SPEED, 1.0));
        }
    }
}
