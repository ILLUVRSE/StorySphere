import { Vec2, Collision, mulberry32, Vec2D, Circle, Rect } from './utils';

export interface PlayerState extends Circle {
    vx: number;
    vy: number;
    dashTimer: number;
    dashCooldown: number;
    score: number;
}

export interface PuckState extends Circle {
    vx: number;
    vy: number;
}

export interface MapData {
    gridW: number;
    gridH: number;
    spawns: {
        p1: { x: number, y: number },
        p2: { x: number, y: number },
        puck: { x: number, y: number }
    };
    goals: { owner: number, y: number, h: number }[];
    tiles?: { type: string, x: number, y: number, w: number, h: number }[];
    bumpers?: { x: number, y: number, radius: number }[];
}

export interface InputState {
    device?: 'mouse' | 'keyboard' | 'touch';
    x?: number; // Mouse/Touch position
    y?: number;
    moveVector?: Vec2D; // Keyboard/Joystick
    dash: boolean;
}

export interface GameState {
    puck: PuckState;
    p1: PlayerState;
    p2: PlayerState;
    timeMs: number;
    maxTimeMs: number;
    gameOver: boolean;
    winner: number | null;
    events: string[];
}

export class PixelPuckEngine {
    map: MapData;
    rng: () => number;

    // Config
    TICK_RATE = 60;
    DT = 1 / this.TICK_RATE;
    FRICTION = 0.015; // Air hockey friction
    WALL_BOUNCE = 0.8;
    PADDLE_BOUNCE = 1.2; // Add energy
    MAX_SPEED = 0.4; // Tiles per tick (~24 tiles/sec)
    PADDLE_SPEED = 0.15;
    DASH_SPEED_MULT = 1.8;
    DASH_DURATION = 12; // Ticks (200ms)
    DASH_COOLDOWN = 120; // Ticks (2s)

    state: GameState;

    constructor(mapData: MapData, seed?: string) {
        this.map = mapData;
        this.rng = mulberry32(seed ? this.hashCode(seed) : Date.now());

        this.state = {
            puck: {
                x: mapData.spawns.puck.x,
                y: mapData.spawns.puck.y,
                vx: 0, vy: 0,
                radius: 0.25
            },
            p1: {
                x: mapData.spawns.p1.x,
                y: mapData.spawns.p1.y,
                radius: 0.4,
                vx: 0, vy: 0,
                dashTimer: 0,
                dashCooldown: 0,
                score: 0
            },
            p2: {
                x: mapData.spawns.p2.x,
                y: mapData.spawns.p2.y,
                radius: 0.4,
                vx: 0, vy: 0,
                dashTimer: 0,
                dashCooldown: 0,
                score: 0
            },
            timeMs: 0,
            maxTimeMs: 90000, // 90s
            gameOver: false,
            winner: null,
            events: []
        };
    }

    hashCode(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    }

    // Restore state from a snapshot
    setState(state: GameState) {
        // Deep copy to prevent reference issues
        this.state = JSON.parse(JSON.stringify(state));
    }

    update(inputP1: InputState, inputP2: InputState) {
        if (this.state.gameOver) return;

        this.state.events = []; // Clear events
        this.state.timeMs += this.DT * 1000;

        // --- Player Updates ---
        this.updatePlayer(this.state.p1, inputP1, 1);
        this.updatePlayer(this.state.p2, inputP2, 2);

        // --- Puck Physics ---
        // Apply friction
        this.state.puck.vx *= (1 - this.FRICTION);
        this.state.puck.vy *= (1 - this.FRICTION);

        // Move puck
        let nextX = this.state.puck.x + this.state.puck.vx;
        let nextY = this.state.puck.y + this.state.puck.vy;

        // Tile Effects (Floor)
        let tileSpeedMult = 1.0;
        if (this.map.tiles) {
            for (const tile of this.map.tiles) {
                // Manually casting tile to Rect since types match but interface name differs
                if (Collision.circleRect({x: nextX, y: nextY, radius: this.state.puck.radius}, tile)) {
                    if (tile.type === 'speed') tileSpeedMult = 1.5;
                    if (tile.type === 'slow') tileSpeedMult = 0.5;
                    // Sticky could reduce velocity significantly
                    if (tile.type === 'sticky') {
                         this.state.puck.vx *= 0.8;
                         this.state.puck.vy *= 0.8;
                    }
                }
            }
        }

        // Clamp Speed
        const speed = Vec2.mag({x: this.state.puck.vx, y: this.state.puck.vy});
        const maxS = this.MAX_SPEED * tileSpeedMult;
        if (speed > maxS) {
            const n = Vec2.normalize({x: this.state.puck.vx, y: this.state.puck.vy});
            this.state.puck.vx = n.x * maxS;
            this.state.puck.vy = n.y * maxS;
        }

        // --- Collisions ---

        // 1. Paddles
        this.resolvePaddleCollision(this.state.p1, inputP1);
        this.resolvePaddleCollision(this.state.p2, inputP2);

        // 2. Bumpers
        if (this.map.bumpers) {
            for (const b of this.map.bumpers) {
                if (Collision.circleCircle(this.state.puck, b)) {
                    // Reflect
                    const normal = Vec2.normalize(Vec2.sub(this.state.puck, b));
                    const v = {x: this.state.puck.vx, y: this.state.puck.vy};
                    const r = Collision.reflect(v, normal);
                    this.state.puck.vx = r.x * 1.2; // Bumper bounce
                    this.state.puck.vy = r.y * 1.2;
                    // Push out
                    const overlap = (this.state.puck.radius + b.radius) - Vec2.dist(this.state.puck, b);
                    this.state.puck.x += normal.x * overlap;
                    this.state.puck.y += normal.y * overlap;

                    this.state.events.push('bumper');
                }
            }
        }

        // 3. Walls & Goals
        // Check X walls
        if (nextX - this.state.puck.radius < 0) {
            // Left Wall / Goal
            if (this.isInGoal(nextY, 1)) {
                this.scoreGoal(2); // P2 scored
                return;
            } else {
                this.state.puck.vx = Math.abs(this.state.puck.vx) * this.WALL_BOUNCE;
                this.state.puck.x = this.state.puck.radius;
                this.state.events.push('wall');
            }
        } else if (nextX + this.state.puck.radius > this.map.gridW) {
            // Right Wall / Goal
            if (this.isInGoal(nextY, 2)) {
                this.scoreGoal(1); // P1 scored
                return;
            } else {
                this.state.puck.vx = -Math.abs(this.state.puck.vx) * this.WALL_BOUNCE;
                this.state.puck.x = this.map.gridW - this.state.puck.radius;
                this.state.events.push('wall');
            }
        } else {
            this.state.puck.x = nextX;
        }

        // Check Y walls
        if (nextY - this.state.puck.radius < 0) {
            this.state.puck.vy = Math.abs(this.state.puck.vy) * this.WALL_BOUNCE;
            this.state.puck.y = this.state.puck.radius;
            this.state.events.push('wall');
        } else if (nextY + this.state.puck.radius > this.map.gridH) {
            this.state.puck.vy = -Math.abs(this.state.puck.vy) * this.WALL_BOUNCE;
            this.state.puck.y = this.map.gridH - this.state.puck.radius;
            this.state.events.push('wall');
        } else {
            this.state.puck.y = nextY;
        }

        // --- Game End Check ---
        if (this.state.timeMs >= this.state.maxTimeMs) {
            if (this.state.p1.score !== this.state.p2.score) {
                this.endGame();
            } else {
                // Sudden Death - next goal wins (handled implicitly by scoreGoal)
            }
        }
    }

