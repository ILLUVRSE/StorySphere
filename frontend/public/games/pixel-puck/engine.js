import { Vec2, Collision, mulberry32 } from './utils.js';

export class Engine {
    constructor(mapData, seed) {
        this.map = mapData;
        this.rng = mulberry32(seed ? this.hashCode(seed) : Date.now());

        // Config
        this.TICK_RATE = 60;
        this.DT = 1 / this.TICK_RATE;
        this.FRICTION = 0.015; // Air hockey friction
        this.WALL_BOUNCE = 0.8;
        this.PADDLE_BOUNCE = 1.2; // Add energy
        this.MAX_SPEED = 0.4; // Tiles per tick (~24 tiles/sec)
        this.PADDLE_SPEED = 0.15;
        this.DASH_SPEED_MULT = 1.8;
        this.DASH_DURATION = 12; // Ticks (200ms)
        this.DASH_COOLDOWN = 120; // Ticks (2s)

        this.puck = {
            x: mapData.spawns.puck.x,
            y: mapData.spawns.puck.y,
            vx: 0, vy: 0,
            radius: 0.25
        };

        this.p1 = {
            x: mapData.spawns.p1.x,
            y: mapData.spawns.p1.y,
            radius: 0.4,
            dashTimer: 0,
            dashCooldown: 0,
            score: 0
        };

        this.p2 = {
            x: mapData.spawns.p2.x,
            y: mapData.spawns.p2.y,
            radius: 0.4,
            dashTimer: 0,
            dashCooldown: 0,
            score: 0
        };

        this.timeMs = 0;
        this.maxTimeMs = 90000; // 90s
        this.gameOver = false;
        this.winner = null;

        // Track events for SFX
        this.events = [];
    }

    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    }

    update(inputState) {
        if (this.gameOver) return;

        this.events = []; // Clear events
        this.timeMs += this.DT * 1000;

        // --- Player Updates ---
        this.updatePlayer(this.p1, inputState.p1, 1);
        this.updatePlayer(this.p2, inputState.p2, 2);

        // --- Puck Physics ---
        // Apply friction
        this.puck.vx *= (1 - this.FRICTION);
        this.puck.vy *= (1 - this.FRICTION);

        // Move puck
        let nextX = this.puck.x + this.puck.vx;
        let nextY = this.puck.y + this.puck.vy;

        // Tile Effects (Floor)
        let tileSpeedMult = 1.0;
        if (this.map.tiles) {
            for (const tile of this.map.tiles) {
                if (Collision.circleRect({x: nextX, y: nextY, radius: this.puck.radius}, tile)) {
                    if (tile.type === 'speed') tileSpeedMult = 1.5;
                    if (tile.type === 'slow') tileSpeedMult = 0.5;
                    // Sticky could reduce velocity significantly
                    if (tile.type === 'sticky') {
                         this.puck.vx *= 0.8;
                         this.puck.vy *= 0.8;
                    }
                }
            }
        }

        // Clamp Speed
        const speed = Vec2.mag({x: this.puck.vx, y: this.puck.vy});
        const maxS = this.MAX_SPEED * tileSpeedMult;
        if (speed > maxS) {
            const n = Vec2.normalize({x: this.puck.vx, y: this.puck.vy});
            this.puck.vx = n.x * maxS;
            this.puck.vy = n.y * maxS;
        }

        // --- Collisions ---

        // 1. Paddles
        this.resolvePaddleCollision(this.p1, inputState.p1);
        this.resolvePaddleCollision(this.p2, inputState.p2);

        // 2. Bumpers
        if (this.map.bumpers) {
            for (const b of this.map.bumpers) {
                if (Collision.circleCircle(this.puck, b)) {
                    // Reflect
                    const normal = Vec2.normalize(Vec2.sub(this.puck, b));
                    const v = {x: this.puck.vx, y: this.puck.vy};
                    const r = Collision.reflect(v, normal);
                    this.puck.vx = r.x * 1.2; // Bumper bounce
                    this.puck.vy = r.y * 1.2;
                    // Push out
                    const overlap = (this.puck.radius + b.radius) - Vec2.dist(this.puck, b);
                    this.puck.x += normal.x * overlap;
                    this.puck.y += normal.y * overlap;

                    this.events.push('bumper');
                }
            }
        }

        // 3. Walls & Goals
        // Check X walls
        if (nextX - this.puck.radius < 0) {
            // Left Wall / Goal
            if (this.isInGoal(nextY, 1)) {
                this.scoreGoal(2); // P2 scored
                return;
            } else {
                this.puck.vx = Math.abs(this.puck.vx) * this.WALL_BOUNCE;
                this.puck.x = this.puck.radius;
                this.events.push('wall');
            }
        } else if (nextX + this.puck.radius > this.map.gridW) {
            // Right Wall / Goal
            if (this.isInGoal(nextY, 2)) {
                this.scoreGoal(1); // P1 scored
                return;
            } else {
                this.puck.vx = -Math.abs(this.puck.vx) * this.WALL_BOUNCE;
                this.puck.x = this.map.gridW - this.puck.radius;
                this.events.push('wall');
            }
        } else {
            this.puck.x = nextX;
        }

        // Check Y walls
        if (nextY - this.puck.radius < 0) {
            this.puck.vy = Math.abs(this.puck.vy) * this.WALL_BOUNCE;
            this.puck.y = this.puck.radius;
            this.events.push('wall');
        } else if (nextY + this.puck.radius > this.map.gridH) {
            this.puck.vy = -Math.abs(this.puck.vy) * this.WALL_BOUNCE;
            this.puck.y = this.map.gridH - this.puck.radius;
            this.events.push('wall');
        } else {
            this.puck.y = nextY;
        }

        // --- Game End Check ---
        if (this.timeMs >= this.maxTimeMs) {
            if (this.p1.score !== this.p2.score) {
                this.endGame();
            } else {
                // Sudden Death - next goal wins (handled implicitly by scoreGoal)
            }
        }
    }

    updatePlayer(player, input, playerNum) {
        // Dash Logic
        if (player.dashCooldown > 0) player.dashCooldown--;
        if (player.dashTimer > 0) player.dashTimer--;

        if (input.dash && player.dashCooldown === 0) {
            player.dashTimer = this.DASH_DURATION;
            player.dashCooldown = this.DASH_COOLDOWN;
            this.events.push('dash');
        }

        const isDashing = player.dashTimer > 0;
        const speed = isDashing ? this.PADDLE_SPEED * this.DASH_SPEED_MULT : this.PADDLE_SPEED;

        // Movement
        if (input.device === 'mouse' && playerNum === 1) {
            // Direct position control (Mouse)
            // Interpolate towards mouse pos to limit speed slightly?
            // Or strict clamp per tick? Strict clamp is better for physics stability.
            let targetX = input.x;
            let targetY = input.y;

            // Constrain to half
            if (targetX > this.map.gridW / 2 - player.radius) targetX = this.map.gridW / 2 - player.radius;

            // Limit max movement per tick to avoid teleporting through puck
            const dx = targetX - player.x;
            const dy = targetY - player.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            // Allow faster movement with mouse but not infinite
            const maxMouseSpeed = this.PADDLE_SPEED * 3;

            if (dist > maxMouseSpeed) {
                const ratio = maxMouseSpeed / dist;
                player.x += dx * ratio;
                player.y += dy * ratio;
            } else {
                player.x = targetX;
                player.y = targetY;
            }
        } else {
            // Velocity control (Keyboard/Joystick)
            player.x += input.moveVector.x * speed;
            player.y += input.moveVector.y * speed;
        }

        // Clamp to Arena & Half
        player.y = Vec2.clamp(player.y, player.radius, this.map.gridH - player.radius);

        if (playerNum === 1) {
             player.x = Vec2.clamp(player.x, player.radius, (this.map.gridW / 2) - player.radius);
        } else {
             player.x = Vec2.clamp(player.x, (this.map.gridW / 2) + player.radius, this.map.gridW - player.radius);
        }
    }

    resolvePaddleCollision(player, input) {
        if (Collision.circleCircle(player, this.puck)) {
            const normal = Vec2.normalize(Vec2.sub(this.puck, player));

            // Relative velocity
            // Approx player velocity from input or dash
            let playerVel = {x: 0, y: 0};
            if (input.device === 'mouse' && input.x !== undefined) {
                 // Hard to get exact vel without prev pos, assume normal pushed
                 // For now, give it a base kick strength
                 playerVel = Vec2.mult(normal, this.PADDLE_SPEED * 2);
            } else {
                 const isDashing = player.dashTimer > 0;
                 const speed = isDashing ? this.PADDLE_SPEED * this.DASH_SPEED_MULT : this.PADDLE_SPEED;
                 playerVel = Vec2.mult(input.moveVector, speed);
            }

            // Reflect puck velocity
            // Simple elastic collision approx:
            // 1. Reflect puck vector
            // 2. Add player vector

            const v = {x: this.puck.vx, y: this.puck.vy};
            // If puck is still, just take impact

            const relativeV = Vec2.sub(v, playerVel);
            const dot = Vec2.dot(relativeV, normal);

            if (dot < 0) { // Moving towards each other
                const impulse = Vec2.mult(normal, -1.5 * dot); // 1.5 restitution
                this.puck.vx += impulse.x;
                this.puck.vy += impulse.y;

                // Add extra kick from dash
                if (player.dashTimer > 0) {
                     this.puck.vx += normal.x * 0.2; // Extra kick
                     this.puck.vy += normal.y * 0.2;
                }

                this.events.push('hit');
            }

            // Push out to prevent sticking
            const overlap = (player.radius + this.puck.radius) - Vec2.dist(player, this.puck);
            if (overlap > 0) {
                this.puck.x += normal.x * overlap;
                this.puck.y += normal.y * overlap;
            }
        }
    }

    isInGoal(y, owner) {
        // owner 1 goal is on Left (x=0), owner 2 goal is on Right
        // Goals array has owner property
        for (const g of this.map.goals) {
            if (g.owner === owner) {
                // Goal bounds check (Y axis)
                if (y >= g.y && y <= g.y + g.h) return true;
            }
        }
        return false;
    }

    scoreGoal(scorer) {
        if (scorer === 1) this.p1.score++;
        else this.p2.score++;

        this.events.push('goal');

        // Check for Suden Death win immediately
        if (this.timeMs >= this.maxTimeMs) {
            this.endGame();
            return;
        }

        this.resetPuck(scorer === 2 ? 1 : 2); // Serve to loser
    }

    resetPuck(server) {
        this.puck.vx = 0;
        this.puck.vy = 0;
        this.puck.x = this.map.gridW / 2;
        this.puck.y = this.map.gridH / 2;

        // Small serve push towards receiver? Or just center drop.
        // Let's just center drop for now, or push slightly to loser.
        this.puck.vx = (server === 1 ? -0.05 : 0.05);
    }

    endGame() {
        this.gameOver = true;
        if (this.p1.score > this.p2.score) this.winner = 1;
        else if (this.p2.score > this.p1.score) this.winner = 2;
        else this.winner = 0; // Draw
    }
}
