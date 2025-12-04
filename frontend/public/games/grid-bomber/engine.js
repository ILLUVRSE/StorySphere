import { CONSTANTS, mulberry32, cyrb128 } from './utils.js';

export class GridEngine {
  constructor(seedStr) {
    this.seedStr = seedStr;
    this.init();
  }

  init() {
    const seed = cyrb128(this.seedStr);
    this.random = mulberry32(seed);

    this.grid = []; // [row][col]
    this.players = [];
    this.bombs = [];
    this.explosions = [];
    this.powerups = [];

    this.gameOver = false;
    this.winner = null;
    this.timeLeft = 120; // seconds

    this.initGrid();
  }

  initGrid() {
      // 1. Fill walls and destructibles
      for (let r = 0; r < CONSTANTS.ROWS; r++) {
          const row = [];
          for (let c = 0; c < CONSTANTS.COLS; c++) {
              // Outer Walls
              if (r === 0 || r === CONSTANTS.ROWS - 1 || c === 0 || c === CONSTANTS.COLS - 1) {
                  row.push({ type: 'wall' });
              }
              // Fixed Pillars (Every 2nd)
              else if (r % 2 === 0 && c % 2 === 0) {
                  row.push({ type: 'wall' });
              }
              // Destructibles or Floor
              else {
                  // Reserve Spawn Zones
                  // Corners: (1,1), (1,2), (2,1)
                  // (1, C-2), (1, C-3), (2, C-2)
                  // (R-2, 1), (R-2, 2), (R-3, 1)
                  // (R-2, C-2), ...
                  if (this.isSpawnZone(c, r)) {
                      row.push({ type: 'floor' });
                  } else {
                      // Random fill
                      if (this.random() < 0.6) { // 60% density
                          row.push({ type: 'destructible', hp: 1 });
                      } else {
                          row.push({ type: 'floor' });
                      }
                  }
              }
          }
          this.grid.push(row);
      }
  }

  isSpawnZone(c, r) {
      const C = CONSTANTS.COLS;
      const R = CONSTANTS.ROWS;
      // Top-Left
      if (c <= 2 && r <= 2) return true;
      // Top-Right
      if (c >= C - 3 && r <= 2) return true;
      // Bottom-Left
      if (c <= 2 && r >= R - 3) return true;
      // Bottom-Right
      if (c >= C - 3 && r >= R - 3) return true;
      return false;
  }

  addPlayer(id, isBot, startPosIndex) {
      const coords = this.getSpawnCoords(startPosIndex);
      this.players.push({
          id,
          isBot,
          x: coords.col * CONSTANTS.TILE_SIZE,
          y: coords.row * CONSTANTS.TILE_SIZE,
          col: coords.col, // Logical grid pos
          row: coords.row,
          alive: true,
          stats: {
              range: 1,
              maxBombs: 1,
              speed: 3, // pixels per tick
              hasRemote: false
          },
          activeBombs: 0
      });
  }

  getSpawnCoords(idx) {
      // 0: TL, 1: BR, 2: TR, 3: BL (Spread out)
      const C = CONSTANTS.COLS;
      const R = CONSTANTS.ROWS;
      switch(idx) {
          case 0: return { col: 1, row: 1 };
          case 1: return { col: C-2, row: R-2 };
          case 2: return { col: C-2, row: 1 };
          case 3: return { col: 1, row: R-2 };
          default: return { col: 1, row: 1 };
      }
  }

  update(dt, inputs) {
      if (this.gameOver) return;

      // 1. Process Inputs & Move Players
      inputs.forEach(input => {
          const player = this.players.find(p => p.id === input.id);
          if (player && player.alive) {
              this.handlePlayerInput(player, input);
          }
      });

      // 2. Process Bots (AI hook active via inputs usually, but internal logic too)
      // (Bots moved via handlePlayerInput same as humans)

      // 3. Update Bombs
      const now = Date.now();
      // Iterate backwards to allow removal
      for (let i = this.bombs.length - 1; i >= 0; i--) {
          const bomb = this.bombs[i];
          if (!bomb.remote && bomb.detonateAt <= now) {
              this.explodeBomb(bomb);
          }
      }

      // 4. Update Explosions
      for (let i = this.explosions.length - 1; i >= 0; i--) {
          if (this.explosions[i].expires <= now) {
              this.explosions.splice(i, 1);
          }
      }

      // 5. Check Win Condition
      const alivePlayers = this.players.filter(p => p.alive);
      if (alivePlayers.length <= 1 && this.players.length > 1) {
          // Wait a moment before ending?
          this.gameOver = true;
          this.winner = alivePlayers.length === 1 ? alivePlayers[0] : null; // null = draw
      }
  }

