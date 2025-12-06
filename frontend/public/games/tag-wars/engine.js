import { mulberry32, clamp, dist, checkCircleRectCollision } from './utils.js';
import { AI } from './ai.js';

export class Engine {
  constructor(sfx, bridge) {
    this.sfx = sfx;
    this.bridge = bridge;
    this.state = null;
    this.tickRate = 120; // 120ms logical tick
    this.w = 9;
    this.h = 7;
    this.rng = null;
    this.tagRadius = 0.8;
    // Tile types: 0=floor, 1=wall, 2=slow, 3=fast, 4=trap, 5=bounce, 6=ice
  }

  init(seed, mode = 'ffa', playerCount = 2, fillBots = true, p1Class = 'balanced') {
    this.rng = mulberry32(seed);
    this.state = {
      w: this.w,
      h: this.h,
      grid: [],
      entities: [],
      powerups: [],
      particles: [],
      mode: mode, // 'ffa', 'infection', 'koth'
      timeRemaining: 60, // seconds
      maxTime: 60,
      gameOver: false,
      tick: 0,
      scores: {}, // playerId -> score obj
      infectionState: {
        survivors: [],
        zombies: [],
        startTime: 0
      },
      hill: { // For KotH
        x: 4.5,
        y: 3.5,
        radius: 1.5,
        timer: 0,
        moveInterval: 15
      }
    };

    // Generate Map
    this.generateMap();

    // Spawn Players
    this.spawnPlayers(playerCount, fillBots, p1Class);

    this.bridge.notifyReady();
  }

  generateMap() {
    this.state.grid = [];
    for (let y = 0; y < this.h; y++) {
      const row = [];
      for (let x = 0; x < this.w; x++) {
        let type = 0;
        const r = this.rng();
        if (r < 0.1) type = 1; // wall
        else if (r < 0.15) type = 2; // slow
        else if (r < 0.18) type = 3; // fast
        else if (r < 0.20) type = 5; // bounce
        else if (r < 0.22) type = 4; // trap
        else if (r < 0.25) type = 6; // ice

        // Clear spawns and center for fairness
        if ((x < 2 && y < 2) || (x > 6 && y > 4) || (x===4 && y===3)) type = 0;

        row.push({ x, y, type, timer: 0 });
      }
      this.state.grid.push(row);
    }
  }

  spawnPlayers(count, fillBots, p1Class) {
    const spawns = [
      {x: 0, y: 0}, {x: 8, y: 6}, {x: 8, y: 0}, {x: 0, y: 6}
    ];

    const totalPlayers = fillBots ? 4 : count;

    for (let i = 0; i < totalPlayers; i++) {
      const isBot = i >= count;
      const spawn = spawns[i % spawns.length];
      // Only P1 gets the selected class for now, others random or balanced
      let className = 'balanced';
      if (i === 0) className = p1Class;
      else if (!isBot && i === 1) className = 'balanced'; // P2 default
      else if (isBot) {
          // Random bot class
          const classes = ['balanced', 'speedster', 'tank'];
          className = classes[Math.floor(this.rng() * classes.length)];
      }

      this.spawnEntity(i, spawn.x, spawn.y, isBot, className);
    }

    // Pick Initial IT
    const itIndex = Math.floor(this.rng() * this.state.entities.length);
    this.state.entities[itIndex].isIt = true;

    // Init scores
    this.state.entities.forEach(e => {
        this.state.scores[e.id] = {
            tags: 0,
            timeSurvived: 0,
            infections: 0,
            hillTime: 0,
            wasIt: e.isIt
        };
    });
  }

  spawnEntity(id, x, y, isBot, className = 'balanced') {
    const ent = {
      id: id,
      x: x + 0.5,
      y: y + 0.5,
      vx: 0,
      vy: 0,
      speedBase: 5,
      speedMod: 1,
      mass: 1.0,
      className: className,
      isIt: false,
      isBot: isBot,
      color: this.getPlayerColor(id),
      cooldowns: { tag: 0, trap: 0, ability: 0 },
      effects: [], // list of active effects {type, timer}
      input: { x: 0, y: 0, action: false, special: false },
      ai: null
    };

    // Apply Class Stats
    if (className === 'speedster') {
        ent.speedBase = 6.0;
        ent.mass = 0.6;
    } else if (className === 'tank') {
        ent.speedBase = 4.0;
        ent.mass = 2.0;
    }

    if (isBot) ent.ai = new AI(ent);
    this.state.entities.push(ent);
  }

