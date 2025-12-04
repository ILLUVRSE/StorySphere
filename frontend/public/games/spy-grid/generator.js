import { Mulberry32, uuid } from './utils.js';
import { TILE, DIR } from './engine.js';

export function generateLevel(seedStr) {
    // Hash string to number
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) {
        seed = ((seed << 5) - seed) + seedStr.charCodeAt(i);
        seed |= 0;
    }
    const rng = new Mulberry32(seed);

    const w = 8;
    const h = 8;
    const map = [];

    // Fill with walls
    for(let y=0; y<h; y++) {
        const row = [];
        for(let x=0; x<w; x++) {
            if (x===0 || x===w-1 || y===0 || y===h-1) row.push(TILE.WALL);
            else row.push(TILE.FLOOR);
        }
        map.push(row);
    }

    // Add Random Obstacles
    const obstacleCount = rng.range(5, 12);
    for(let i=0; i<obstacleCount; i++) {
        const x = rng.range(1, w-1);
        const y = rng.range(1, h-1);
        if (map[y][x] === TILE.FLOOR) {
             map[y][x] = rng.next() > 0.3 ? TILE.WALL : TILE.COVER;
        }
    }

    // Ensure Start and End
    // Player Start: Top Left-ish
    let px = 1, py = 1;
    map[py][px] = TILE.FLOOR; // Clear start

    // Exit: Bottom Right-ish
    let ex = w-2, ey = h-2;
    map[ey][ex] = TILE.EXIT; // Clear exit

    // Add Guards
    const guardCount = rng.range(1, 4);
    const guards = [];

    for(let i=0; i<guardCount; i++) {
        // Find valid spot
        let gx, gy;
        let attempts = 0;
        do {
            gx = rng.range(1, w-1);
            gy = rng.range(1, h-1);
            attempts++;
        } while ((map[gy][gx] !== TILE.FLOOR || (Math.abs(gx-px) + Math.abs(gy-py) < 3)) && attempts < 100);

        if (attempts < 100) {
            const p2x = rng.range(1, w-1);
            const p2y = rng.range(1, h-1);

            guards.push({
                x: gx, y: gy,
                dir: DIR.S, // Initial
                alertState: 'patrol',
                patrol: [{x: gx, y: gy}, {x: p2x, y: p2y}],
                patrolIndex: 0
            });
        }
    }

    // Items
    const items = [];
    const itemCount = rng.range(1, 4);
    for(let i=0; i<itemCount; i++) {
        let ix, iy;
         do {
            ix = rng.range(1, w-1);
            iy = rng.range(1, h-1);
        } while (map[iy][ix] !== TILE.FLOOR);
        items.push({x: ix, y: iy});
    }

    // Convert map to strings for engine
    const mapStrs = map.map(row => {
        return row.map(cell => {
            if (cell === TILE.WALL) return '#';
            if (cell === TILE.COVER) return '+';
            if (cell === TILE.EXIT) return 'X';
            return '.';
        }).join('');
    });

    // Inject player pos char
    const pRow = mapStrs[py].split('');
    pRow[px] = '@';
    mapStrs[py] = pRow.join('');

    return {
        width: w,
        height: h,
        map: mapStrs,
        guards: guards,
        items: items,
        props: [],
        hint: "Daily Heist: " + seedStr
    };
}
