// engine.js
import { uuid, clamp } from './utils.js';

export class Engine {
  constructor(width, height, rng, waveManager, bridge, sfx) {
    this.width = width;
    this.height = height;
    this.rng = rng;
    this.waveManager = waveManager;
    this.bridge = bridge;
    this.sfx = sfx;

    this.grid = [];
    this.customers = [];
    this.floatingTexts = [];

    this.money = 200;
    this.totalRevenue = 0;
    this.startTime = 0;
    this.timeLeft = 180000; // 3 mins
    this.lastTick = 0;

    this.waveIndex = 0;
    this.waveStartTime = 0;
    this.lastSpawnTime = 0;

    this.hoverX = -1;
    this.hoverY = -1;

    this.buildingTypes = {
      house: { id: 'house', name: 'House', cost: 50, color: '#03a9f4', description: 'Spawns customers' },
      shop: { id: 'shop', name: 'Shop', cost: 100, color: '#ff9800', capacity: 2, serviceTime: 3000, revenue: 20, description: 'Serves customers' },
      park: { id: 'park', name: 'Park', cost: 75, color: '#444444', description: 'Boosts adjacent shops (+25% rev)' },
      road: { id: 'road', name: 'Road', cost: 10, color: '#607d8b', description: 'Walk faster (Not Impl in MVP)' }
    };

    this.selectedBuildingType = 'shop'; // Default selection
    this.gameOver = false;
  }

