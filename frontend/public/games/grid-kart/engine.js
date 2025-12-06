import { MathUtils } from './utils.js';
import { TILE } from './generator.js';
import { SFX } from './sfx.js';

const CONSTANTS = {
    MAX_SPEED: 0.55,
    ACCEL: 0.008,
    BRAKE: 0.02,
    DRAG_ROAD: 0.97,
    DRAG_OFFROAD: 0.90,
    DRAG_AIR: 0.99,

    TURN_SPEED: 0.05,
    DRIFT_TURN_MOD: 1.8,

    GRAVITY: 0.02,
    JUMP_FORCE: 0.4,
    HOP_FORCE: 0.18,

    // Drift Mechanics
    MIN_DRIFT_TIME_1: 800,
    MIN_DRIFT_TIME_2: 2000,
    BOOST_FORCE_1: 0.12,
    BOOST_FORCE_2: 0.25,

    // Combat
    SPINOUT_TIME: 1500, // ms
    ITEM_BOX_COOLDOWN: 3000,
};

export class Kart {
    constructor(startPos, isBot = false, engine) {
        this.engine = engine;
        this.isBot = isBot;
        this.reset(startPos);

        // Bot State
        this.currentWaypointIndex = 0;
        this.targetWaypoint = null;
    }

    reset(startPos) {
        this.x = startPos.x;
        this.y = startPos.y;
        this.z = 0;
        this.angle = startPos.angle || 0;

        this.vx = 0;
        this.vy = 0;
        this.vz = 0;

        this.isDrifting = false;
        this.driftDirection = 0;
        this.driftStartTime = 0;
        this.driftLevel = 0;

        this.grounded = true;
        this.boostTimer = 0;

        // Race State
        this.lap = 0;
        this.lapTimes = [];
        this.currentLapTime = 0;
        this.nextCheckpointIndex = 0;
        this.finished = false;
        this.rank = 1;

        // Combat State
        this.item = null; // 'TURBO', 'MISSILE', 'MINE'
        this.spinoutTimer = 0;

        // Visuals
        this.steerValue = 0;
    }

