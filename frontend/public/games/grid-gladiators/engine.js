import { mulberry32, clamp, dist, checkCircleRectCollision } from './utils.js';
import { GLADIATORS } from './gladiators.js';
import { AI } from './ai.js';

export class Engine {
  constructor(sfx, bridge) {
    this.sfx = sfx;
    this.bridge = bridge;
    this.state = null;
    this.lastTick = 0;
    this.tickRate = 120; // ms per tick for logic
    this.accumulator = 0;
    this.w = 9;
    this.h = 7;
    this.rng = null;
  }

  init(seed, mode = 'pve') { // mode: pve, pvp
    this.rng = mulberry32(seed);
    this.state = {
      w: this.w,
      h: this.h,
      grid: [],
      entities: [],
      projectiles: [],
      particles: [],
      timeRemaining: 90,
      scores: [0, 0],
      gameOver: false,
      tick: 0
    };

    // Generate Grid
    for (let y = 0; y < this.h; y++) {
      const row = [];
      for (let x = 0; x < this.w; x++) {
        // Simple procedural gen
        let type = 0;
        const r = this.rng();
        if (r < 0.1) type = 1; // wall
        else if (r < 0.15) type = 2; // trap
        else if (r < 0.18) type = 3; // bounce
        else if (r < 0.20) type = 4; // heal

        // Keep center and spawns clear
        if ((x===0 && y===3) || (x===8 && y===3) || (x===4 && y===3)) type = 0;

        row.push({ x, y, type, timer: 0 });
      }
      this.state.grid.push(row);
    }

    // Create Players
    // P1
    this.spawnEntity(0, 3, GLADIATORS.BRUISER, 0, false);

    // P2 or Bot
    const p2Type = mode === 'pve' ? GLADIATORS.SHARPSHOOTER : GLADIATORS.TRICKSTER;
    this.spawnEntity(8, 3, p2Type, 1, mode === 'pve'); // Team 1, isBot if pve

    this.bridge.notifyReady();
  }

  spawnEntity(x, y, def, team, isBot) {
    const ent = {
      x: x + 0.5,
      y: y + 0.5,
      vx: 0,
      vy: 0,
      def: def,
      hp: def.hp,
      maxHp: def.hp,
      team: team,
      aim: { x: team === 0 ? 1 : -1, y: 0 },
      cooldowns: { a1: 0, a2: 0 },
      input: { x: 0, y: 0, a1: false, a2: false },
      isBot: isBot,
      ai: null
    };
    if (isBot) {
        ent.ai = new AI(ent);
    }
    this.state.entities.push(ent);
  }

  update(dt, inputState) {
    if (this.state.gameOver) return;

    this.state.timeRemaining -= dt;
    if (this.state.timeRemaining <= 0) {
      this.state.gameOver = true;
      this.endGame();
      return;
    }

    // Input Handling
    // Apply inputs to entities (P1 is index 0, P2 is index 1 if exists)
    const p1 = this.state.entities.find(e => e.team === 0 && !e.isBot);
    if (p1) {
        p1.input.x = inputState.p1.x;
        p1.input.y = inputState.p1.y;
        p1.input.a1 = inputState.p1.a1;
        p1.input.a2 = inputState.p1.a2;
        p1.aim = inputState.p1.aim;
    }
    const p2 = this.state.entities.find(e => e.team === 1 && !e.isBot);
    if (p2) {
        p2.input.x = inputState.p2.x;
        p2.input.y = inputState.p2.y;
        p2.input.a1 = inputState.p2.a1;
        p2.input.a2 = inputState.p2.a2;
        p2.aim = inputState.p2.aim;
    }

    // AI Update
    this.state.entities.forEach(e => {
        if (e.isBot && e.ai) e.ai.update(dt, this.state);
    });

    // Physics / Movement
    this.state.entities.forEach(e => {
        if (e.hp <= 0) return;

        // Apply input velocity
        const speed = e.def.speed * dt;
        let nx = e.x + e.input.x * speed;
        let ny = e.y + e.input.y * speed;

        // Wall collisions
        // Check grid bounds
        nx = clamp(nx, 0.5, this.w - 0.5);
        ny = clamp(ny, 0.5, this.h - 0.5);

        // Check tile collisions (walls)
        // Simple circle-tile center check or corners?
        // Let's do a simple check of the tile we are moving into
        if (this.isWall(nx, e.y)) nx = e.x;
        if (this.isWall(nx, ny)) ny = e.y;

        e.x = nx;
        e.y = ny;

        // Cooldowns
        if (e.cooldowns.a1 > 0) e.cooldowns.a1 -= dt * 1000;
        if (e.cooldowns.a2 > 0) e.cooldowns.a2 -= dt * 1000;

        // Ability usage
        if (e.input.a1 && e.cooldowns.a1 <= 0) this.useAbility(e, 0);
        if (e.input.a2 && e.cooldowns.a2 <= 0) this.useAbility(e, 1);
    });

    // Projectiles
    for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
        const p = this.state.projectiles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Hit Check
        let hit = false;
        // Wall
        if (this.isWall(p.x, p.y)) hit = true;
        // Entities
        if (!hit) {
            for (const e of this.state.entities) {
                if (e.team === p.team || e.hp <= 0) continue;
                if (dist(p.x, p.y, e.x, e.y) < e.def.radius + 0.2) {
                    this.damage(e, p.damage);
                    hit = true;
                    this.sfx.playHit();
                    break;
                }
            }
        }

        if (hit || p.life <= 0) {
            this.state.particles.push({x:p.x, y:p.y, life:0.5, size:0.2, color:'#ff0'});
            this.state.projectiles.splice(i, 1);
        }
    }