  getPlayerColor(id) {
    const colors = ['#e91e63', '#2196f3', '#4caf50', '#ffc107'];
    return colors[id % colors.length];
  }

  update(dt, inputState) {
    if (this.state.gameOver) return;

    this.state.timeRemaining -= dt;
    if (this.state.timeRemaining <= 0) {
      this.endGame('time');
      return;
    }

    // Update Hill (KotH)
    if (this.state.mode === 'koth') {
       this.updateHill(dt);
    }

    // Process Inputs
    this.applyInputs(inputState);

    // AI Update (Placeholder)
    this.state.entities.forEach(e => { if (e.isBot && e.ai) e.ai.update(dt, this.state); });

    // Physics & Movement
    this.updatePhysics(dt);

    // Tag Logic
    this.updateTagging(dt);

    // Powerups Spawning & Cleanup
    this.updatePowerups(dt);

    // Update Particles
    this.updateParticles(dt);

    // Game Mode Specific Checks
    this.checkWinConditions();

    this.state.tick++;
  }

  spawnParticle(x, y, color, life = 0.5, size = 0.3) {
      this.state.particles.push({
          x, y, color, life, maxLife: life, size,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4
      });
  }

  updateParticles(dt) {
      for (let i = this.state.particles.length - 1; i >= 0; i--) {
          const p = this.state.particles[i];
          p.life -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.life <= 0) {
              this.state.particles.splice(i, 1);
          }
      }
  }

  applyInputs(inputState) {
      // P1
      const p1 = this.state.entities.find(e => e.id === 0 && !e.isBot);
      if (p1 && inputState.p1) {
          p1.input = { ...inputState.p1 };
      }
      // P2
      const p2 = this.state.entities.find(e => e.id === 1 && !e.isBot);
      if (p2 && inputState.p2) {
          p2.input = { ...inputState.p2 };
      }
      // ... P3, P4 if supported locally
  }

  updatePhysics(dt) {
      this.state.entities.forEach(e => {
          const tx = Math.floor(e.x);
          const ty = Math.floor(e.y);
          let tileType = 0;

          if (tx >= 0 && tx < this.w && ty >= 0 && ty < this.h) {
              const tile = this.state.grid[ty][tx];
              tileType = tile.type;
              // Trap active check handled in speed mult logic below?
              // Actually if tile.timer > 0 it is active
              if (tileType === 4 && tile.timer > 0) tileType = 4;
          }

          const isIce = (tileType === 6);

          // Calculate Target Velocity based on Input
          let tileSpeedMult = 1.0;
          if (tileType === 2) tileSpeedMult = 0.6; // Slow
          if (tileType === 3) tileSpeedMult = 1.5; // Fast
          if (tileType === 4 && this.state.grid[ty][tx].timer > 0) tileSpeedMult = 0; // Trap stopped

          const speedEffect = e.effects.find(ef => ef.type === 'speed');
          const boost = speedEffect ? 1.5 : 1.0;

          const maxSpeed = e.speedBase * e.speedMod * tileSpeedMult * boost;

          const targetVx = e.input.x * maxSpeed;
          const targetVy = e.input.y * maxSpeed;

          // Acceleration / Friction
          // If on Ice, low friction (drift). Else high friction (snappy).
          const accel = isIce ? 0.3 : 20.0;

          // Drift Particles (Ice)
          if (isIce && (Math.abs(e.vx) > 1 || Math.abs(e.vy) > 1) && Math.random() < 0.2) {
             this.spawnParticle(e.x, e.y, '#fff', 0.3, 0.1);
          }

          // Linear interpolation towards target velocity
          // v = v + (target - v) * (1 - exp(-accel * dt)) // Frame independent lerp roughly
          // Or simple Euler:
          const lerpFactor = 1 - Math.exp(-accel * dt);

          e.vx += (targetVx - e.vx) * lerpFactor;
          e.vy += (targetVy - e.vy) * lerpFactor;

          // Move
          let nx = e.x + e.vx * dt;
          let ny = e.y + e.vy * dt;

          // Wall Collisions
          // Check X
          let testX = nx;
          let testY = e.y; // First check X movement only

          // Constrain map bounds
          testX = clamp(testX, 0.5, this.w - 0.5);

          if (this.isWall(testX, testY)) {
              // Wall Bonk Juice
              if (Math.abs(e.vx) > 5) {
                  this.sfx && this.sfx.playBonk();
                  this.spawnParticle(nx, e.y, '#fff', 0.2, 0.2);
                  // TODO: Screen shake request
              }
              e.vx *= -0.3; // Bounce slightly
              nx = e.x;
          } else {
              nx = testX;
          }

          // Check Y
          testY = ny;
          // Constrain bounds
          testY = clamp(testY, 0.5, this.h - 0.5);

          if (this.isWall(nx, testY)) {
               // Wall Bonk Juice
              if (Math.abs(e.vy) > 5) {
                  this.sfx && this.sfx.playBonk();
                  this.spawnParticle(nx, ny, '#fff', 0.2, 0.2);
              }
              e.vy *= -0.3;
              ny = e.y;
          } else {
              ny = testY;
          }

          e.x = nx;
          e.y = ny;

          // Decrement effect timers
          for (let i = e.effects.length - 1; i >= 0; i--) {
              e.effects[i].timer -= dt;
              if (e.effects[i].timer <= 0) e.effects.splice(i, 1);
          }
      });
  }

  isWall(x, y) {
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return true;
      return this.state.grid[ty][tx].type === 1;
  }

  updateTagging(dt) {
    // Only update tagging on logic ticks or just interpolation?
    // Logic tick is safer, but dt works if we have cooldowns.

    const its = this.state.entities.filter(e => e.isIt);
    const others = this.state.entities.filter(e => !e.isIt);

    // KotH Mode doesn't strictly need tags to score, but tags can still stun or swap IT?
    // In KotH, usually there is no "IT". Everyone fights for hill.
    // Or, "IT" players can't score?
    // Let's keep it simple: KotH is just positioning. Tagging is disabled or used to knockback?
    // Let's say: Tagging works as "Stun" or "Knockback" in KotH.
    // Actually, let's keep Tagging logic for FFA/Infection only, or just swap logic.
    // If KotH, maybe tagging stuns the victim for 2s?

    if (this.state.mode === 'koth') {
         // Everyone can tag everyone? Or just specific interaction?
         // Let's make it so you can push people off.
         // Tagging = Stun + Push
         this.updateKotHCombat(dt);
         return;
    }

    its.forEach(it => {
        if (it.cooldowns.tag > 0) {
            it.cooldowns.tag -= dt;
            return;
        }

        others.forEach(victim => {
             // Ghost check
             const isGhost = victim.effects.some(ef => ef.type === 'invis');
             if (isGhost) return; // Can't tag ghosts

             // Check collision
             if (dist(it.x, it.y, victim.x, victim.y) < this.tagRadius) {
                 // Check if victim is shielded
                 const shield = victim.effects.find(ef => ef.type === 'shield');
                 if (shield) {
                     // Pop shield
                     victim.effects = victim.effects.filter(ef => ef.type !== 'shield');
                     it.cooldowns.tag = 1.0; // Stun attacker briefly
                     // Sound: Shield Pop
                     return;
                 }

                 this.handleTag(it, victim);
             }
        });
    });
  }

  handleTag(tagger, victim) {
      if (this.state.mode === 'ffa') {
          // Swap IT roles
          tagger.isIt = false;
          tagger.cooldowns.tag = 2.0; // Can't get tagged immediately back? Or grace period?
          // Actually, usually victim becomes IT and has a cooldown before they can tag back
          victim.isIt = true;
          victim.cooldowns.tag = 1.0; // Grace period before new IT can tag

          this.state.scores[tagger.id].tags++;
          // SFX
          if (this.sfx) this.sfx.playTag();
          // Juice
          this.spawnParticle(victim.x, victim.y, '#ffeb3b', 0.5, 0.4);

      } else if (this.state.mode === 'infection') {
          victim.isIt = true; // Spreads
          this.state.scores[tagger.id].infections++;
          if (this.sfx) this.sfx.playInfect();
      }
  }

  updatePowerups(dt) {
      // Spawn logic
      if (this.rng() < 0.005) { // Random low chance per tick
          this.spawnPowerup();
      }

      // Pickup logic
      this.state.entities.forEach(e => {
          for (let i = this.state.powerups.length - 1; i >= 0; i--) {
              const p = this.state.powerups[i];
              if (dist(e.x, e.y, p.x, p.y) < 0.6) {
                  this.applyPowerup(e, p.type);
                  this.state.powerups.splice(i, 1);
                  if (this.sfx) this.sfx.playPowerup();
                  this.spawnParticle(p.x, p.y, '#fff', 0.4, 0.3);
              }
          }
      });
  }

  spawnPowerup() {
      if (this.state.powerups.length >= 3) return;
      // Find valid spot
      let tries = 10;
      while(tries-- > 0) {
          const x = Math.floor(this.rng() * this.w);
          const y = Math.floor(this.rng() * this.h);
          if (this.state.grid[y][x].type !== 1) { // Not wall
             const types = ['speed', 'shield', 'invis', 'teleport'];
             const type = types[Math.floor(this.rng() * types.length)];
             this.state.powerups.push({x: x+0.5, y: y+0.5, type});
             return;
          }
      }
  }

  applyPowerup(ent, type) {
      if (type === 'speed') {
          ent.effects.push({type: 'speed', timer: 5.0});
      } else if (type === 'shield') {
          ent.effects.push({type: 'shield', timer: 10.0});
      } else if (type === 'invis') {
          ent.effects.push({type: 'invis', timer: 8.0});
      } else if (type === 'teleport') {
          // Teleport to random spot immediately
          let tries = 10;
          while(tries-- > 0) {
              const tx = Math.floor(this.rng() * this.w);
              const ty = Math.floor(this.rng() * this.h);
              if (this.state.grid[ty][tx].type !== 1) {
                  ent.x = tx + 0.5;
                  ent.y = ty + 0.5;
                  if (this.sfx) this.sfx.playTeleport();
                  this.spawnParticle(ent.x, ent.y, '#ab47bc', 0.5, 0.4); // Arrive particles
                  break;
              }
          }
      }
  }

  updateHill(dt) {
      this.state.hill.timer += dt;
      if (this.state.hill.timer > this.state.hill.moveInterval) {
          // Move Hill
          this.state.hill.timer = 0;
          // Find new spot
          let tries = 20;
          while(tries-- > 0) {
              const x = Math.floor(this.rng() * (this.w - 2)) + 1;
              const y = Math.floor(this.rng() * (this.h - 2)) + 1;
              if (this.state.grid[y][x].type !== 1) {
                  this.state.hill.x = x + 0.5;
                  this.state.hill.y = y + 0.5;
                  if (this.sfx) this.sfx.playHillMove(); // We need to add this
                  break;
              }
          }
      }

      // Score for being in Hill
      const rSq = this.state.hill.radius * this.state.hill.radius;
      this.state.entities.forEach(e => {
          const dSq = (e.x - this.state.hill.x)**2 + (e.y - this.state.hill.y)**2;
          if (dSq < rSq) {
              this.state.scores[e.id].hillTime += dt;
          }
      });
  }

  updateKotHCombat(dt) {
      // Allow players to shove each other
      const players = this.state.entities;
      for (let i=0; i<players.length; i++) {
          for (let j=i+1; j<players.length; j++) {
              const p1 = players[i];
              const p2 = players[j];
              if (dist(p1.x, p1.y, p2.x, p2.y) < 0.8) {
                  // Collision - Shove apart
                  const dx = p2.x - p1.x;
                  const dy = p2.y - p1.y;
                  const len = Math.sqrt(dx*dx + dy*dy) || 1;

                  // Mass-based pushing
                  const force = 5.0;
                  const p1Force = force * (p1.mass / p2.mass);
                  const p2Force = force * (p2.mass / p1.mass);

                  const pushX = (dx/len);
                  const pushY = (dy/len);

                  p2.vx += pushX * p1Force;
                  p2.vy += pushY * p1Force;
                  p1.vx -= pushX * p2Force;
                  p1.vy -= pushY * p2Force;

                  // Juice
                  if (this.sfx && (Math.abs(p1.vx) > 2 || Math.abs(p2.vx) > 2)) {
                      this.sfx.playBonk(); // Re-use bonk for shove
                  }
              }
          }
      }
  }

  checkWinConditions() {
      if (this.state.mode === 'infection') {
          const survivors = this.state.entities.filter(e => !e.isIt);
          if (survivors.length === 0) {
              this.endGame('infection_complete');
          }
      } else {
           // FFA Time checks handled in main update
      }

      // Update survival times
      this.state.entities.forEach(e => {
          if (!e.isIt) {
              this.state.scores[e.id].timeSurvived += (1/this.tickRate); // approximate
          }
      });
  }

  endGame(reason) {
      this.state.gameOver = true;
      let winnerId = -1;
      let winningScore = -1;

      // Final Score Calculation
      this.state.entities.forEach(e => {
          let score = 0;
          const s = this.state.scores[e.id];

          if (this.state.mode === 'ffa') {
              // FFA: (win ? 1M : 0) + tags*100 + surv*0.1
              // Who wins FFA? Last not it? Or most tags? Usually FFA tag is about avoiding IT.
              // Let's say Winner is the one who was IT the LEAST amount of time?
              // Or standard Tag: "Game Over" doesn't have a winner until time runs out.
              // At time out, winner is the one NOT it, or if multiple, least IT time.
              // Let's stick to the prompt: "Last player not it wins" (elimination) or "Time".
              // Prompt MVP: "most tags in time" or "last player not it".
              // Let's go with Prompt Formula: tags * 100 + timeSurvived * 0.1
              // And whoever has highest score gets the 1M bonus?

              // Actually prompt said: "winner determined by survival/time or most tags"
              // Let's declare winner as: currently NOT it (if game ends by time), or player with most tags?
              // Let's prioritize Not Being It at end.

              const isWinner = !e.isIt && reason === 'time'; // Simple rule: If time runs out, non-its win?
              // But multiple can be non-it.
              // Let's sort by Time Survived.

              score = s.tags * 100 + Math.round(s.timeSurvived * 1000 * 0.1);
              // We'll apply Win Bonus later after sorting
              s.rawScore = score;
          } else if (this.state.mode === 'koth') {
              // KotH: hillTime * 1000
              score = Math.round(s.hillTime * 1000);
              s.rawScore = score;
          } else {
              // Infection
              // Zombie: (infectedAll ? 1M : 0) + inf*1000 + remainingRound*0.2
              // Survivor: (survived ? 1M : 0) + survivedTime*0.1 + remainingSurvivors*2000

              if (e.isIt || s.wasIt) { // Was infected or started as IT
                  // Is Zombie Team
                  const infectedAll = this.state.entities.every(ent => ent.isIt);
                  score = (infectedAll ? 1000000 : 0) + s.infections * 1000 + Math.round(this.state.timeRemaining * 1000 * 0.2);
                  s.role = 'zombie';
              } else {
                  // Survivor
                  const survived = !e.isIt; // Should be true if we are here and game ended by time
                  const remainingSurvivors = this.state.entities.filter(ent => !ent.isIt).length;
                  score = (survived ? 1000000 : 0) + Math.round(s.timeSurvived * 1000 * 0.1) + (remainingSurvivors * 2000);
                  s.role = 'survivor';
              }
              s.rawScore = score;
          }
      });

      // Sort to find Winner
      const sorted = [...this.state.entities].sort((a, b) => this.state.scores[b.id].rawScore - this.state.scores[a.id].rawScore);
      winnerId = sorted[0].id;

      // Apply Win Bonus for FFA (if not already applied in formula)
      if (this.state.mode === 'ffa') {
          // Add 1M to the winner
           this.state.scores[winnerId].rawScore += 1000000;
      }

      const p1Score = this.state.scores[0].rawScore;

      if (this.bridge) {
          this.bridge.submitScore(p1Score, {
              mode: this.state.mode,
              scores: this.state.scores,
              winnerId: winnerId
          });
      }

      if (this.sfx) this.sfx.playWin();
  }
}