    update(input, map, dt) {
        // Handle Spinout
        if (this.spinoutTimer > 0) {
            this.spinoutTimer -= (dt * 16.66);
            this.vx *= 0.85;
            this.vy *= 0.85;
            this.steerValue = Math.sin(Date.now() / 50); // Wobble

            // Gravity still applies
            if (!this.grounded) this.vz -= CONSTANTS.GRAVITY * dt;
            this.z += this.vz * dt;
            if (this.z < 0) { this.z = 0; this.grounded = true; }

            this.x += this.vx * dt;
            this.y += this.vy * dt;
            return;
        }

        if (this.finished) {
            // Auto drive or slow stop
            this.vx *= 0.95;
            this.vy *= 0.95;
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            return;
        }

        // AI Logic override
        if (this.isBot) {
            input = this.calculateBotInput(map);
        }

        // --- 1. Ground & Tiles ---
        const tileX = Math.floor(this.x);
        const tileY = Math.floor(this.y);
        let tileType = TILE.GRASS;
        if (tileY >= 0 && tileY < map.rows && tileX >= 0 && tileX < map.cols) {
            tileType = map.grid[tileY][tileX];
        }

        if (this.z <= 0.05) {
            this.grounded = true;
            this.z = 0;
            if (this.vz < 0) this.vz = 0;
        } else {
            this.grounded = false;
        }

        // --- 2. Input & Steering ---
        const speed = Math.hypot(this.vx, this.vy);
        const isMoving = speed > 0.01;

        // Use Item
        if (input.item && this.item) {
            this.useItem();
        }

        // Drift Init
        if (this.grounded && input.drift && !this.isDrifting && isMoving && (input.left || input.right)) {
            this.isDrifting = true;
            this.driftDirection = input.left ? -1 : 1;
            this.driftStartTime = performance.now();
            this.vz = CONSTANTS.HOP_FORCE;
            this.grounded = false;
            if(!this.isBot) SFX.playJump();
        }

        // Drift Release
        if ((!input.drift || speed < 0.1) && this.isDrifting) {
            if (this.driftLevel > 0) {
                const boost = this.driftLevel === 2 ? CONSTANTS.BOOST_FORCE_2 : CONSTANTS.BOOST_FORCE_1;
                this.vx += Math.cos(this.angle) * boost;
                this.vy += Math.sin(this.angle) * boost;
                if(!this.isBot) SFX.playBoost();
            }
            this.isDrifting = false;
            this.driftLevel = 0;
        }

        // Drift Level
        if (this.isDrifting) {
            const duration = performance.now() - this.driftStartTime;
            if (duration > CONSTANTS.MIN_DRIFT_TIME_2) this.driftLevel = 2;
            else if (duration > CONSTANTS.MIN_DRIFT_TIME_1) this.driftLevel = 1;
            else this.driftLevel = 0;
        }

        // Steering Physics
        if (isMoving || !this.grounded) {
            let turnDir = 0;
            if (input.left) turnDir = -1;
            if (input.right) turnDir = 1;

            let turnRate = CONSTANTS.TURN_SPEED;
            if (this.isDrifting) {
                turnRate *= CONSTANTS.DRIFT_TURN_MOD;
                // Counter-steering logic
                if (this.driftDirection === -1) { // Drifting Left
                    if (input.right) turnRate *= 0.3; // Hold wide
                    if (input.left) turnRate *= 1.2; // Cut in
                    this.angle -= turnRate * (speed / CONSTANTS.MAX_SPEED);
                } else { // Drifting Right
                    if (input.left) turnRate *= 0.3;
                    if (input.right) turnRate *= 1.2;
                    this.angle += turnRate * (speed / CONSTANTS.MAX_SPEED);
                }
            } else {
                const moveDir = (this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle)) < -0.05 ? -1 : 1;
                this.angle += turnDir * turnRate * moveDir * Math.min(speed*3, 1.0);
            }
            this.steerValue = turnDir;
        } else {
            this.steerValue = 0;
        }

        // --- 3. Physics ---
        let drag = CONSTANTS.DRAG_ROAD;
        if (!this.grounded) drag = CONSTANTS.DRAG_AIR;
        else if (tileType === TILE.MUD) drag = 0.85;
        else if (tileType === TILE.GRASS && !this.isBot) drag = CONSTANTS.DRAG_OFFROAD; // Bots ignore grass slightly to prevent getting stuck

        // Boost Pads
        if (this.grounded && tileType === TILE.BOOST) {
            this.vx += Math.cos(this.angle) * 0.05;
            this.vy += Math.sin(this.angle) * 0.05;
        }
        // Jump Pads
        if (this.grounded && tileType === TILE.JUMP) {
            this.vz = CONSTANTS.JUMP_FORCE;
            this.grounded = false;
            if(!this.isBot) SFX.playJump();
        }

        // Gas
        if (input.up) {
            this.vx += Math.cos(this.angle) * CONSTANTS.ACCEL * dt;
            this.vy += Math.sin(this.angle) * CONSTANTS.ACCEL * dt;
        } else if (input.down) {
            this.vx -= Math.cos(this.angle) * CONSTANTS.BRAKE * dt;
            this.vy -= Math.sin(this.angle) * CONSTANTS.BRAKE * dt;
        }

        if (!this.grounded) this.vz -= CONSTANTS.GRAVITY * dt;

        this.vx *= Math.pow(drag, dt);
        this.vy *= Math.pow(drag, dt);

        const nextX = this.x + this.vx * dt;
        const nextY = this.y + this.vy * dt;

        // Collision
        if (this.checkWallCollision(nextX, nextY, map)) {
            this.vx *= -0.5;
            this.vy *= -0.5;
            if(!this.isBot) SFX.playBump();
        } else {
            this.x = nextX;
            this.y = nextY;
        }

        this.z += this.vz * dt;
        if (this.z < 0) { this.z = 0; this.vz = 0; this.grounded = true; }

