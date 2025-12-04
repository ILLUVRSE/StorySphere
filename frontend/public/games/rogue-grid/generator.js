import { CONSTANTS, mulberry32, cyrb128 } from './utils.js';
import { ROOM_TEMPLATES } from './templates.js';

export class DungeonGenerator {
    constructor(seedStr) {
        const seed = cyrb128(seedStr);
        this.random = mulberry32(seed);
        this.rooms = [];
        this.tiles = []; // Flattened or global coordinate grid?
                         // For MVP Rogue Grid: "compact rooms... 4-10 rooms".
                         // Strategy: Just linear sequence of rooms. Switch rooms entirely on exit?
                         // Prompt says: "Enter a procedurally generated room sequence... reach the exit to advance".
                         // This implies we generate ONE room at a time, or a small graph.
                         // "small dungeon graph (linear or branching)..."
                         // Let's generate the whole "Floor" (Level) as a graph of Room objects, but we only render the CURRENT room.
    }

    generateLevel(depth) {
        // Generate 4-8 rooms
        const roomCount = 4 + Math.floor(this.random() * 4);
        const rooms = [];

        // Simple Linear Chain for MVP: Start -> R1 -> R2 -> ... -> Exit
        // We link them by "Doors".

        for (let i = 0; i < roomCount; i++) {
            const isStart = (i === 0);
            const isEnd = (i === roomCount - 1);

            const templateKeys = Object.keys(ROOM_TEMPLATES);
            const tKey = templateKeys[Math.floor(this.random() * templateKeys.length)];
            const template = ROOM_TEMPLATES[tKey];

            const room = {
                id: i,
                width: CONSTANTS.COLS,
                height: CONSTANTS.ROWS,
                tiles: this.parseTemplate(template),
                exits: [],
                enemies: [], // filled later
                items: []    // filled later
            };

            // Add Exits/Entrances
            // If not start, add entrance from previous (e.g., West)
            // If not end, add exit to next (e.g., East)
            // For variety, we could swap sides, but Linear West->East is easiest for MVP.

            if (!isStart) {
                // Entrance on Left (Row 3, Col 0)
                room.tiles[3][0] = { type: 'door_prev', targetRoomId: i - 1 };
                // Ensure clear path next to door
                room.tiles[3][1] = { type: 'floor' };
            }

            if (!isEnd) {
                // Exit on Right (Row 3, Col 8)
                room.tiles[3][CONSTANTS.COLS - 1] = { type: 'door_next', targetRoomId: i + 1 };
                room.tiles[3][CONSTANTS.COLS - 2] = { type: 'floor' };
            } else {
                // Level Exit (Stairs)
                room.tiles[3][CONSTANTS.COLS - 2] = { type: 'stairs_down' };
            }

            // Populate Enemies
            this.populateEnemies(room, isStart);

            rooms.push(room);
        }

        return rooms;
    }

    populateEnemies(room, isStart) {
        if (isStart) return; // No enemies in start room

        // Simple random placement
        const enemyCount = 1 + Math.floor(this.random() * 2); // 1-2 enemies

        for (let i = 0; i < enemyCount; i++) {
            // Find empty floor
            let x, y;
            let tries = 0;
            do {
                x = Math.floor(this.random() * CONSTANTS.COLS);
                y = Math.floor(this.random() * CONSTANTS.ROWS);
                tries++;
            } while (room.tiles[y][x].type !== 'floor' && tries < 20);

            if (tries < 20) {
                const type = this.random() > 0.5 ? 'grunt' : 'shooter';
                room.enemies.push({ type, x, y });
            }
        }
    }

    parseTemplate(lines) {
        const grid = [];
        for (let r = 0; r < CONSTANTS.ROWS; r++) {
            const row = [];
            const line = lines[r] || ".........";
            for (let c = 0; c < CONSTANTS.COLS; c++) {
                const char = line[c];
                let type = 'floor';
                if (char === '#') type = 'wall';
                row.push({ type });
            }
            grid.push(row);
        }
        return grid;
    }
}
