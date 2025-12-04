import { mulberry32, getDailySeed } from './utils.js';

export class GameEngine {
  constructor(bridge, sfx) {
    this.bridge = bridge;
    this.sfx = sfx;
    this.width = 6;
    this.height = 6;
    this.grid = [];
    this.roundMs = 90000; // 90 seconds
    this.timeLeft = this.roundMs;
    this.score = 0;
    this.gameOver = false;
    this.lastTime = 0;
    this.seed = getDailySeed();
    this.rand = mulberry32(this.seed);

    // Combo system
    this.lastHarvestTime = 0;
    this.comboWindowMs = 2000;
    this.comboCount = 0;

    // Powerups
    this.powerups = []; // {type: 'auto_merge', active: false, ...}

    this.maxTierReached = 0;
    this.comboMax = 0;

    this.initGrid();
  }

  initGrid() {
    this.grid = [];
    for (let x = 0; x < this.width; x++) {
      this.grid[x] = [];
      for (let y = 0; y < this.height; y++) {
        this.grid[x][y] = {
          tier: 0, // 0 = empty, 1..6 crops
          id: x + y * this.width,
          animScale: 1,
          locked: false // Animation lock
        };
      }
    }
  }

  start() {
    this.lastTime = performance.now();
    this.bridge.send('arcade-ready', {});
  }

  update(time) {
    if (this.gameOver) return;

    const dt = time - this.lastTime;
    this.lastTime = time;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.endGame();
    }

