export const TILE = {
    FLOOR: 0,
    WALL: 1,
    COVER: 2,
    VENT: 3,
    NOISE: 4,
    EXIT: 9
};

export const DIR = {
    N: { x: 0, y: -1 },
    E: { x: 1, y: 0 },
    S: { x: 0, y: 1 },
    W: { x: -1, y: 0 },
    NONE: { x: 0, y: 0 }
};

export const STATUS = {
    PLAYING: 'playing',
    WON: 'won',
    LOST: 'lost'
};

export class GameState {
    constructor(config) {
        this.width = config.width || 8;
        this.height = config.height || 8;
        this.grid = [];
        this.entities = {
            player: { x: 0, y: 0, dir: DIR.S, stealth: true },
            guards: [],
            items: [],
            props: []
        };
        this.turn = 0;
        this.score = 0;
        this.status = STATUS.PLAYING;
        this.stats = {
            moves: 0,
            detections: 0,
            lootCollected: 0
        };
        this.message = "";
    }

    init(levelData) {
        this.width = levelData.width;
        this.height = levelData.height;

        // Init grid
        this.grid = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push(TILE.FLOOR);
            }
            this.grid.push(row);
        }

        // Apply map data
        if (levelData.map) {
            levelData.map.forEach((rowStr, y) => {
                for (let x = 0; x < rowStr.length; x++) {
                    const char = rowStr[x];
                    if (char === '#') this.grid[y][x] = TILE.WALL;
                    else if (char === '+') this.grid[y][x] = TILE.COVER;
                    else if (char === 'X') this.grid[y][x] = TILE.EXIT;
                    else if (char === '!') this.grid[y][x] = TILE.NOISE;
                    else if (char === '@') {
                        this.entities.player.x = x;
                        this.entities.player.y = y;
                    }
                }
            });
        }

        this.entities.guards = levelData.guards ? JSON.parse(JSON.stringify(levelData.guards)) : [];
        this.entities.items = levelData.items ? JSON.parse(JSON.stringify(levelData.items)) : [];
        this.entities.props = levelData.props ? JSON.parse(JSON.stringify(levelData.props)) : [];

        this.turn = 0;
        this.status = STATUS.PLAYING;
        this.stats = { moves: 0, detections: 0, lootCollected: 0 };
    }

    isWalkable(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        const tile = this.grid[y][x];
        return tile !== TILE.WALL;
    }

    isOccupiedByGuard(x, y) {
        return this.entities.guards.some(g => g.x === x && g.y === y);
    }

    // Returns true if player successfully acted (moved or waited)
    processPlayerInput(action) {
        if (this.status !== STATUS.PLAYING) return false;

        let acted = false;

        if (action.type === 'move') {
            const nx = this.entities.player.x + action.dx;
            const ny = this.entities.player.y + action.dy;

            if (this.isWalkable(nx, ny)) {
                if (!this.isOccupiedByGuard(nx, ny)) {
                    this.entities.player.x = nx;
                    this.entities.player.y = ny;

                    // Update facing
                    if (action.dx === 1) this.entities.player.dir = DIR.E;
                    else if (action.dx === -1) this.entities.player.dir = DIR.W;
                    else if (action.dy === 1) this.entities.player.dir = DIR.S;
                    else if (action.dy === -1) this.entities.player.dir = DIR.N;

                    acted = true;
                }
            }
        } else if (action.type === 'wait') {
            acted = true;
        }

        if (acted) {
            this.stats.moves++;
            this.checkInteractions();
            return true;
        }
        return false;
    }

    checkInteractions() {
        const px = this.entities.player.x;
        const py = this.entities.player.y;

        // Collect Items
        for (let i = this.entities.items.length - 1; i >= 0; i--) {
            const item = this.entities.items[i];
            if (item.x === px && item.y === py) {
                this.entities.items.splice(i, 1);
                this.stats.lootCollected++;
            }
        }

        // Check Exit
        if (this.grid[py][px] === TILE.EXIT) {
            this.status = STATUS.WON;
        }
    }
}
