import { CONSTANTS } from './utils.js';

export class BotController {
  constructor(id, engine) {
    this.id = id;
    this.engine = engine;
    this.target = null; // {col, row}
    this.path = []; // Array of {col, row}
    this.nextMove = null; // {dx, dy}
    this.rethinkTimer = 0;
  }

  update(dt) {
    const p = this.engine.players.find(p => p.id === this.id);
    if (!p || !p.alive) return;

    // Throttle AI thinking
    this.rethinkTimer -= dt;
    if (this.rethinkTimer <= 0) {
        this.think(p);
        this.rethinkTimer = 200 + Math.random() * 100; // 200-300ms
    }

    // Execute Move
    if (this.path.length > 0) {
        this.followPath(p);
    } else {
        // Stop
        this.input = { up: false, down: false, left: false, right: false, action: false };
    }
  }

  getInput() {
      return this.input || { id: this.id };
  }

  think(p) {
      // 1. Safety Check
      const danger = this.getDangerMap();
      if (danger[p.row][p.col]) {
          // In danger! Escape!
          const safeTile = this.findNearestSafeTile(p, danger);
          if (safeTile) {
              this.path = this.findPath(p, safeTile, true); // Strict pathfinding
              // If stuck, try placing bomb to clear path? No, that might kill us.
          }
          return;
      }

      // 2. Offense / Farming
      // Should I place a bomb?
      // If near destructible or player AND safe to place (have escape route)
      if (this.shouldPlaceBomb(p, danger)) {
          this.input = { ...this.input, action: true, id: this.id };
          // After placing, we will likely be in danger next tick and run away
          return;
      } else {
          // Reset action
           if (this.input) this.input.action = false;
      }

      // 3. Navigation
      if (this.path.length === 0) {
          // Pick a target
          // Priority: Powerup > Nearest Destructible > Nearest Enemy
          let target = this.findNearestPowerup(p);
          if (!target) target = this.findNearestDestructible(p);
          if (!target) target = this.findNearestEnemy(p);

          if (target) {
              this.path = this.findPath(p, target, false);
          } else {
              // Wander?
              const validMoves = this.getValidNeighbors({col: p.col, row: p.row});
              if (validMoves.length > 0) {
                  const rand = validMoves[Math.floor(Math.random() * validMoves.length)];
                  this.path = [rand];
              }
          }
      }
  }

  followPath(p) {
      const targetNode = this.path[0];
      const ts = CONSTANTS.TILE_SIZE;

      const targetX = targetNode.col * ts + ts/2;
      const targetY = targetNode.row * ts + ts/2;
      const myX = p.x + ts/2;
      const myY = p.y + ts/2;

      const dist = Math.sqrt(Math.pow(targetX - myX, 2) + Math.pow(targetY - myY, 2));

      if (dist < 4) {
          // Reached node
          this.path.shift();
          if (this.path.length > 0) this.followPath(p);
          else this.input = { id: this.id }; // Stop
          return;
      }

      const dx = targetX - myX;
      const dy = targetY - myY;

      this.input = {
          id: this.id,
          right: dx > 2,
          left: dx < -2,
          down: dy > 2,
          up: dy < -2,
          action: this.input ? this.input.action : false
      };
  }

  getDangerMap() {
      // 2D array of true/false
      const map = Array(CONSTANTS.ROWS).fill().map(() => Array(CONSTANTS.COLS).fill(false));

      this.engine.bombs.forEach(b => {
          // Mark center
          map[b.row][b.col] = true;
          // Rays
          const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
          dirs.forEach(d => {
              for (let i = 1; i <= b.range; i++) {
                  const c = b.col + d.x * i;
                  const r = b.row + d.y * i;
                  if (c < 0 || c >= CONSTANTS.COLS || r < 0 || r >= CONSTANTS.ROWS) break;
                  if (this.engine.grid[r][c].type === 'wall') break;
                  map[r][c] = true;
                  if (this.engine.grid[r][c].type === 'destructible') break;
              }
          });
      });
      return map;
  }