  handlePlayerInput(p, input) {
      // Movement
      let dx = 0;
      let dy = 0;
      if (input.up) dy = -1;
      if (input.down) dy = 1;
      if (input.left) dx = -1;
      if (input.right) dx = 1;

      if (dx !== 0 || dy !== 0) {
          this.movePlayer(p, dx, dy);
      } else {
          // Snap to nearest pixel center if no input?
          // Optional polish.
      }

      // Action: Bomb
      if (input.action && !input.prevAction) {
          this.placeBomb(p);
      }

      // Action: Remote
      if (input.remote && !input.prevRemote && p.stats.hasRemote) {
          this.detonateRemoteBombs(p);
      }
  }

  movePlayer(p, dx, dy) {
      const speed = p.stats.speed;
      const newX = p.x + dx * speed;
      const newY = p.y + dy * speed;

      const ts = CONSTANTS.TILE_SIZE;
      const hitboxSize = ts * 0.7;
      const offset = (ts - hitboxSize) / 2;

      // Axis Aligned Bounding Box at new position
      const rect = {
          x: newX + offset,
          y: newY + offset,
          w: hitboxSize,
          h: hitboxSize
      };

      // Check collision with walls/destructibles/bombs
      if (!this.checkCollision(rect, p)) {
          p.x = newX;
          p.y = newY;

          // Update logical grid position (center point)
          p.col = Math.floor((p.x + ts/2) / ts);
          p.row = Math.floor((p.y + ts/2) / ts);

          // Check Powerup Pickup
          this.checkPowerupPickup(p);
      } else {
          // Slide along walls (Basic)
          if (dx !== 0 && dy === 0) {
               // Moving Horizontally, try aligning Y to row center
               const centerY = (p.row * ts) + (ts - hitboxSize)/2;
               if (Math.abs(p.y - centerY) < 16) {
                   if (p.y < centerY) p.y += 2;
                   else p.y -= 2;
               }
          } else if (dx === 0 && dy !== 0) {
               // Moving Vertically, try aligning X to col center
               const centerX = (p.col * ts) + (ts - hitboxSize)/2;
               if (Math.abs(p.x - centerX) < 16) {
                   if (p.x < centerX) p.x += 2;
                   else p.x -= 2;
               }
          }
      }
  }

  checkCollision(rect, player) {
      const ts = CONSTANTS.TILE_SIZE;

      // Check the 4 corners of the rect
      const corners = [
          { c: Math.floor(rect.x / ts), r: Math.floor(rect.y / ts) },
          { c: Math.floor((rect.x + rect.w) / ts), r: Math.floor(rect.y / ts) },
          { c: Math.floor(rect.x / ts), r: Math.floor((rect.y + rect.h) / ts) },
          { c: Math.floor((rect.x + rect.w) / ts), r: Math.floor((rect.y + rect.h) / ts) }
      ];

      for (const pt of corners) {
          if (pt.r < 0 || pt.r >= CONSTANTS.ROWS || pt.c < 0 || pt.c >= CONSTANTS.COLS) return true;

          const tile = this.grid[pt.r][pt.c];
          if (tile.type === 'wall' || tile.type === 'destructible') return true;

          // Check bombs
          // Note: Player can walk OUT of a bomb they just placed, but not INTO one.
          const bomb = this.bombs.find(b => b.col === pt.c && b.row === pt.r);
          if (bomb) {
              // Allow if player is currently overlapping it (just placed it)
              // This is tricky. Simplified: If player center is inside bomb tile, allow.
              const pCenterCol = Math.floor((player.x + ts/2) / ts);
              const pCenterRow = Math.floor((player.y + ts/2) / ts);
              if (pCenterCol === bomb.col && pCenterRow === bomb.row) {
                  // inside
              } else {
                  return true;
              }
          }
      }
      return false;
  }

  placeBomb(p) {
      if (p.activeBombs >= p.stats.maxBombs) return;

      // Snap to grid
      const c = Math.round(p.x / CONSTANTS.TILE_SIZE); // p.col might be slightly off
      const r = Math.round(p.y / CONSTANTS.TILE_SIZE);

      // Check if bomb already there
      if (this.bombs.some(b => b.col === c && b.row === r)) return;

      const bomb = {
          ownerId: p.id,
          col: c,
          row: r,
          range: p.stats.range,
          detonateAt: Date.now() + CONSTANTS.DEFAULT_BOMB_TIMER,
          remote: p.stats.hasRemote
      };

      this.bombs.push(bomb);
      p.activeBombs++;
  }

