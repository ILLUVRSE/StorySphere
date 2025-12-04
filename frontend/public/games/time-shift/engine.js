
import { TILE, TileLogic } from './tiles.js';
import { SFX } from './sfx.js';

export class Engine {
  constructor(puzzle, onWin, onFail) {
    this.width = puzzle.w;
    this.height = puzzle.h;

    // Parse Map
    this.initialTiles = [];
    this.startPos = {x: 0, y: 0};

    for (let y = 0; y < this.height; y++) {
      const row = [];
      const line = puzzle.map[y];
      for (let x = 0; x < this.width; x++) {
        const char = line[x];
        let tile = TILE.FLOOR; // Default

        // Find TILE type from char
        // We need the CHAR_MAP from tiles.js, but I didn't export it well for reverse lookup.
        // Let's just do a manual switch or import CHAR_MAP if we can.
        // Actually, I can use the imported TILE object and re-map locally or update tiles.js
        // I'll assume I have the CHAR_MAP logic here roughly.

        if (char === '#') tile = TILE.WALL;
        else if (char === 'S') { tile = TILE.START; this.startPos = {x, y}; }
        else if (char === 'E') tile = TILE.GOAL;
        else if (char === 'X') tile = TILE.PIT;
        else if (char === 'T') tile = TILE.TOGGLE_BLOCK;
        else if (char === '-') tile = TILE.LASER_H;
        else if (char === '|') tile = TILE.LASER_V;
        else if (char === '^') tile = TILE.ONE_WAY_U;
        else if (char === 'v') tile = TILE.ONE_WAY_D;
        else if (char === '<') tile = TILE.ONE_WAY_L;
        else if (char === '>') tile = TILE.ONE_WAY_R;

        row.push(tile);
      }
      this.initialTiles.push(row);
    }

    // State
    this.state = {
      tick: 0,
      player: { ...this.startPos },
      tiles: this.initialTiles, // In case we add destructible tiles later
      status: 'playing' // playing, dead, won
    };

    this.history = []; // Array of states
    this.maxHistory = 10; // K=10 ticks rewind

    this.onWin = onWin;
    this.onFail = onFail;

    this.rewindCharges = 999; // Infinite for now, or per level
  }

  // Create a deep copy of state
  snapshot() {
    return JSON.parse(JSON.stringify(this.state));
  }

  restore(oldState) {
    this.state = JSON.parse(JSON.stringify(oldState));
  }

  update(input) {
    if (this.state.status !== 'playing') return;

    // 1. Handle Rewind
    if (input.isRewinding() && this.history.length > 0) {
      // Pop state
      const prev = this.history.pop();
      // We want to go back ONE tick per update call?
      // Or jump back K ticks?
      // "Rewind playback: visually step backward... MVP: rewind simply restores tile/actor states"
      // Let's restore the popped state.
      this.restore(prev);
      SFX.rewind();
      return; // Skip normal tick logic
    }

    // 2. Save History
    if (this.history.length >= this.maxHistory) {
      this.history.shift(); // Remove oldest
    }
    this.history.push(this.snapshot());

    // 3. Increment Tick
    this.state.tick++;

    // 4. Player Movement
    const move = input.popMove();
    if (move) {
      const nx = this.state.player.x + move.x;
      const ny = this.state.player.y + move.y;

      // Bounds
      if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
        const tile = this.state.tiles[ny][nx];
        const currentTile = this.state.tiles[this.state.player.y][this.state.player.x];

        // Collision Checks
        let blocked = false;

        // Walls / Solid Objects
        if (TileLogic.isSolid(tile, nx, ny, this.state.tick)) blocked = true;

        // One Way Checks
        if (TileLogic.checkOneWay(currentTile, move.x, move.y)) blocked = true;

        if (!blocked) {
          this.state.player.x = nx;
          this.state.player.y = ny;
          SFX.move();
        } else {
          SFX.bump();
        }
      } else {
        SFX.bump();
      }
    }

    // 5. Hazard Check
    if (this.checkHazards()) {
      this.state.status = 'dead';
      SFX.die();
      this.onFail();
    }

    // 6. Win Check
    const tileAtFeet = this.state.tiles[this.state.player.y][this.state.player.x];
    if (tileAtFeet === TILE.GOAL) {
      this.state.status = 'won';
      SFX.win();
      this.onWin();
    }
  }

  checkHazards() {
    const { x, y } = this.state.player;
    const t = this.state.tick;

    // Check all tiles for active hazards that intersect player
    // This assumes hazards are static tiles that BECOME dangerous.
    // If we have moving actors, we'd check them here too.

    for (let hy = 0; hy < this.height; hy++) {
      for (let hx = 0; hx < this.width; hx++) {
        const tile = this.state.tiles[hy][hx];
        if (TileLogic.isHazard(tile, hx, hy, t, x, y)) {
           // We found a hazard hitting the player
           return true;
        }
      }
    }
    return false;
  }
}
