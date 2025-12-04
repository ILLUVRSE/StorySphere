import { TileType, Direction, DirVec } from './engine.js';
import { Utils } from './utils.js';

export class LevelGenerator {
  constructor() {
    this.utils = new Utils();
  }

  generate(seed, width, height) {
    this.utils.setSeed(seed);
    const tiles = [];
    const occupied = new Set();

    // Helper to add tile
    const addTile = (x, y, type, rotation = 0) => {
      const key = `${x},${y}`;
      if (occupied.has(key)) return;
      occupied.add(key);
      tiles.push({x, y, type, rotation});
    };

    // 1. Place Emitter (Random Edge)
    // Edges: N(y=0), S(y=h-1), W(x=0), E(x=w-1)
    const edge = this.utils.randInt(0, 3);
    let ex, ey, edir;

    if (edge === 0) { // Top Edge, shoot South
       ex = this.utils.randInt(0, width-1); ey = 0; edir = Direction.S;
    } else if (edge === 1) { // Right Edge, shoot West
       ex = width-1; ey = this.utils.randInt(0, height-1); edir = Direction.W;
    } else if (edge === 2) { // Bottom Edge, shoot North
       ex = this.utils.randInt(0, width-1); ey = height-1; edir = Direction.N;
    } else { // Left Edge, shoot East
       ex = 0; ey = this.utils.randInt(0, height-1); edir = Direction.E;
    }

    addTile(ex, ey, TileType.EMITTER, edir);

    // 2. Build Path (Forward approach)
    // Walk from emitter, turn randomly, end at some point.
    let cx = ex, cy = ey, cDir = edir;
    let length = 0;
    let turns = 0;
    const maxPath = 15;

    // Move once from emitter to get into grid
    cx += DirVec[cDir].x;
    cy += DirVec[cDir].y;

    while(length < maxPath) {
       // Check bounds
       if (cx < 0 || cx >= width || cy < 0 || cy >= height) break;

       const key = `${cx},${cy}`;

       // Chance to place Target and end
       if (length > 4 && turns > 1 && this.utils.random() < 0.2 && !occupied.has(key)) {
          addTile(cx, cy, TileType.TARGET);
          break;
       }

       // Chance to Turn (Place Mirror)
       if (!occupied.has(key) && this.utils.random() < 0.3) {
          // Turn
          const turn = this.utils.random() < 0.5 ? 'left' : 'right';
          let mirrorRot = 0;
          let newDir;

          // Determine mirror rotation needed
          // / (0): N->E, E->N, S->W, W->S
          // \ (1): N->W, W->N, S->E, E->S

          if (cDir === Direction.N) {
             if (turn === 'right') { newDir = Direction.E; mirrorRot = 0; } // /
             else { newDir = Direction.W; mirrorRot = 1; } // \
          } else if (cDir === Direction.E) {
             if (turn === 'right') { newDir = Direction.S; mirrorRot = 1; } // \
             else { newDir = Direction.N; mirrorRot = 0; } // /
          } else if (cDir === Direction.S) {
             if (turn === 'right') { newDir = Direction.W; mirrorRot = 0; } // /
             else { newDir = Direction.E; mirrorRot = 1; } // \
          } else if (cDir === Direction.W) {
             if (turn === 'right') { newDir = Direction.N; mirrorRot = 1; } // \
             else { newDir = Direction.S; mirrorRot = 0; } // /
          }

          addTile(cx, cy, TileType.MIRROR, mirrorRot);
          cDir = newDir;
          turns++;
       } else {
          // Just pass through empty space
          // Do not overwrite existing tiles (like start)
       }

       // Move
       cx += DirVec[cDir].x;
       cy += DirVec[cDir].y;
       length++;
    }

    // If no target placed, place one at last pos
    // Backtrack one step to be safe if out of bounds
    if (tiles.filter(t => t.type === TileType.TARGET).length === 0) {
       let tx = cx - DirVec[cDir].x;
       let ty = cy - DirVec[cDir].y;
       // Clamp to grid
       tx = Math.max(0, Math.min(width-1, tx));
       ty = Math.max(0, Math.min(height-1, ty));

       // If occupied by mirror, move?
       // Simplification: Just find an empty spot
       if (occupied.has(`${tx},${ty}`)) {
          // Linear search for empty
           for(let y=0; y<height; y++) {
             for(let x=0; x<width; x++) {
                if (!occupied.has(`${x},${y}`)) {
                   tx=x; ty=y; break;
                }
             }
           }
       }
       addTile(tx, ty, TileType.TARGET);
    }

    // 3. Add Decoys (Extra mirrors)
    const emptyCount = (width * height) - tiles.length;
    const decoys = Math.floor(emptyCount * 0.15); // 15% fill
    for(let i=0; i<decoys; i++) {
      const rx = this.utils.randInt(0, width-1);
      const ry = this.utils.randInt(0, height-1);
      const key = `${rx},${ry}`;
      if (!occupied.has(key)) {
        addTile(rx, ry, TileType.MIRROR, this.utils.randInt(0, 3));
      }
    }

    // 4. Randomize rotations of the SOLUTION mirrors
    // To make it a puzzle, we must rotate the mirrors we placed on the path
    // so the player has to fix them.
    tiles.forEach(t => {
       if (t.type === TileType.MIRROR) {
          // Randomize rotation
          t.rotation = this.utils.randInt(0, 3);
       }
    });

    return { tiles };
  }
}