  shouldPlaceBomb(p, dangerMap) {
      if (p.activeBombs >= p.stats.maxBombs) return false;

      // Don't commit suicide
      // Check if placing bomb here leaves an escape route
      // Simulate bomb placement
      // This is complex for MVP.
      // Simplified: If next to destructible/enemy AND we have a straight line escape > range?

      // Check neighbors for destructibles/enemies
      const neighbors = [
          {c: p.col+1, r: p.row}, {c: p.col-1, r: p.row},
          {c: p.col, r: p.row+1}, {c: p.col, r: p.row-1}
      ];

      const hasTarget = neighbors.some(n => {
           if (n.c < 0 || n.c >= CONSTANTS.COLS || n.r < 0 || n.r >= CONSTANTS.ROWS) return false;
           const tile = this.engine.grid[n.r][n.c];
           if (tile.type === 'destructible') return true;
           // Enemy check?
           return false;
      });

      if (hasTarget) {
          // Check Escape: Do we have a path to a safe spot if we place a bomb here?
          // Assume we place bomb at p.col, p.row.
          // That tile becomes dangerous + range.
          // Can we run to a safe tile in (Timer - Buffer) time?
          return Math.random() < 0.8; // YOLO for MVP
      }
      return false;
  }

  findNearestSafeTile(p, dangerMap) {
      // BFS
      const start = {c: p.col, r: p.row};
      const queue = [start];
      const visited = new Set();
      visited.add(`${start.c},${start.r}`);

      while (queue.length > 0) {
          const curr = queue.shift();
          if (!dangerMap[curr.r][curr.c]) return {col: curr.c, row: curr.r};

          const neighbors = this.getValidNeighbors({col: curr.c, row: curr.r});
          for (const n of neighbors) {
              const key = `${n.col},${n.row}`;
              if (!visited.has(key)) {
                  visited.add(key);
                  queue.push(n);
              }
          }
      }
      return null;
  }

  findPath(p, target, strict) {
      // A* or BFS
      const start = {col: p.col, row: p.row};
      const queue = [{ node: start, path: [] }];
      const visited = new Set();
      visited.add(`${start.col},${start.row}`);

      while(queue.length > 0) {
          const { node, path } = queue.shift();
          if (node.col === target.col && node.row === target.row) return path;

          // Limit depth for perf
          if (path.length > 20) continue;

          const neighbors = this.getValidNeighbors(node, strict);

          // Sort neighbors by distance to target (Greedy/A*)
          neighbors.sort((a, b) => {
              const d1 = Math.abs(a.col - target.col) + Math.abs(a.row - target.row);
              const d2 = Math.abs(b.col - target.col) + Math.abs(b.row - target.row);
              return d1 - d2;
          });

          for (const n of neighbors) {
              const key = `${n.col},${n.row}`;
              if (!visited.has(key)) {
                  visited.add(key);
                  queue.push({ node: n, path: [...path, n] });
              }
          }
      }
      return [];
  }

  getValidNeighbors(node, avoidDanger=false) {
      const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
      const valid = [];
      const danger = avoidDanger ? this.getDangerMap() : null;

      for (const d of dirs) {
          const c = node.col + d.x;
          const r = node.row + d.y;

          if (c < 0 || c >= CONSTANTS.COLS || r < 0 || r >= CONSTANTS.ROWS) continue;

          const tile = this.engine.grid[r][c];
          // Can walk on floor or pickup (which is conceptually floor)
          // Cannot walk on wall, destructible, bomb
          if (tile.type === 'wall' || tile.type === 'destructible') continue;

          // Bomb check
          const bomb = this.engine.bombs.find(b => b.col === c && b.row === r);
          if (bomb) continue;

          if (avoidDanger && danger[r][c]) continue;

          valid.push({col: c, row: r});
      }
      return valid;
  }

  findNearestDestructible(p) {
      // Scan grid?
      let best = null;
      let minDist = Infinity;

      for(let r=0; r<CONSTANTS.ROWS; r++) {
          for(let c=0; c<CONSTANTS.COLS; c++) {
              if (this.engine.grid[r][c].type === 'destructible') {
                  const d = Math.abs(p.col - c) + Math.abs(p.row - r);
                  if (d < minDist) {
                      minDist = d;
                      best = {col: c, row: r};
                  }
              }
          }
      }
      return best;
  }

  findNearestPowerup(p) {
      let best = null;
      let minDist = Infinity;
      this.engine.powerups.forEach(pu => {
          const d = Math.abs(p.col - pu.col) + Math.abs(p.row - pu.row);
          if (d < minDist) {
              minDist = d;
              best = {col: pu.col, row: pu.row};
          }
      });
      return best;
  }

  findNearestEnemy(p) {
      let best = null;
      let minDist = Infinity;
      this.engine.players.forEach(other => {
          if (other.id !== p.id && other.alive) {
              const d = Math.abs(p.col - other.col) + Math.abs(p.row - other.row);
              if (d < minDist) {
                  minDist = d;
                  best = {col: other.col, row: other.row};
              }
          }
      });
      return best;
  }
}
