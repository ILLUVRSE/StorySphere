
// Tile Types
export const TILE = {
  FLOOR: 0,
  WALL: 1,
  START: 2,
  GOAL: 3,
  PIT: 4, // Falls unless bridge
  LASER_H: 5, // Horizontal Laser Emitter (static or toggling)
  LASER_V: 6, // Vertical Laser Emitter
  TOGGLE_BLOCK: 7, // On/Off block
  ONE_WAY_U: 8,
  ONE_WAY_D: 9,
  ONE_WAY_L: 10,
  ONE_WAY_R: 11,
};

// Map characters to tiles for easy level design
export const CHAR_MAP = {
  '.': TILE.FLOOR,
  '#': TILE.WALL,
  'S': TILE.START,
  'E': TILE.GOAL,
  'X': TILE.PIT,
  '-': TILE.LASER_H, // Firing Horizontal
  '|': TILE.LASER_V, // Firing Vertical
  'T': TILE.TOGGLE_BLOCK, // Toggles solid/empty
  '^': TILE.ONE_WAY_U,
  'v': TILE.ONE_WAY_D,
  '<': TILE.ONE_WAY_L,
  '>': TILE.ONE_WAY_R,
};

// Deterministic Logic for tiles that change state
export const TileLogic = {
  // Returns true if tile at (x,y) blocks movement at tick t
  isSolid: (tileType, x, y, tick) => {
    if (tileType === TILE.WALL) return true;

    if (tileType === TILE.TOGGLE_BLOCK) {
      // Toggle every 3 ticks? Or based on (x+y+tick)%2?
      // Let's say it toggles every 4 ticks (0-3 solid, 4-7 open)
      // Or simple pattern: Solid on even ticks, Open on odd? Too fast.
      // Solid if floor(tick / 4) is even.
      return Math.floor(tick / 4) % 2 === 0;
    }

    return false;
  },

  // Returns true if tile is a hazard at tick t (kills player)
  isHazard: (tileType, x, y, tick, px, py) => {
    // Lasers fire in bursts.
    // E.g. Fire for 3 ticks, rest for 3 ticks.
    const cycle = 6;
    const offset = (x + y) % 3; // minimal offset
    const active = ((tick + offset) % cycle) < 3;

    if (!active) return false;

    if (tileType === TILE.LASER_H) {
       // Checks if player is in the same row
       if (py === y) return true;
    }
    if (tileType === TILE.LASER_V) {
       // Checks if player is in the same col
       if (px === x) return true;
    }

    return false;
  },

  // Check One-Way restrictions (returns true if entering FROM dx, dy is blocked)
  checkOneWay: (tileType, dx, dy) => {
    // dx, dy are direction of movement (e.g., dx=1 means moving RIGHT)
    if (tileType === TILE.ONE_WAY_U && dy > 0) return true; // Block moving Down
    if (tileType === TILE.ONE_WAY_D && dy < 0) return true; // Block moving Up
    if (tileType === TILE.ONE_WAY_L && dx > 0) return true; // Block moving Right
    if (tileType === TILE.ONE_WAY_R && dx < 0) return true; // Block moving Left
    return false;
  }
};