        // --- 4. Logic ---
        this.handleCheckpoints(map, dt);
        this.checkItemCollisions();
    }

    calculateBotInput(map) {
        if (!map.waypoints || map.waypoints.length === 0) return { up: false, down: false, left: false, right: false };

        let target = map.waypoints[this.currentWaypointIndex];
        const dist = MathUtils.dist(this.x, this.y, target.x, target.y);

        if (dist < 2.0) {
            this.currentWaypointIndex = (this.currentWaypointIndex + 1) % map.waypoints.length;
            target = map.waypoints[this.currentWaypointIndex];
        }

        // Angle to target
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const targetAngle = Math.atan2(dy, dx);

        // Diff
        let diff = targetAngle - this.angle;
        while (diff <= -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        const input = { up: true, down: false, left: false, right: false, drift: false, item: false };

        if (diff > 0.1) input.right = true;
        if (diff < -0.1) input.left = true;

        // Slow down for sharp turns
        if (Math.abs(diff) > 1.0) {
            input.up = false;
            // Maybe drift?
            // input.drift = true;
        }

        // Use items randomly
        if (this.item && Math.random() < 0.01) input.item = true;

        return input;
    }

    checkWallCollision(x, y, map) {
        const r = 0.3;
        const minTx = Math.floor(x - r);
        const maxTx = Math.floor(x + r);
        const minTy = Math.floor(y - r);
        const maxTy = Math.floor(y + r);

        for(let ty = minTy; ty <= maxTy; ty++) {
            for(let tx = minTx; tx <= maxTx; tx++) {
                if (ty < 0 || ty >= map.rows || tx < 0 || tx >= map.cols) return true;
                if (map.grid[ty][tx] === TILE.WALL) {
                    const closestX = Math.max(tx, Math.min(x, tx + 1));
                    const closestY = Math.max(ty, Math.min(y, ty + 1));
                    const dSq = (x-closestX)**2 + (y-closestY)**2;
                    if (dSq < r*r) return true;
                }
            }
        }
        return false;
    }

    handleCheckpoints(map, dt) {
        this.currentLapTime += (16.66 * dt);
        const nextCP = map.checkpoints[this.nextCheckpointIndex];
        if (!nextCP) return;

        if (MathUtils.dist(this.x, this.y, nextCP.x + 0.5, nextCP.y + 0.5) < 3.0) {
            this.nextCheckpointIndex++;
            if (this.nextCheckpointIndex >= map.checkpoints.length) {
                // Pre-finish
            }
        }

        const tileX = Math.floor(this.x);
        const tileY = Math.floor(this.y);
        if (map.grid[tileY] && map.grid[tileY][tileX] === TILE.START) {
            if (this.nextCheckpointIndex >= map.checkpoints.length) {
                this.lap++;
                this.lapTimes.push(this.currentLapTime);
                this.currentLapTime = 0;
                this.nextCheckpointIndex = 0;
                if (!this.isBot) SFX.playLap();
            }
        }
    }

    useItem() {
        if (!this.item) return;

        if (this.item === 'TURBO') {
            this.vx += Math.cos(this.angle) * 0.4;
            this.vy += Math.sin(this.angle) * 0.4;
            if(!this.isBot) SFX.playBoost();
        }
        else if (this.item === 'MISSILE') {
            // Spawn Projectile
            this.engine.spawnProjectile({
                x: this.x + Math.cos(this.angle)*0.8,
                y: this.y + Math.sin(this.angle)*0.8,
                angle: this.angle,
                owner: this
            });
            if(!this.isBot) SFX.playShoot();
        }
        else if (this.item === 'MINE') {
            this.engine.spawnMine({
                x: this.x - Math.cos(this.angle)*0.8,
                y: this.y - Math.sin(this.angle)*0.8,
                owner: this
            });
        }

        this.item = null;
    }

    checkItemCollisions() {
        if (this.item) return; // Full

        for(const itemBox of this.engine.items) {
            if (itemBox.active && itemBox.type === 'BOX') {
                const d = MathUtils.dist(this.x, this.y, itemBox.x, itemBox.y);
                if (d < 0.6) {
                    itemBox.active = false;
                    // Roulette
                    const r = Math.random();
                    if (r < 0.4) this.item = 'TURBO';
                    else if (r < 0.8) this.item = 'MISSILE';
                    else this.item = 'MINE';

                    if(!this.isBot) SFX.playItem();

                    // Respawn timer handled by engine
                    setTimeout(() => { itemBox.active = true; }, CONSTANTS.ITEM_BOX_COOLDOWN);
                }
            }
        }
    }

    hit() {
        if (this.spinoutTimer > 0) return; // Invincible
        this.spinoutTimer = CONSTANTS.SPINOUT_TIME;
        this.vz = 0.3; // Pop up
        if (!this.isBot) SFX.playExplosion();
    }
}

