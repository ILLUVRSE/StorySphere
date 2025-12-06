// TILE constant needed for reference if generator updates
export const TILE = {
    GRASS: 0,
    ROAD: 1,
    START: 2,
    BOOST: 3,
    MUD: 4,
    JUMP: 5,
    WALL: 6
};

import { SeededRNG } from './utils.js';

// Fixed layouts (keep existing but verify they work with new 3D logic)
const LAYOUTS = [
    // The Oval
    [
        "66666666666666666666",
        "66111111111111111166",
        "61111111111111111116",
        "61100000000000000116",
        "61100000000000000116",
        "61100000000000000116",
        "61100000000000000116",
        "61100000000000000116",
        "61100000000000000116",
        "61111111111111111116",
        "66111111111111111166",
        "66666666666666666666"
    ],
    // The Figure 8
    [
        "66666666666666666666",
        "66111111000011111166",
        "61100001100110000116",
        "61100000111100000116",
        "61100000011000000116",
        "61100000111100000116",
        "61100001100110000116",
        "61100000000000000116",
        "61100000000000000116",
        "61111111111111111116",
        "66111111111111111166",
        "66666666666666666666"
    ]
];

export const TrackGenerator = {
    generate: (seedString) => {
        const rng = new SeededRNG(seedString);
        const layoutTemplate = rng.pick(LAYOUTS);
        const rows = layoutTemplate.length;
        const cols = layoutTemplate[0].length;

        const grid = [];
        const checkpoints = [];
        let roadTiles = [];

        // 1. Build Grid
        for (let y = 0; y < rows; y++) {
            const row = [];
            for (let x = 0; x < cols; x++) {
                const char = layoutTemplate[y][x];
                let type = parseInt(char);
                row.push(type);
                if (type === TILE.ROAD || type === TILE.START || type === TILE.BOOST || type === TILE.MUD || type === TILE.JUMP) {
                    roadTiles.push({x, y});
                }
            }
            grid.push(row);
        }

        // 2. Find Start
        let startX = 0, startY = 0;
        let foundStart = false;
        // Search bottom area for a straight road
        for (let y = rows - 2; y >= 1; y--) {
            for (let x = 2; x < cols - 2; x++) {
                 // Check for horizontal run of road
                 if (grid[y][x] === TILE.ROAD && grid[y][x+1] === TILE.ROAD && grid[y][x-1] === TILE.ROAD) {
                     startX = x;
                     startY = y;
                     foundStart = true;
                     break;
                 }
            }
            if (foundStart) break;
        }

        if (foundStart) {
            grid[startY][startX] = TILE.START;
            grid[startY-1][startX] = TILE.START; // Make it 2 wide
        } else {
            // Fallback
            startX = Math.floor(cols/2);
            startY = Math.floor(rows/2);
            grid[startY][startX] = TILE.START;
        }

        // 3. Generate Waypoints (Pathfinding)
        // We need an ordered list of points for AI to follow.
        // We'll run a simple walker from Start
        const waypoints = [];
        let curr = { x: startX, y: startY };
        let visited = new Set();

        // Initial direction: Right (since we looked for horizontal run)
        let dir = { x: 1, y: 0 };

        // Add start
        waypoints.push({ x: startX + 0.5, y: startY + 0.5 });
        visited.add(`${startX},${startY}`);

        // Walk the track
        let steps = 0;
        while(steps < 200) {
            steps++;

            // Try current dir, then turns
            const neighbors = [
                { dx: dir.x, dy: dir.y },    // Forward
                { dx: dir.y, dy: -dir.x },   // Right turn
                { dx: -dir.y, dy: dir.x }    // Left turn
            ];

            let moved = false;
            for(let n of neighbors) {
                const nx = curr.x + n.dx;
                const ny = curr.y + n.dy;
                const key = `${nx},${ny}`;

                if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited.has(key)) {
                    // Is it drivable?
                    const t = grid[ny][nx];
                    if (t !== TILE.WALL && t !== TILE.GRASS) {
                        curr = { x: nx, y: ny };
                        visited.add(key);
                        waypoints.push({ x: nx + 0.5, y: ny + 0.5 });
                        dir = { x: n.dx, y: n.dy }; // Update direction
                        moved = true;
                        break;
                    }
                }
            }

            // If stuck, we might be back at start or dead end
            if (!moved) {
                // Check if adjacent to start (loop closed)
                const dx = startX - curr.x;
                const dy = startY - curr.y;
                if (Math.abs(dx) + Math.abs(dy) === 1) {
                    // Loop closed
                }
                break;
            }
        }


        // 4. Decorate (Items & Boosts)
        roadTiles.forEach(pt => {
            const {x, y} = pt;
            if (grid[y][x] === TILE.START) return;

            // Simple logic: if surrounded by road, chance for boost or item box
            const roll = rng.next();
            if (roll < 0.03) grid[y][x] = TILE.BOOST;
            else if (roll > 0.97) grid[y][x] = TILE.JUMP;
        });

        // 5. Checkpoints (Use waypoints indices)
        if (waypoints.length > 0) {
            checkpoints.push(waypoints[Math.floor(waypoints.length * 0.25)]);
            checkpoints.push(waypoints[Math.floor(waypoints.length * 0.5)]);
            checkpoints.push(waypoints[Math.floor(waypoints.length * 0.75)]);
            checkpoints.push(waypoints[0]); // Finish line
        }

        return {
            grid,
            rows,
            cols,
            start: { x: startX + 0.5, y: startY + 0.5, angle: -Math.PI/2 },
            checkpoints,
            waypoints // Export for AI
        };
    }
};
