  // Called continuously for smooth entity movement
  update(dt, fireInput, timestamp) {
      if (!this.alive) return { gameOver: true };

      const events = [];

      // 1. Fire Weapon
      if (fireInput && (timestamp - this.lastFireTime > CONSTANTS.FIRE_RATE_MS)) {
          this.bullets.push({
              x: CONSTANTS.SHIP_COL + 0.5,
              row: this.shipRow,
              type: 'player'
          });
          this.lastFireTime = timestamp;
          events.push({ type: 'shoot' });
      }

      // 2. Move Bullets
      const bulletDist = CONSTANTS.BULLET_SPEED * (dt / 1000);
      for (let i = this.bullets.length - 1; i >= 0; i--) {
          const b = this.bullets[i];
          b.x += bulletDist;

          if (b.x > CONSTANTS.COLS + 2) {
              this.bullets.splice(i, 1);
              continue;
          }

          let hit = false;
          for (let j = this.enemies.length - 1; j >= 0; j--) {
              const e = this.enemies[j];
              if (b.row === e.row && Math.abs(b.x - e.x) < 0.8) {
                  const ex = e.x;
                  const er = e.row;
                  this.enemies.splice(j, 1);
                  this.bullets.splice(i, 1);
                  this.score += 10;
                  events.push({ type: 'enemy_die', x: ex, row: er });
                  hit = true;
                  break;
              }
          }
          if (hit) continue;

          // Check Meteors
          // Note: b.x is float. Grid index is floor.
          // We need to account for the grid shift logic?
          // If we are at x=5.5. Grid[5] corresponds to x=5..6.
          const gridColIdx = Math.floor(b.x);
          if (gridColIdx >= 0 && gridColIdx < this.grid.length) {
              const tile = this.grid[gridColIdx][b.row];
              if (tile && tile.type === 'meteor') {
                  tile.type = 'empty';
                  const bx = b.x;
                  const br = b.row;
                  this.bullets.splice(i, 1);
                  this.score += 5;
                  events.push({ type: 'enemy_hit', x: bx, row: br });
                  continue;
              }
          }
      }

      // 3. Move Enemies
      const enemyDist = CONSTANTS.ENEMY_SPEED * (dt / 1000);
      for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          e.x -= enemyDist;

          if (Math.abs(e.x - CONSTANTS.SHIP_COL) < 0.6 && e.row === this.shipRow) {
               if (this.shield > 0) {
                  this.shield--;
                  this.enemies.splice(i, 1);
                  events.push({ type: 'shield_break' });
              } else {
                  this.alive = false;
                  return { gameOver: true, crashType: 'enemy', events };
              }
          }

          if (e.x < -2) {
              this.enemies.splice(i, 1);
          }
      }

      return { gameOver: false, events };
  }

  advanceColumn(queuedMove) {
      if (!this.alive) return { gameOver: true };

      const events = [];

      // 1. Shift Grid
      this.grid.shift();
      const newCol = this.generateColumn();
      this.grid.push(newCol);

      // 2. Shift Entities (Coordinate Space Adjustment)
      this.bullets.forEach(b => b.x -= 1);
      this.enemies.forEach(e => e.x -= 1);

      // 3. Move Player
      const prevRow = this.shipRow;
      this.shipRow += queuedMove;
      if (this.shipRow < 0) this.shipRow = 0;
      if (this.shipRow >= CONSTANTS.ROWS) this.shipRow = CONSTANTS.ROWS - 1;

      if (this.shipRow !== prevRow) events.push({ type: 'move' });

      this.distance++;
      this.score += 1;

      // 4. Speed Up
      this.columnsSinceSpeedUp++;
      if (this.columnsSinceSpeedUp >= CONSTANTS.SPEED_RAMP_COLUMNS) {
          this.tileAdvanceMs = Math.max(
              CONSTANTS.TILE_ADVANCE_MIN,
              this.tileAdvanceMs * CONSTANTS.SPEED_RAMP_DECAY
          );
          this.columnsSinceSpeedUp = 0;
      }

      // 5. Check Static Collisions
      const shipTile = this.grid[CONSTANTS.SHIP_COL][this.shipRow];
      let crashType = null;

      if (shipTile.type === 'pickup') {
          this.collectPickup(shipTile, events);
          shipTile.type = 'empty';
          delete shipTile.variant;
      } else if (shipTile.type === 'meteor') {
          crashType = 'meteor';
      }

      if (crashType) {
          if (this.shield > 0) {
              this.shield--;
              shipTile.type = 'empty';
              events.push({ type: 'shield_break' });
          } else {
              this.alive = false;
              return { gameOver: true, crashType, events };
          }
      }

      return { gameOver: false, events };
  }

  collectPickup(tile, events) {
      if (tile.variant === 'boost') {
          this.score += 50;
          events.push({ type: 'pickup' });
      } else if (tile.variant === 'shield') {
          this.shield++;
          events.push({ type: 'pickup' });
      }
  }

  generateColumn() {
      const hazardProb = Math.min(0.08 + this.distance / 2000, 0.4);
      const enemyProb = Math.min(0.02 + this.distance / 3000, 0.2);

      const col = Array(CONSTANTS.ROWS).fill().map(() => ({ type: 'empty' }));

      if (this.random() < hazardProb) {
          const type = this.random();
          const r = Math.floor(this.random() * CONSTANTS.ROWS);

          if (type < 0.7) {
              col[r] = { type: 'meteor' };
          }
      }

      if (this.random() < enemyProb) {
          const r = Math.floor(this.random() * CONSTANTS.ROWS);
          // Spawn just offscreen.
          // Grid width is 12 (0..11). Offscreen is 12.
          // BUT advanceColumn pushes new col at index 11?
          // No, grid length is 12. push adds to end.
          // Screen X for last col is 11.
          // We spawn enemy at 12 to come in smoothly.
          this.enemies.push({
              x: CONSTANTS.COLS + 0.5,
              row: r,
              type: this.random() > 0.5 ? 'chaser' : 'turret',
              hp: 1
          });
      }

      if (this.random() < 0.03) {
           const empties = col.map((t, i) => t.type === 'empty' ? i : -1).filter(i => i !== -1);
           if (empties.length > 0) {
               const idx = empties[Math.floor(this.random() * empties.length)];
               const pType = this.random();
               let variant = 'boost';
               if (pType < 0.3) variant = 'shield';
               col[idx] = { type: 'pickup', variant };
           }
      }

      return col;
  }
