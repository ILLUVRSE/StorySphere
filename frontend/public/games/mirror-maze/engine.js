import { Utils } from './utils.js';

export const TileType = {
  EMPTY: 0,
  MIRROR: 1,
  TARGET: 2,
  EMITTER: 3,
  WALL: 4,
  ABSORBER: 5
};

export const Direction = {
  N: 0,
  E: 1,
  S: 2,
  W: 3
};

// Map direction vector [dx, dy]
export const DirVec = [
  {x: 0, y: -1}, // N
  {x: 1, y: 0},  // E
  {x: 0, y: 1},  // S
  {x: -1, y: 0}  // W
];

export class Engine {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.grid = []; // Array of Tile objects
    this.beams = []; // List of beam segments
    this.targets = [];
    this.emitters = [];
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.rotateCount = 0;
    this.isWin = false;

    // Initialize empty grid
    for(let y=0; y<height; y++) {
      for(let x=0; x<width; x++) {
        this.grid.push({
          x, y,
          type: TileType.EMPTY,
          rotation: 0, // 0..3
          active: false, // for targets
          litTime: 0
        });
      }
    }
  }

  getTile(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.grid[y * this.width + x];
  }

  loadLevel(levelData) {
    // Clear grid
    this.grid.forEach(t => {
      t.type = TileType.EMPTY;
      t.rotation = 0;
      t.active = false;
      t.litTime = 0;
    });
    this.targets = [];
    this.emitters = [];
    this.rotateCount = 0;

    // Place items
    levelData.tiles.forEach(t => {
      const tile = this.getTile(t.x, t.y);
      if(tile) {
        tile.type = t.type;
        tile.rotation = t.rotation || 0;
        if (t.type === TileType.TARGET) this.targets.push(tile);
        if (t.type === TileType.EMITTER) this.emitters.push(tile);
      }
    });

    this.updateBeams();
  }

  rotateMirror(x, y, ccw = false) {
    const tile = this.getTile(x, y);
    if (tile && tile.type === TileType.MIRROR) {
      if (ccw) {
        tile.rotation = (tile.rotation + 3) % 4;
      } else {
        tile.rotation = (tile.rotation + 1) % 4;
      }
      this.rotateCount++;
      this.updateBeams();
      return true;
    }
    return false;
  }

  updateBeams() {
    this.beams = [];
    // Reset target active state
    this.targets.forEach(t => t.active = false);

    const queue = [];
    const visited = new Set(); // (x,y,dir)

    // Initial beams from emitters
    this.emitters.forEach(e => {
      queue.push({
        x: e.x,
        y: e.y,
        dir: e.rotation, // Emitter rotation is firing direction
        start: true
      });
    });

    while(queue.length > 0) {
      const beam = queue.shift();
      const key = `${beam.x},${beam.y},${beam.dir}`;

      // Prevent infinite loops
      if (visited.has(key)) continue;
      visited.add(key);

      // Determine start point (center of tile)
      let currX = beam.x;
      let currY = beam.y;

      // If this is a fresh beam from emitter or split, start tracing
      // If not 'start', we already moved one step
      if (!beam.start) {
         // This logic is handled inside the trace step
      }

      // Trace ray until hit
      let dVec = DirVec[beam.dir];

      // Current beam segment
      let segment = {
        x1: currX, y1: currY,
        x2: currX, y2: currY,
        dir: beam.dir,
        hit: false
      };

      // Raycast loop
      // We step from current tile to next
      // If current tile is emitter, we start from center and go out.

      // Actually simpler: Ray is defined by (x,y) integers of tile it is ENTERING.
      // But we need to handle "leaving" the current tile.

      // Let's model: Beam enters tile (x,y) from direction (inDir).
      // Calculate interaction.
      // If passes through, continues to (x+dx, y+dy).

      // Start with Emitters: They emit into the neighbor tile immediately?
      // Or do they emit from their own center?
      // Visuals: Emitter is at x,y. Beam starts at center.
      // Emitter at (0,0) facing East (1,0). Beam goes through (0,0) half-way?
      // Let's say beam starts at center of Emitter.

      // Trace:
      // 1. Current Tile Interaction.
      // 2. Move to Next Tile.

      let cx = beam.x;
      let cy = beam.y;
      let cDir = beam.dir; // Direction of flow

      // Add segment start
      // We will build segments per tile for rendering? Or long segments?
      // Long segments are better for visuals.

      let tracing = true;
      while(tracing) {
        // Look at current tile content
        // BUT wait, we are at cx, cy.
        // If we just entered this tile, we check its type.

        // However, if we started at Emitter, we are at Emitter tile.
        // Emitter passes beam out in its dir.

        const tile = this.getTile(cx, cy);

        if (!tile) {
          // Out of bounds
           // Make segment end at edge
           segment.x2 = cx;
           segment.y2 = cy;
           // Actually, if out of bounds, we want to draw it leaving the last valid tile
           // But our coordinates are integer grid.
           // Visuals will handle offsets.
           tracing = false;
           break;
        }

        // Interaction logic
        let absorbed = false;
        let reflected = false;
        let nextDirs = [];

        if (tile.type === TileType.MIRROR) {
           // Reflect
           // Mirror geometry:
           // Rot 0: /  (Connects N<->E, S<->W) ? No.
           // Let's define:
           // Rot 0: / (Bottom-Left to Top-Right).
           //   Reflects:
           //     N (0, -1) [Up] -> Hit / -> Right (1, 0) [E] ? NO.
           //     Visual: /
           //     Incoming from Bottom (going N): Hits / -> turns Right (E). YES.
           //     Incoming from Top (going S): Hits / -> turns Left (W). YES.
           //     Incoming from Left (going E): Hits / -> turns Up (N). YES.
           //     Incoming from Right (going W): Hits / -> turns Down (S). YES.

           // Rot 1: \ (Top-Left to Bottom-Right)
           //     Incoming from Bottom (going N): Hits \ -> turns Left (W).
           //     Incoming from Top (going S): Hits \ -> turns Right (E).
           //     Incoming from Left (going E): Hits \ -> turns Down (S).
           //     Incoming from Right (going W): Hits \ -> turns Up (N).

           // Rot 2: Same as 0
           // Rot 3: Same as 1

           const isSlash = (tile.rotation % 2 === 0); // /

           if (isSlash) {
             // /
             if (cDir === Direction.N) cDir = Direction.E;
             else if (cDir === Direction.E) cDir = Direction.N;
             else if (cDir === Direction.S) cDir = Direction.W;
             else if (cDir === Direction.W) cDir = Direction.S;
           } else {
             // \
             if (cDir === Direction.N) cDir = Direction.W;
             else if (cDir === Direction.E) cDir = Direction.S;
             else if (cDir === Direction.S) cDir = Direction.E;
             else if (cDir === Direction.W) cDir = Direction.N;
           }

           // Mirror stops this linear segment and starts a new one (or we just turn).
           // If we turn, we add the point to the segment path?
           // Simpler: Break segments at turns.
           segment.x2 = cx;
           segment.y2 = cy;
           this.beams.push(segment);

           // Start new segment
           segment = {
             x1: cx, y1: cy,
             x2: cx, y2: cy,
             dir: cDir,
             hit: false
           };

           // We processed interaction on this tile.
           // But wait, if we are ON the mirror tile, we effectively "bounce" at the center.
           // So the beam travels FROM center TO next tile.
           reflected = true;

        } else if (tile.type === TileType.WALL || tile.type === TileType.ABSORBER) {
          absorbed = true;
          tracing = false;
        } else if (tile.type === TileType.TARGET) {
           // Pass through target? Usually yes.
           tile.active = true;
           // Continue tracing...
        } else if (tile.type === TileType.EMITTER) {
           // If we hit an emitter from outside (not start), usually blocked or pass?
           // Let's say pass through but do nothing.
           if (!beam.start && (cx !== beam.x || cy !== beam.y)) {
              // passing through another emitter
           }
        }

        if (absorbed) {
           segment.x2 = cx;
           segment.y2 = cy;
           break;
        }

        // Move to next tile
        dVec = DirVec[cDir];
        const nextX = cx + dVec.x;
        const nextY = cy + dVec.y;

        // Update segment
        segment.x2 = nextX; // Tentative end is entry of next tile
        segment.y2 = nextY;

        // Loop checks
        const nextKey = `${nextX},${nextY},${cDir}`;
        if (visited.has(nextKey)) {
           tracing = false; // Loop detected
           break;
        }
        visited.add(nextKey);

        cx = nextX;
        cy = nextY;

        // If we reflected, we already pushed the old segment.
        // We are now extending the new segment.
        // Actually, my segment logic above was: "Break at turns".
        // If I just turn `cDir`, and continue loop, I am extending the *current* segment object?
        // No, `segment.dir` is fixed. So if `cDir` changes, I MUST start a new segment object.
        // My logic above: "Mirror stops this linear segment... Start new segment". Correct.

      }
      this.beams.push(segment);
    }

    this.checkWin();
  }

  checkWin() {
     const allLit = this.targets.length > 0 && this.targets.every(t => t.active);
     if (allLit) {
       this.isWin = true;
     }
  }
}
