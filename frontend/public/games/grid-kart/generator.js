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

        // Find Start
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

        // Decorate
        roadTiles.forEach(pt => {
            const {x, y} = pt;
            if (grid[y][x] === TILE.START) return;

            // Simple logic: if surrounded by road, chance for boost
            const roll = rng.next();
            if (roll < 0.03) grid[y][x] = TILE.BOOST;
            else if (roll > 0.97) grid[y][x] = TILE.JUMP;
        });

        // Checkpoints (Simple corners)
        // Top Left, Top Right, Bottom Right, Bottom Left relative to center
        // Or just spaced out road tiles
        const step = Math.floor(roadTiles.length / 4);
        for(let i=1; i<=4; i++) {
            const t = roadTiles[(i*step) % roadTiles.length];
            if(t) checkpoints.push(t);
        }

        return {
            grid,
            rows,
            cols,
            start: { x: startX + 0.5, y: startY + 0.5, angle: -Math.PI/2 }, // Facing Up (North/ -Z in 3D, -Y in 2D map)
            checkpoints
        };
    }
};