  init() {
    // Init grid
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) {
        row.push({ x, y, building: null, terrain: 'ground' });
      }
      this.grid.push(row);
    }

    this.startTime = Date.now();
    this.waveStartTime = this.startTime;
    this.lastTick = this.startTime;
  }

  update(now) {
    if (this.gameOver) return;

    const dt = now - this.lastTick;
    this.lastTick = now;

    // Timer
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.endGame();
      return;
    }

    // Waves
    this.updateWaves(now);

    // Customers
    this.updateCustomers(now, dt);

    // Buildings (Service logic)
    this.updateBuildings(now, dt);
  }

  updateWaves(now) {
    const currentWave = this.waveManager.getWave(this.waveIndex);

    // Check wave progression
    if (now - this.waveStartTime > currentWave.duration) {
      this.waveIndex++;
      this.waveStartTime = now;
      this.sfx.playWaveAlert();
      this.addFloatingText(this.width/2, this.height/2, "WAVE " + (this.waveIndex + 1));
    }

    // Spawning
    if (this.customers.length < currentWave.maxActive &&
        now - this.lastSpawnTime > currentWave.spawnRate) {
      this.spawnCustomer(currentWave);
      this.lastSpawnTime = now;
    }
  }

  spawnCustomer(wave) {
    // Find spawn point (Residence or Edge)
    let spawnTile = null;

    // Try to find a house first
    const houses = [];
    for(let y=0; y<this.height; y++) {
        for(let x=0; x<this.width; x++) {
            if (this.grid[y][x].building?.type === 'house') {
                houses.push({x, y});
            }
        }
    }

    if (houses.length > 0 && this.rng() < 0.7) {
        spawnTile = houses[Math.floor(this.rng() * houses.length)];
    } else {
        // Edge spawn
        if (this.rng() < 0.5) { // Vertical edges
            spawnTile = { x: 0, y: Math.floor(this.rng() * this.height) };
        } else { // Horizontal edges
            spawnTile = { x: Math.floor(this.rng() * this.width), y: 0 };
        }
    }

    const isVip = this.rng() < wave.vipChance;

    this.customers.push({
      id: uuid(),
      x: spawnTile.x,
      y: spawnTile.y,
      target: null, // target shop
      path: [],
      state: 'idle', // idle, moving, queuing, served
      vip: isVip,
      color: isVip ? '#ffd700' : '#e91e63',
      spawnTime: Date.now(),
      moveProgress: 0
    });
  }

  updateCustomers(now, dt) {
    this.customers = this.customers.filter(c => c.state !== 'done');

    this.customers.forEach(c => {
      if (c.state === 'idle') {
        // Find nearest shop with available queue space?
        // For MVP: Find ANY nearest shop.
        const shop = this.findNearestShop(c.x, c.y);
        if (shop) {
          c.target = shop; // shop is {x, y, building}
          c.path = this.findPath(c.x, c.y, shop.x, shop.y);
          if (c.path && c.path.length > 0) {
             c.state = 'moving';
             c.moveProgress = 0;
          }
        } else {
             // Wander or disappear if too old
             if (now - c.spawnTime > 10000) c.state = 'done';
        }
      } else if (c.state === 'moving') {
        // Move along path
        // Simple tick movement: 1 tile per 500ms?
        // Let's do continuous for smoothness
        const speed = 0.005; // tiles per ms
        c.moveProgress += speed * dt;

        if (c.moveProgress >= 1) {
            const nextStep = c.path.shift();
            if (nextStep) {
                c.x = nextStep.x;
                c.y = nextStep.y;
                c.moveProgress = 0;
            }

            if (c.path.length === 0) {
                // Arrived
                // Check if shop still exists
                const tile = this.grid[c.y][c.x];
                if (tile.building && tile.building.type === 'shop') {
                    if (tile.building.queue.length < tile.building.capacity + 2) { // Allow small overflow
                        tile.building.queue.push(c);
                        c.state = 'queuing';
                    } else {
                        // Shop full/gone, go back to idle to find another or leave
                        c.state = 'idle';
                    }
                } else {
                    c.state = 'idle';
                }
            }
        }
      }
      // 'queuing' state is handled by the shop building
    });
  }

  updateBuildings(now, dt) {
     for(let y=0; y<this.height; y++) {
        for(let x=0; x<this.width; x++) {
            const b = this.grid[y][x].building;
            if (b && b.type === 'shop') {
                // Process queue
                if (b.queue.length > 0) {
                    // Start service if not serving
                    // We can serve 'capacity' customers at once
                    // For MVP simplicity: FIFO single serving or array of serving slots.
                    // Let's do slots.

                    // Move from queue to service
                    while (b.activeService.length < b.capacity && b.queue.length > 0) {
                        const cust = b.queue.shift();
                        b.activeService.push({
                            customer: cust,
                            startTime: now
                        });
                        cust.state = 'serving';
                    }
                }

                // Check service completion
                for (let i = b.activeService.length - 1; i >= 0; i--) {
                    const service = b.activeService[i];

                    // Adjacency Bonus: Park reduces service time or increases revenue?
                    // Prompt says: +X% revenue or -Y% serviceTime.
                    // Let's do Park = +Revenue for MVP.

                    if (now - service.startTime >= b.serviceTime) {
                        // Done!
                        this.completeService(b, service.customer, x, y);
                        b.activeService.splice(i, 1);
                    }
                }
            }
        }
     }
  }

  completeService(shop, customer, tx, ty) {
    let revenue = shop.revenue;
    if (customer.vip) revenue *= 2;

    // Adjacency bonuses
    const neighbors = this.getNeighbors(tx, ty);
    let bonusMul = 1.0;
    neighbors.forEach(n => {
        if (n.building && n.building.type === 'park') {
            bonusMul += 0.25; // +25% per park
        }
    });

    const finalAmt = Math.floor(revenue * bonusMul);
    this.money += finalAmt;
    this.totalRevenue += finalAmt;

    customer.state = 'done';
    this.sfx.playRevenue();
    this.addFloatingText(tx, ty, `+$${finalAmt}`);
  }

  // --- Grid Helpers ---

  canBuild(x, y, typeId) {
    const tile = this.grid[y][x];
    if (tile.building) return false;
    const type = this.buildingTypes[typeId];
    if (this.money < type.cost) return false;
    return true;
  }

  build(x, y, typeId) {
    if (!this.canBuild(x, y, typeId)) {
        this.sfx.playError();
        return;
    }

    const type = this.buildingTypes[typeId];
    this.money -= type.cost;

    const building = {
        type: typeId,
        ...type,
        queue: [],       // For shops
        activeService: [] // For shops
    };

    this.grid[y][x].building = building;
    this.sfx.playBuild();

    // Recalc paths?
    // Usually invalidates existing paths, but for MVP customers re-pathing on idle is enough?
    // If we blocked a path, customers in 'moving' might get stuck.
    // Ideally we re-path everyone or let them fail and retry.
  }

  sell(x, y) {
    const tile = this.grid[y][x];
    if (tile.building) {
        const refund = Math.floor(tile.building.cost * 0.5);
        this.money += refund;
        tile.building = null;
        this.sfx.playBuild(); // reuse sound
        this.addFloatingText(x, y, `+$${refund}`);
    }
  }

  handleInput(x, y, action) {
    if (this.gameOver) return;
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

    if (action === 'place') {
        this.build(x, y, this.selectedBuildingType);
    } else if (action === 'sell') {
        this.sell(x, y);
    }
  }

  setHover(x, y) {
    this.hoverX = x;
    this.hoverY = y;
  }

  // --- Pathfinding (BFS) ---
  findNearestShop(sx, sy) {
    // Optimization: Just scan all shops and pick closest crow-flies
    // Since grid is small (10x10), this is instant.
    let best = null;
    let minDist = Infinity;

    for(let y=0; y<this.height; y++) {
        for(let x=0; x<this.width; x++) {
            if (this.grid[y][x].building?.type === 'shop') {
                const d = Math.abs(sx - x) + Math.abs(sy - y);
                if (d < minDist) {
                    minDist = d;
                    best = { x, y, building: this.grid[y][x].building };
                }
            }
        }
    }
    return best;
  }

  findPath(sx, sy, tx, ty) {
    // BFS
    const q = [{ x: sx, y: sy, path: [] }];
    const visited = new Set();
    visited.add(`${sx},${sy}`);

    while (q.length > 0) {
        const curr = q.shift();
        if (curr.x === tx && curr.y === ty) {
            return curr.path;
        }

        const neighbors = this.getNeighbors(curr.x, curr.y);
        for (const n of neighbors) {
            // Can pass if no building OR building is target
            // Actually houses/parks might block?
            // Let's assume all tiles are walkable for MVP except maybe other buildings?
            // "Road" type suggests walking.
            // Simplified: Walkable if no building, OR building is road, OR it is the target shop.
            // If it's the start, it's walkable.

            const isTarget = (n.x === tx && n.y === ty);
            const isEmpty = !n.building;
            const isRoad = n.building?.type === 'road';

            // Allow walking through houses? Maybe not.
            // Let's say: Walkable if empty or road. Target is exception.
            if ((isEmpty || isRoad || isTarget) && !visited.has(`${n.x},${n.y}`)) {
                visited.add(`${n.x},${n.y}`);
                q.push({
                    x: n.x,
                    y: n.y,
                    path: [...curr.path, { x: n.x, y: n.y }]
                });
            }
        }
    }
    return null; // No path
  }

  getNeighbors(x, y) {
    const res = [];
    const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
    for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
            res.push(this.grid[ny][nx]);
        }
    }
    return res;
  }

  addFloatingText(x, y, text) {
      this.floatingTexts.push({
          x, y, text,
          start: Date.now(),
          duration: 1000
      });
  }

  endGame() {
    this.gameOver = true;
    this.bridge.sendScore(this.totalRevenue, { wave: this.waveIndex });
  }
}