  detonateRemoteBombs(p) {
      // Find all bombs owned by p that are remote
      // We copy the array to safely modify the original in explodeBomb
      const toExplode = this.bombs.filter(b => b.ownerId === p.id && b.remote);
      toExplode.forEach(b => this.explodeBomb(b));
  }

  explodeBomb(bomb) {
      // Remove from list
      const idx = this.bombs.indexOf(bomb);
      if (idx === -1) return; // Already exploded (recursive chain)
      this.bombs.splice(idx, 1);

      // Update owner stats
      const owner = this.players.find(p => p.id === bomb.ownerId);
      if (owner) owner.activeBombs--;

      // Create Center Explosion
      this.addExplosion(bomb.col, bomb.row);

      // Propagate in 4 directions
      const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

      dirs.forEach(d => {
          for (let i = 1; i <= bomb.range; i++) {
              const c = bomb.col + d.x * i;
              const r = bomb.row + d.y * i;

              if (c < 0 || c >= CONSTANTS.COLS || r < 0 || r >= CONSTANTS.ROWS) break;

              const tile = this.grid[r][c];

              if (tile.type === 'wall') {
                  break; // Stop
              }

              this.addExplosion(c, r);

              // Check other bombs (Chain Reaction)
              const otherBomb = this.bombs.find(b => b.col === c && b.row === r);
              if (otherBomb) {
                  // Instant explode
                  this.explodeBomb(otherBomb);
                  break; // Chain stops propagation here? Usually yes.
              }

              if (tile.type === 'destructible') {
                  // Destroy tile
                  tile.type = 'floor';
                  // Chance to spawn powerup
                  this.trySpawnPowerup(c, r);
                  break; // Stop propagation
              }

              // Check Players (Kill)
              // Done in addExplosion or separate check?
              // Doing in checkDamage
          }
      });

      this.checkDamage();
  }

  addExplosion(c, r) {
      this.explosions.push({
          col: c,
          row: r,
          expires: Date.now() + CONSTANTS.EXPLOSION_DURATION
      });
  }

  checkDamage() {
     // For every explosion, check if it overlaps a player
     const ts = CONSTANTS.TILE_SIZE;

     this.explosions.forEach(exp => {
         this.players.forEach(p => {
             if (!p.alive) return;
             // Simple tile overlap check
             // Player center
             const pCx = p.x + ts/2;
             const pCy = p.y + ts/2;

             const eLx = exp.col * ts;
             const eRx = (exp.col + 1) * ts;
             const eTy = exp.row * ts;
             const eBy = (exp.row + 1) * ts;

             // Shrink explosion hitbox slightly to be forgiving
             if (pCx > eLx + 4 && pCx < eRx - 4 && pCy > eTy + 4 && pCy < eBy - 4) {
                 p.alive = false;
             }
         });
     });
  }

  trySpawnPowerup(c, r) {
      if (this.random() > 0.12) return; // 12% chance

      const typeRoll = this.random();
      let type = 'range';
      if (typeRoll < 0.4) type = 'range';
      else if (typeRoll < 0.7) type = 'count';
      else if (typeRoll < 0.9) type = 'speed';
      else type = 'remote';

      this.powerups.push({ col: c, row: r, type });
  }

  checkPowerupPickup(p) {
      const ts = CONSTANTS.TILE_SIZE;
      const pCx = p.x + ts/2;
      const pCy = p.y + ts/2;
      const pCol = Math.floor(pCx / ts);
      const pRow = Math.floor(pCy / ts);

      const idx = this.powerups.findIndex(pu => pu.col === pCol && pu.row === pRow);
      if (idx !== -1) {
          const pu = this.powerups[idx];
          this.applyPowerup(p, pu.type);
          this.powerups.splice(idx, 1);
      }
  }

  applyPowerup(p, type) {
      if (type === 'range') p.stats.range++;
      else if (type === 'count') p.stats.maxBombs++;
      else if (type === 'speed') p.stats.speed = Math.min(p.stats.speed + 1, 6);
      else if (type === 'remote') p.stats.hasRemote = true;
  }
}