export class Engine {
    constructor() {
        this.karts = [];
        this.map = null;
        this.state = 'MENU';
        this.totalLaps = 3;

        this.projectiles = [];
        this.items = []; // Boxes and Mines
    }

    loadMap(mapData) {
        this.map = mapData;
        this.items = [];

        // Spawn Item Boxes on Boost tiles (override them? Or add new special tile?)
        // Let's iterate grid and place boxes on 'BOOST' tiles with 50% chance, converting them back to road?
        // Or better: Just spawn them dynamically on straightaways.
        // For now: 10 random item boxes on road tiles.

        // Find road tiles
        const roads = [];
        for(let y=0; y<mapData.rows; y++){
            for(let x=0; x<mapData.cols; x++){
                if(mapData.grid[y][x] === TILE.ROAD) roads.push({x, y});
            }
        }

        // Shuffle and pick 10
        roads.sort(() => Math.random() - 0.5);
        roads.slice(0, 12).forEach(pt => {
             this.items.push({
                 x: pt.x + 0.5,
                 y: pt.y + 0.5,
                 type: 'BOX',
                 active: true
             });
        });
    }

    addKart(kart) {
        this.karts.push(kart);
    }

    spawnProjectile(data) {
        this.projectiles.push({
            x: data.x,
            y: data.y,
            vx: Math.cos(data.angle) * 0.8,
            vy: Math.sin(data.angle) * 0.8,
            owner: data.owner,
            active: true,
            life: 2000 // ms
        });
    }

    spawnMine(data) {
        this.items.push({
            x: data.x,
            y: data.y,
            type: 'MINE',
            owner: data.owner,
            active: true
        });
    }

    update(dt) {
        // Audio engine modulation
        const player = this.karts[0]; // Assume 0 is player
        if (player) {
            const speed = Math.hypot(player.vx, player.vy);
            SFX.updateEngine(Math.min(speed / CONSTANTS.MAX_SPEED, 1.0));
        }

        // Sort Rank
        // Simple rank: Lap > Checkpoint > Distance to next checkpoint
        // For simplicity: Lap > Checkpoint
        this.karts.sort((a,b) => {
             const scoreA = a.lap * 1000 + a.nextCheckpointIndex * 100; // + dist factor
             const scoreB = b.lap * 1000 + b.nextCheckpointIndex * 100;
             return scoreB - scoreA;
        });
        this.karts.forEach((k, i) => k.rank = i + 1);

        // Update Projectiles
        this.projectiles.forEach(p => {
            if (!p.active) return;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt * 16;
            if (p.life <= 0) p.active = false;

            // Check Collision with Walls
            // (Simple bounds check for now)

            // Check Collision with Karts
            this.karts.forEach(k => {
                if (k === p.owner) return; // Don't hit self
                if (MathUtils.dist(p.x, p.y, k.x, k.y) < 0.5) {
                    k.hit();
                    p.active = false;
                }
            });
        });

        // Update Mines (Collision)
        this.items.forEach(item => {
            if (!item.active || item.type !== 'MINE') return;
            this.karts.forEach(k => {
                if (MathUtils.dist(item.x, item.y, k.x, k.y) < 0.5) {
                    k.hit();
                    item.active = false;
                }
            });
        });

    }
}