    // Particles
    for (let i = this.state.particles.length - 1; i >= 0; i--) {
        this.state.particles[i].life -= dt * 2;
        if (this.state.particles[i].life <= 0) this.state.particles.splice(i, 1);
    }

    // Tile Interactions (Traps/Heal/Bounce)
    // Run periodically or every frame? Every frame is fine for simple checks
    this.state.entities.forEach(e => {
        const tx = Math.floor(e.x);
        const ty = Math.floor(e.y);
        if (tx >=0 && tx < this.w && ty >= 0 && ty < this.h) {
            const tile = this.state.grid[ty][tx];
            if (tile.type === 2) { // Trap
                 // Damage periodically? Or once per entry? Simple: damage continuous
                 if (this.state.tick % 60 === 0) this.damage(e, 1);
            } else if (tile.type === 4) { // Heal
                 if (e.hp < e.maxHp && this.state.tick % 60 === 0) e.hp += 1;
            } else if (tile.type === 3) { // Bounce
                 // Push in aim direction
                 e.x += e.aim.x * dt * 5;
                 e.y += e.aim.y * dt * 5;
            }
        }
    });

    this.state.tick++;
  }

  isWall(x, y) {
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return true;
      return this.state.grid[ty][tx].type === 1;
  }

  damage(ent, amount) {
      ent.hp -= amount;
      if (ent.hp <= 0) {
          ent.hp = 0;
          this.state.scores[ent.team === 0 ? 1 : 0]++;
          this.sfx.playDie();
          // Respawn logic after delay? For MVP just respawn instantly or simple timer
          setTimeout(() => this.respawn(ent), 3000);
      }
  }

  respawn(ent) {
      if (this.state.gameOver) return;
      ent.hp = ent.def.hp;
      ent.x = ent.team === 0 ? 0.5 : 8.5;
      ent.y = 3.5;
  }

  useAbility(ent, index) {
      const ab = ent.def.abilities[index];
      ent.cooldowns[index === 0 ? 'a1' : 'a2'] = ab.cooldown;

      this.sfx.playShoot(); // Generic

      if (ab.type === 'projectile') {
          this.state.projectiles.push({
              x: ent.x + ent.aim.x * 0.5,
              y: ent.y + ent.aim.y * 0.5,
              vx: ent.aim.x * ab.speed,
              vy: ent.aim.y * ab.speed,
              damage: ab.damage,
              team: ent.team,
              life: ab.range / ab.speed
          });
      } else if (ab.type === 'active') {
          if (ab.id === 'dash_smash') {
              ent.x += ent.aim.x * 2;
              ent.y += ent.aim.y * 2;
              this.sfx.playDash();
          } else if (ab.id === 'blink') {
              ent.x += ent.aim.x * ab.range;
              ent.y += ent.aim.y * ab.range;
              this.sfx.playDash();
          }
      } else if (ab.type === 'deploy') {
          // Place mine at current pos
          const tx = Math.floor(ent.x);
          const ty = Math.floor(ent.y);
          if (tx >=0 && tx < this.w && ty >= 0 && ty < this.h) {
              // Convert floor to trap temporarily?
              // Or custom entity? Let's just set tile to trap for MVP simplicity
              this.state.grid[ty][tx].type = 2;
          }
      }
  }

  endGame() {
      const winnerScore = Math.max(this.state.scores[0], this.state.scores[1]);
      this.sfx.playWin();
      this.bridge.submitScore(winnerScore, {
          p1: this.state.scores[0],
          p2: this.state.scores[1],
          winner: this.state.scores[0] > this.state.scores[1] ? 'P1' : 'P2'
      });
  }
}
