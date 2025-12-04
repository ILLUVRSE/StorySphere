import { dist } from './utils.js';

export class AI {
  constructor(entity) {
    this.entity = entity;
    this.target = null;
    this.state = 'idle'; // idle, chase, flee, attack, heal
    this.reactionTime = 0.5; // seconds
    this.timer = 0;
  }

  update(dt, gameState) {
    this.timer += dt;
    if (this.timer > this.reactionTime) {
      this.timer = 0;
      this.think(gameState);
    }

    // Execute movement based on state
    if (this.state === 'chase' && this.target) {
      this.moveTo(this.target.x, this.target.y, gameState);
    } else if (this.state === 'flee' && this.target) {
      this.moveAway(this.target.x, this.target.y);
    } else if (this.state === 'heal') {
       const healTile = this.findNearestTile(gameState, 4); // 4 is heal
       if (healTile) this.moveTo(healTile.x + 0.5, healTile.y + 0.5, gameState);
    } else if (this.state === 'attack') {
        // Stop to shoot if needed, or strafe
        this.entity.input.x = 0;
        this.entity.input.y = 0;
        // Aim at target
        if (this.target) {
             const dx = this.target.x - this.entity.x;
             const dy = this.target.y - this.entity.y;
             const len = Math.sqrt(dx*dx + dy*dy);
             if (len > 0) {
                 this.entity.aim.x = dx/len;
                 this.entity.aim.y = dy/len;
             }
             this.entity.input.a1 = true; // Fire!
        }
    }

    // Reset triggers
    if (this.state !== 'attack') {
        this.entity.input.a1 = false;
    }
  }

  think(gameState) {
    // 1. Check health
    if (this.entity.hp < this.entity.maxHp * 0.3) {
        // Low HP
        const healTile = this.findNearestTile(gameState, 4);
        if (healTile) {
            this.state = 'heal';
            return;
        }
        this.state = 'flee';
        // Find nearest enemy to flee from
        this.target = this.findNearestEnemy(gameState);
        return;
    }

    // 2. Find target
    this.target = this.findNearestEnemy(gameState);
    if (!this.target) {
        this.state = 'idle';
        // Stop movement
        this.entity.input.x = 0;
        this.entity.input.y = 0;
        return;
    }

    // 3. Distance check
    const d = dist(this.entity.x, this.entity.y, this.target.x, this.target.y);
    if (d < 5 && this.canSee(gameState, this.target)) {
        this.state = 'attack';
    } else {
        this.state = 'chase';
    }
  }

  findNearestEnemy(gameState) {
    let nearest = null;
    let minD = Infinity;
    for (const ent of gameState.entities) {
        if (ent === this.entity) continue;
        if (ent.team === this.entity.team) continue;
        if (ent.hp <= 0) continue;
        const d = dist(this.entity.x, this.entity.y, ent.x, ent.y);
        if (d < minD) {
            minD = d;
            nearest = ent;
        }
    }
    return nearest;
  }

  findNearestTile(gameState, typeId) {
    let nearest = null;
    let minD = Infinity;
    for (let y = 0; y < gameState.h; y++) {
        for (let x = 0; x < gameState.w; x++) {
            if (gameState.grid[y][x].type === typeId) {
                const d = dist(this.entity.x, this.entity.y, x + 0.5, y + 0.5);
                if (d < minD) {
                    minD = d;
                    nearest = {x, y};
                }
            }
        }
    }
    return nearest;
  }

  moveTo(tx, ty, gameState) {
      const dx = tx - this.entity.x;
      const dy = ty - this.entity.y;
      const len = Math.sqrt(dx*dx + dy*dy);

      let dirX = 0;
      let dirY = 0;

      if (len > 0) {
          dirX = dx/len;
          dirY = dy/len;
          this.entity.aim.x = dirX;
          this.entity.aim.y = dirY;
      }

      // Simple Raycast Avoidance
      if (gameState && len > 0.1) {
          const nextX = this.entity.x + dirX * 0.5;
          const nextY = this.entity.y + dirY * 0.5;
          if (this.isWall(nextX, nextY, gameState)) {
              // Blocked! Try rotating 45 deg left or right
              // Right
              const rx = dirX * 0.707 - dirY * 0.707;
              const ry = dirX * 0.707 + dirY * 0.707;
              if (!this.isWall(this.entity.x + rx * 0.5, this.entity.y + ry * 0.5, gameState)) {
                  dirX = rx;
                  dirY = ry;
              } else {
                  // Left
                  const lx = dirX * 0.707 + dirY * 0.707;
                  const ly = -dirX * 0.707 + dirY * 0.707;
                   if (!this.isWall(this.entity.x + lx * 0.5, this.entity.y + ly * 0.5, gameState)) {
                      dirX = lx;
                      dirY = ly;
                  }
              }
          }
      }

      this.entity.input.x = dirX;
      this.entity.input.y = dirY;
  }

  isWall(x, y, gameState) {
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      if (tx < 0 || tx >= gameState.w || ty < 0 || ty >= gameState.h) return true;
      return gameState.grid[ty][tx].type === 1;
  }

  moveAway(tx, ty) {
      const dx = this.entity.x - tx;
      const dy = this.entity.y - ty;
      const len = Math.sqrt(dx*dx + dy*dy);
      if (len > 0) {
          this.entity.input.x = dx/len;
          this.entity.input.y = dy/len;
      }
  }

  canSee(gameState, target) {
      // Raycast check (simple)
      // For MVP, assume yes unless very blocked?
      // Actually let's just always say yes for MVP AI.
      return true;
  }
}