    updatePlayer(player: PlayerState, input: InputState, playerNum: number) {
        // Dash Logic
        if (player.dashCooldown > 0) player.dashCooldown--;
        if (player.dashTimer > 0) player.dashTimer--;

        if (input.dash && player.dashCooldown === 0) {
            player.dashTimer = this.DASH_DURATION;
            player.dashCooldown = this.DASH_COOLDOWN;
            this.state.events.push('dash');
        }

        const isDashing = player.dashTimer > 0;
        const speed = isDashing ? this.PADDLE_SPEED * this.DASH_SPEED_MULT : this.PADDLE_SPEED;

        // Movement
        if (input.device === 'mouse' && playerNum === 1 && input.x !== undefined && input.y !== undefined) {
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
        } else if (input.moveVector) {
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

    resolvePaddleCollision(player: PlayerState, input: InputState) {
        if (Collision.circleCircle(player, this.state.puck)) {
            const normal = Vec2.normalize(Vec2.sub(this.state.puck, player));

            // Relative velocity
            // Approx player velocity from input or dash
            let playerVel = {x: 0, y: 0};
            if (input.device === 'mouse' && input.x !== undefined) {
                 // Hard to get exact vel without prev pos, assume normal pushed
                 // For now, give it a base kick strength
                 playerVel = Vec2.mult(normal, this.PADDLE_SPEED * 2);
            } else if (input.moveVector) {
                 const isDashing = player.dashTimer > 0;
                 const speed = isDashing ? this.PADDLE_SPEED * this.DASH_SPEED_MULT : this.PADDLE_SPEED;
                 playerVel = Vec2.mult(input.moveVector, speed);
            }

            // Reflect puck velocity
            // Simple elastic collision approx:
            // 1. Reflect puck vector
            // 2. Add player vector

            const v = {x: this.state.puck.vx, y: this.state.puck.vy};
            // If puck is still, just take impact

            const relativeV = Vec2.sub(v, playerVel);
            const dot = Vec2.dot(relativeV, normal);

            if (dot < 0) { // Moving towards each other
                const impulse = Vec2.mult(normal, -1.5 * dot); // 1.5 restitution
                this.state.puck.vx += impulse.x;
                this.state.puck.vy += impulse.y;

                // Add extra kick from dash
                if (player.dashTimer > 0) {
                     this.state.puck.vx += normal.x * 0.2; // Extra kick
                     this.state.puck.vy += normal.y * 0.2;
                }

                this.state.events.push('hit');
            }

            // Push out to prevent sticking
            const overlap = (player.radius + this.state.puck.radius) - Vec2.dist(player, this.state.puck);
            if (overlap > 0) {
                this.state.puck.x += normal.x * overlap;
                this.state.puck.y += normal.y * overlap;
            }
        }
    }

    isInGoal(y: number, owner: number) {
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

    scoreGoal(scorer: number) {
        if (scorer === 1) this.state.p1.score++;
        else this.state.p2.score++;

        this.state.events.push('goal');

        // Check for Suden Death win immediately
        if (this.state.timeMs >= this.state.maxTimeMs) {
            this.endGame();
            return;
        }

        this.resetPuck(scorer === 2 ? 1 : 2); // Serve to loser
    }

    resetPuck(server: number) {
        this.state.puck.vx = 0;
        this.state.puck.vy = 0;
        this.state.puck.x = this.map.gridW / 2;
        this.state.puck.y = this.map.gridH / 2;

        // Small serve push towards receiver? Or just center drop.
        // Let's just center drop for now, or push slightly to loser.
        this.state.puck.vx = (server === 1 ? -0.05 : 0.05);
    }

    endGame() {
        this.state.gameOver = true;
        if (this.state.p1.score > this.state.p2.score) this.state.winner = 1;
        else if (this.state.p2.score > this.state.p1.score) this.state.winner = 2;
        else this.state.winner = 0; // Draw
    }
}