    // Update animations (simple scale decay)
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const tile = this.grid[x][y];
        if (tile.animScale > 1) {
          tile.animScale -= 0.05 * (dt / 16);
          if (tile.animScale < 1) tile.animScale = 1;
        }
      }
    }
  }

  plant(x, y) {
    if (this.grid[x][y].tier === 0) {
      this.grid[x][y].tier = 1;
      this.grid[x][y].animScale = 1.2;
      this.sfx.playPlant();
      return true;
    }
    return false;
  }

  getConnected(x, y, tier) {
    const connected = [];
    const queue = [{x, y}];
    const visited = new Set();
    const key = (cx, cy) => `${cx},${cy}`;

    visited.add(key(x, y));
    connected.push({x, y});

    let head = 0;
    while(head < queue.length){
        const curr = queue[head++];
        const neighbors = [
            {x: curr.x + 1, y: curr.y},
            {x: curr.x - 1, y: curr.y},
            {x: curr.x, y: curr.y + 1},
            {x: curr.x, y: curr.y - 1}
        ];

        for(let n of neighbors){
            if(n.x >= 0 && n.x < this.width && n.y >= 0 && n.y < this.height){
                const nKey = key(n.x, n.y);
                if(!visited.has(nKey) && this.grid[n.x][n.y].tier === tier){
                    visited.add(nKey);
                    connected.push(n);
                    queue.push(n);
                }
            }
        }
    }
    return connected;
  }

  tryMerge(x, y) {
    const tile = this.grid[x][y];
    if (tile.tier === 0 || tile.tier >= 6) return false;

    const connected = this.getConnected(x, y, tile.tier);

    if (connected.length >= 2) {
      // Merge!
      const oldTier = tile.tier;
      const newTier = oldTier + 1;

      // Clear neighbors
      for (let c of connected) {
        if (c.x === x && c.y === y) continue;
        this.grid[c.x][c.y].tier = 0;
        this.grid[c.x][c.y].animScale = 0.5; // shrink effect
      }

      // Upgrade target
      tile.tier = newTier;
      tile.animScale = 1.5;

      if (newTier > this.maxTierReached) this.maxTierReached = newTier;

      this.sfx.playMerge(newTier);

      // Check cascades logic could go here, but for MVP, manual merge is safer.
      // However, prompt mentions: "Cascading merges cascade like 2048 but must be adjacency-driven".
      // And "check again for adjacent merges at new tier and process BFS-style cascades".
      // For a satisfying arcade feel, automatic cascade is great.

      setTimeout(() => this.checkCascade(x, y), 250);

      return true;
    }
    return false;
  }

  checkCascade(x, y) {
      // If the newly merged tile can merge again immediately, do it?
      // Or maybe just let the player do it to feel control?
      // The prompt says "cascading merges". Let's try one level of recursion.
      // Actually, auto-cascading might consume tiles the player didn't want to consume yet.
      // Prompt: "process BFS to avoid ambiguity".
      // Let's implement auto-cascade.

      const tile = this.grid[x][y];
      if(tile.tier === 0 || tile.tier >= 6) return;

      const connected = this.getConnected(x, y, tile.tier);
      if(connected.length >= 2) {
          this.tryMerge(x, y);
      }
  }

  harvest(x, y) {
    const tile = this.grid[x][y];
    if (tile.tier === 0) return false;

    const now = performance.now();

    // Check combo window
    if (now - this.lastHarvestTime < this.comboWindowMs) {
      this.comboCount++;
    } else {
      this.comboCount = 0;
    }
    this.lastHarvestTime = now;
    if (this.comboCount > this.comboMax) this.comboMax = this.comboCount;

    // Calculate score
    // Value = base * 2^(tier-1)
    // Chain bonus logic: if we harvest connected tiles (wait, harvest usually clears 1 or all?)
    // Prompt: "harvest (tap harvest button or double-tap crop): collects crop value and clears tile(s). Harvesting a high-tier chain at the right moment gives multiplicative combo bonuses."
    // And "If the harvest cleared tiles from a chain merge of length N" -- wait, usually harvest clears the single resulting tile.
    // The prompt implies you might harvest a *cluster* without merging?
    // "Merge ... creates the next-tier crop on one tile and clears the others."
    // "Harvest ... collects crop value and clears tile(s)."
    // Let's assume harvest clears ALL connected tiles of the same tier?
    // OR just the single clicked tile?
    // "Harvesting a high-tier chain..." suggests maybe we can harvest a group.
    // Let's go with: Harvest clears the connected group of same-tier tiles.

    const connected = this.getConnected(x, y, tile.tier);
    const count = connected.length;

    const baseValue = 10;
    const tierVal = baseValue * Math.pow(2, tile.tier - 1);

    // Score formula from prompt: baseScore * (1 + 0.25*(N-1)) * harvestMultiplier
    // Here N is count.

    const comboMultiplier = 1 + (this.comboCount * 0.5); // 0.5 per combo step for excitement
    const chainBonus = 1 + (count - 1) * 0.25;

    const totalScore = Math.floor(tierVal * chainBonus * comboMultiplier * count); // * count because we clear N tiles? Or is baseScore for the whole group? Usually per tile.
    // Let's say score is sum of values * chainBonus * comboMultiplier.

    this.score += totalScore;

    // Clear tiles
    for(let c of connected) {
        this.grid[c.x][c.y].tier = 0;
        this.grid[c.x][c.y].animScale = 0.2;
    }

    this.sfx.playHarvest(count, tile.tier);
    if (this.comboCount > 0) this.sfx.playCombo();

    return true;
  }

  handleInput(x, y, isDoubleTap) {
      if (this.gameOver) return;
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

      const tile = this.grid[x][y];

      if (tile.tier === 0) {
          this.plant(x, y);
      } else {
          // If double tap, harvest
          if (isDoubleTap) {
              this.harvest(x, y);
          } else {
              // Try merge first
              const merged = this.tryMerge(x, y);
              if (!merged) {
                  // If can't merge (no neighbors), visual feedback or nothing?
                  // Maybe wiggle?
                  tile.animScale = 0.9;
              }
          }
      }
  }

  endGame() {
    this.gameOver = true;
    this.bridge.send('arcade-score', {
      score: this.score,
      maxTier: this.maxTierReached,
      comboMax: this.comboMax,
      seed: this.seed
    });
  }
}
