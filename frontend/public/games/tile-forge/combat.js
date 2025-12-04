import { mulberry32 } from './utils.js';

export const ARENA_COLS = 9;
export const ARENA_ROWS = 7;

export class CombatEngine {
    constructor(seed, weapons, onGameOver) {
        this.rng = mulberry32(seed ? this.hash(seed) : Date.now());
        this.weapons = weapons; // Array of weapon objects
        this.onGameOver = onGameOver;

        this.t = 0;
        this.entities = [];
        this.projectiles = [];
        this.particles = [];

        this.player = {
            id: 'player',
            type: 'player',
            x: 4,
            y: 3,
            hp: 100,
            maxHp: 100,
            moveCooldown: 0,
            moveSpeed: 150, // ms per tile
            facing: {x: 0, y: -1}, // Up
            weaponCooldowns: [0, 0, 0]
        };
        this.entities.push(this.player);

        this.waveTimer = 0;
        this.score = 0;
        this.timeLimit = 90000; // 90s
        this.elapsed = 0;
    }

    hash(str) {
        let h = 0xdeadbeef;
        for(let i=0; i<str.length; i++)
            h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
        return (h ^ h >>> 16) >>> 0;
    }

    update(dt) {
        this.t += dt;
        this.elapsed += dt;

        if (this.elapsed >= this.timeLimit || this.player.hp <= 0) {
            this.onGameOver({
                won: this.player.hp > 0,
                score: this.score,
                reason: this.player.hp <= 0 ? 'death' : 'timeout'
            });
            return;
        }

        // Spawning
        this.waveTimer -= dt;
        if (this.waveTimer <= 0) {
            this.spawnEnemy();
            this.waveTimer = 3000; // New enemy every 3s
        }

        // Entities (Player handled via input mostly, but cooldowns tick)
        if (this.player.moveCooldown > 0) this.player.moveCooldown -= dt;
        for (let i = 0; i < 3; i++) {
             if (this.player.weaponCooldowns[i] > 0) this.player.weaponCooldowns[i] -= dt;
        }

        // Enemies
        this.entities.forEach(e => {
            if (e.type === 'enemy') this.updateEnemy(e, dt);
        });

        // Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.life -= dt;
            p.x += p.vx * (dt/1000);
            p.y += p.vy * (dt/1000);

            // Bounds check
            if (p.x < -1 || p.x > ARENA_COLS || p.y < -1 || p.y > ARENA_ROWS || p.life <= 0) {
                this.projectiles.splice(i, 1);
                continue;
            }

            // Collision
            // Check against enemies
            for (const e of this.entities) {
                if (e.type === 'enemy') {
                    const dist = Math.hypot(e.x - p.x, e.y - p.y);
                    if (dist < 0.6) { // Hit
                         this.damageEntity(e, p.damage);
                         this.projectiles.splice(i, 1);

                         // Visual pop
                         this.spawnParticles(e.x, e.y, p.color, 5);
                         break;
                    }
                }
            }
        }

        // Cleanup dead
        this.entities = this.entities.filter(e => e.hp > 0);
    }

    spawnEnemy() {
        // Find empty spot edge
        const edge = Math.floor(this.rng() * 4);
        let x, y;
        if (edge === 0) { x = Math.floor(this.rng()*ARENA_COLS); y = 0; }
        else if (edge === 1) { x = Math.floor(this.rng()*ARENA_COLS); y = ARENA_ROWS-1; }
        else if (edge === 2) { x = 0; y = Math.floor(this.rng()*ARENA_ROWS); }
        else { x = ARENA_COLS-1; y = Math.floor(this.rng()*ARENA_ROWS); }

        this.entities.push({
            type: 'enemy',
            subType: 'grunt',
            x, y,
            hp: 20,
            maxHp: 20,
            speed: 1.5, // tiles per second
            color: '#e91e63'
        });
    }

    updateEnemy(e, dt) {
        // Move towards player
        const dx = this.player.x - e.x;
        const dy = this.player.y - e.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0.1) {
            e.x += (dx / dist) * e.speed * (dt/1000);
            e.y += (dy / dist) * e.speed * (dt/1000);
        }

        // Collision with player
        if (dist < 0.8) {
             // Attack
             this.player.hp -= 10 * (dt/1000); // DPS
        }
    }

    damageEntity(e, amount) {
        e.hp -= amount;
        if (e.hp <= 0) {
            this.score += 100;
        }
    }

    spawnParticles(x, y, color, count) {
        // Placeholder for renderer to read
    }

    // Input actions
    movePlayer(dx, dy) {
        if (this.player.moveCooldown > 0) return;

        const tx = Math.round(this.player.x) + dx;
        const ty = Math.round(this.player.y) + dy;

        this.player.facing = {x: dx, y: dy}; // Update facing even if blocked? Yes.

        if (tx >= 0 && tx < ARENA_COLS && ty >= 0 && ty < ARENA_ROWS) {
             this.player.x = tx;
             this.player.y = ty;
             this.player.moveCooldown = this.player.moveSpeed;
        }
    }

    useWeapon(index) {
        if (!this.weapons[index]) return;
        const w = this.weapons[index];
        if (w.charges <= 0) return;
        if (this.player.weaponCooldowns[index] > 0) return;

        w.charges--;
        this.player.weaponCooldowns[index] = w.cooldownMs;

        // Execute
        const fx = this.player.facing.x || 0;
        const fy = this.player.facing.y || -1; // Default up if 0,0 (shouldn't happen)

        // Spawn Projectile
        if (w.archetype === 'pistol' || w.archetype === 'beam') {
            const speed = w.archetype === 'beam' ? 20 : 8;
            this.projectiles.push({
                x: this.player.x,
                y: this.player.y,
                vx: fx * speed,
                vy: fy * speed,
                damage: w.power,
                color: w.element === 'fire' ? 'orange' : 'cyan',
                life: 2000
            });
        } else if (w.archetype === 'grenade') {
             // Lob? Just slow projectile for MVP
             this.projectiles.push({
                x: this.player.x,
                y: this.player.y,
                vx: fx * 5,
                vy: fy * 5,
                damage: w.power,
                color: 'green',
                life: 1000 // Explode logic later
            });
        }
        // ... other types
    }
}
