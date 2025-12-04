import { ELEMENTS, SHAPES } from './craft.js';
import { mulberry32 } from './utils.js';

export class MatchEngine {
    constructor(seed, onMatch) {
        this.cols = 8;
        this.rows = 8;
        this.grid = []; // 2D array [row][col]
        this.seed = seed;
        this.rng = mulberry32(this.seed ? this.hash(this.seed) : Date.now());
        this.onMatch = onMatch; // Callback when a match is processed

        this.selectedTile = null;
        this.isProcessing = false;

        this.initGrid();
    }

    hash(str) {
        let h = 0xdeadbeef;
        for(let i=0; i<str.length; i++)
            h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
        return (h ^ h >>> 16) >>> 0;
    }

    initGrid() {
        // Simple fill, don't worry about initial matches for MVP
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.grid[r][c] = this.randomTile(r, c);
            }
        }
        // Resolve initial matches silently without crafting?
        // For MVP, let's just let them stay or clear them.
        // Better: iterate once to remove matches so player starts clean.
        this.resolveMatches(true);
    }

    randomTile(row, col) {
        const types = Object.values(ELEMENTS);
        const type = types[Math.floor(this.rng() * types.length)];
        return {
            row,
            col,
            type,
            id: Math.floor(this.rng() * 1000000),
            offsetY: 0, // For animation
            alpha: 1
        };
    }

    isValid(r, c) {
        return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
    }

    selectTile(r, c) {
        if (this.isProcessing) return;
        if (!this.isValid(r, c)) return;

        if (!this.selectedTile) {
            this.selectedTile = {r, c};
        } else {
            // Check adjacency
            const dr = Math.abs(this.selectedTile.r - r);
            const dc = Math.abs(this.selectedTile.c - c);

            if (dr + dc === 1) {
                this.swap(this.selectedTile.r, this.selectedTile.c, r, c);
                this.selectedTile = null;
            } else {
                // Reselect
                this.selectedTile = {r, c};
            }
        }
    }

    async swap(r1, c1, r2, c2) {
        this.isProcessing = true;

        // Swap logic
        const t1 = this.grid[r1][c1];
        const t2 = this.grid[r2][c2];

        this.grid[r1][c1] = t2;
        this.grid[r2][c2] = t1;

        t1.row = r2; t1.col = c2;
        t2.row = r1; t2.col = c1;

        // Visual delay (mock)
        await new Promise(res => setTimeout(res, 200));

        const matches = this.findMatches();
        if (matches.length > 0) {
            await this.processMatches(matches);
        } else {
            // Swap back
            this.grid[r1][c1] = t1;
            this.grid[r2][c2] = t2;
            t1.row = r1; t1.col = c1;
            t2.row = r2; t2.col = c2;
            await new Promise(res => setTimeout(res, 200));
        }

        this.isProcessing = false;
    }

    findMatches() {
        const matches = [];
        const visited = new Set(); // Keep track of tiles already in a match group

        // 1. Find all horizontal and vertical runs
        // We'll use a Union-Find or Flood Fill approach to group connected matches.
        // Simplified approach: scan grid, if 3 in a row/col, add to a Set.

        const matchedTiles = new Set();

        // Horizontal
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols - 2; c++) {
                const type = this.grid[r][c].type;
                if (this.grid[r][c+1].type === type && this.grid[r][c+2].type === type) {
                    matchedTiles.add(this.grid[r][c]);
                    matchedTiles.add(this.grid[r][c+1]);
                    matchedTiles.add(this.grid[r][c+2]);
                    // Continue checking
                    let k = c + 3;
                    while (k < this.cols && this.grid[r][k].type === type) {
                        matchedTiles.add(this.grid[r][k]);
                        k++;
                    }
                }
            }
        }

        // Vertical
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows - 2; r++) {
                const type = this.grid[r][c].type;
                if (this.grid[r+1][c].type === type && this.grid[r+2][c].type === type) {
                    matchedTiles.add(this.grid[r][c]);
                    matchedTiles.add(this.grid[r+1][c]);
                    matchedTiles.add(this.grid[r+2][c]);
                    let k = r + 3;
                    while (k < this.rows && this.grid[k][c].type === type) {
                        matchedTiles.add(this.grid[k][c]);
                        k++;
                    }
                }
            }
        }

        if (matchedTiles.size === 0) return [];

        // 2. Group connected matched tiles into discrete match events
        const groups = [];
        const pool = Array.from(matchedTiles);
        const processed = new Set();

        for (const tile of pool) {
            if (processed.has(tile)) continue;

            // Flood fill to find component
            const group = [];
            const queue = [tile];
            processed.add(tile);

            while(queue.length > 0) {
                const t = queue.pop();
                group.push(t);

                // Check neighbors in pool
                const neighbors = [
                    {r: t.row-1, c: t.col},
                    {r: t.row+1, c: t.col},
                    {r: t.row, c: t.col-1},
                    {r: t.row, c: t.col+1}
                ];

                for (const n of neighbors) {
                    if (this.isValid(n.r, n.c)) {
                        const nt = this.grid[n.r][n.c];
                        if (matchedTiles.has(nt) && !processed.has(nt) && nt.type === t.type) {
                            processed.add(nt);
                            queue.push(nt);
                        }
                    }
                }
            }
            groups.push(group);
        }

        // 3. Analyze shapes for each group
        return groups.map(group => this.analyzeShape(group));
    }

    analyzeShape(tiles) {
        if (tiles.length === 0) return null;
        const type = tiles[0].type;
        const count = tiles.length;

        // Bounding Box
        const rs = tiles.map(t => t.row);
        const cs = tiles.map(t => t.col);
        const minR = Math.min(...rs), maxR = Math.max(...rs);
        const minC = Math.min(...cs), maxC = Math.max(...cs);
        const width = maxC - minC + 1;
        const height = maxR - minR + 1;

        let shape = SHAPES.LINE;

        // Pure Line Check
        if (width === count || height === count) {
            shape = SHAPES.LINE;
        } else {
            // Check for Cross (neighbors in 4 directions)
            // Find a tile with 4 neighbors of same type
            // Note: In a match group, all tiles are same type.
            let has4Neighbors = false;
            let has3Neighbors = false; // T

            for (const t of tiles) {
                let n = 0;
                if (tiles.find(x => x.row === t.row-1 && x.col === t.col)) n++;
                if (tiles.find(x => x.row === t.row+1 && x.col === t.col)) n++;
                if (tiles.find(x => x.row === t.row && x.col === t.col-1)) n++;
                if (tiles.find(x => x.row === t.row && x.col === t.col+1)) n++;

                if (n === 4) has4Neighbors = true;
                if (n === 3) has3Neighbors = true;
            }

            if (has4Neighbors) shape = SHAPES.CROSS;
            else if (has3Neighbors) shape = SHAPES.T;
            else shape = SHAPES.L; // Default for non-line, non-cross/T
        }

        return { element: type, shape, count, tiles };
    }

    async processMatches(matches, silent=false) {
        // Report matches
        if (!silent && this.onMatch) {
            matches.forEach(m => this.onMatch(m));
        }

        // Remove tiles
        for (const m of matches) {
            for (const t of m.tiles) {
                this.grid[t.row][t.col] = null;
            }
        }

        // Gravity
        await new Promise(res => setTimeout(res, 200)); // Disappear anim

        for (let c = 0; c < this.cols; c++) {
            let writeRow = this.rows - 1;
            for (let r = this.rows - 1; r >= 0; r--) {
                if (this.grid[r][c] !== null) {
                    if (r !== writeRow) {
                        this.grid[writeRow][c] = this.grid[r][c];
                        this.grid[writeRow][c].row = writeRow;
                        this.grid[r][c] = null;
                    }
                    writeRow--;
                }
            }
            // Refill
            for (let r = writeRow; r >= 0; r--) {
                this.grid[r][c] = this.randomTile(r, c);
                // Start above screen? For MVP just appear
            }
        }

        // Check for cascades
        if (!silent) {
            await new Promise(res => setTimeout(res, 300)); // Fall anim
            const cascades = this.findMatches();
            if (cascades.length > 0) {
                // Cascades don't craft in this spec?
                // "Cascades allowed and counted, but craft only on the first resolution of a match (or allow combos...)"
                // Let's allow combos for fun.
                await this.processMatches(cascades, false);
            }
        } else {
             const cascades = this.findMatches();
             if (cascades.length > 0) {
                 await this.processMatches(cascades, true);
             }
        }
    }

    resolveMatches(silent=false) {
        const matches = this.findMatches();
        if (matches.length > 0) {
            this.processMatches(matches, silent);
        }
    }
}
