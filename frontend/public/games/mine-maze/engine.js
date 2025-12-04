import { CONSTANTS, mulberry32, cyrb128, getDailySeed } from './utils.js';
import { SFX } from './sfx.js';
import { Bridge } from './bridge.js';
import { Renderer } from './renderer.js';

export class Engine {
    constructor() {
        this.sfx = new SFX();
        this.bridge = new Bridge();
        this.renderer = new Renderer();

        this.grid = [];
        this.movesLeft = CONSTANTS.STARTING_MOVES;
        this.score = 0;
        this.gameOver = false;
        this.victory = false;
        this.seed = getDailySeed();
        this.startTime = 0;
        this.firstClick = true;
        this.powerups = {
            extraMove: 1 // Start with 1 extra move powerup or 0? Prompt says powerups available. Let's give 0 and find them or buy them? "Upgrades/hints let skilled players push farther". "Powerups examples: Extra Move...". Let's place a powerup on grid.
        };

        this.init();
    }

    init() {
        // Check URL for seed
        const params = new URLSearchParams(window.location.search);
        const urlSeed = params.get('seed');
        if (urlSeed) this.seed = urlSeed;

        // Init RNG
        const seedHash = cyrb128(this.seed);
        this.rng = mulberry32(seedHash[0]); // Keep instance for stability

        this.generateGrid(); // Generate fully now
        this.renderer.init(this);
        this.setupInput();

        this.bridge.sendReady(CONSTANTS.COLS * CONSTANTS.TILE_SIZE, CONSTANTS.ROWS * CONSTANTS.TILE_SIZE + 100);
        this.startTime = Date.now();

        requestAnimationFrame(() => this.loop());
    }

    generateGrid() {
        this.grid = [];
        for (let y = 0; y < CONSTANTS.ROWS; y++) {
            const row = [];
            for (let x = 0; x < CONSTANTS.COLS; x++) {
                row.push({
                    x, y,
                    revealed: false,
                    flagged: false,
                    type: 'empty',
                    value: 0,
                    adjacentMines: 0
                });
            }
            this.grid.push(row);
        }

        let minesToPlace = Math.floor(CONSTANTS.COLS * CONSTANTS.ROWS * CONSTANTS.MINE_DENSITY);
        let treasuresToPlace = 5;
        let powerupsToPlace = 2; // e.g. Extra Moves

        let potentialTiles = [];
        for(let y=0; y<CONSTANTS.ROWS; y++) {
            for(let x=0; x<CONSTANTS.COLS; x++) {
                potentialTiles.push(this.grid[y][x]);
            }
        }

        // Shuffle
        for (let i = potentialTiles.length - 1; i > 0; i--) {
            const j = Math.floor(this.rng() * (i + 1));
            [potentialTiles[i], potentialTiles[j]] = [potentialTiles[j], potentialTiles[i]];
        }

        // Place Mines
        let placedMines = 0;
        let index = 0;
        while(placedMines < minesToPlace && index < potentialTiles.length) {
            potentialTiles[index].type = 'mine';
            placedMines++;
            index++;
        }

        // Place Treasures
        let placedTreasures = 0;
        while(placedTreasures < treasuresToPlace && index < potentialTiles.length) {
            potentialTiles[index].type = 'treasure';
            potentialTiles[index].value = Math.floor(this.rng() * 50) + 10;
            placedTreasures++;
            index++;
        }

        // Place Powerups
        let placedPowerups = 0;
        while(placedPowerups < powerupsToPlace && index < potentialTiles.length) {
            potentialTiles[index].type = 'powerup';
            potentialTiles[index].powerupType = 'extraMove';
            placedPowerups++;
            index++;
        }

        this.calculateAdjacency();
    }

    calculateAdjacency() {
         for(let y=0; y<CONSTANTS.ROWS; y++) {
            for(let x=0; x<CONSTANTS.COLS; x++) {
                if (this.grid[y][x].type === 'mine') continue;
                this.grid[y][x].adjacentMines = this.countAdjacentMines(x, y);
            }
        }
    }

    countAdjacentMines(cx, cy) {
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = cx + dx;
                const ny = cy + dy;
                if (nx >= 0 && nx < CONSTANTS.COLS && ny >= 0 && ny < CONSTANTS.ROWS) {
                    if (this.grid[ny][nx].type === 'mine') count++;
                }
            }
        }
        return count;
    }

    ensureSafety(startX, startY) {
        // If the first click is a mine or adjacent to a mine (usually we want 0 mines adjacent for first click to open up area)
        // Let's ensure it's not a mine.
        const startTile = this.grid[startY][startX];
        if (startTile.type === 'mine') {
            // Swap with first non-mine tile in grid that is not in the safe zone
            // Or just find any empty tile.
            let safeTile = null;
            // Scan for a safe spot
            outer: for(let y=0; y<CONSTANTS.ROWS; y++) {
                for(let x=0; x<CONSTANTS.COLS; x++) {
                    if (this.grid[y][x].type !== 'mine' && (x !== startX || y !== startY)) {
                        safeTile = this.grid[y][x];
                        break outer;
                    }
                }
            }

            if (safeTile) {
                // Swap types and values
                const tempType = startTile.type;
                const tempVal = startTile.value;
                const tempPType = startTile.powerupType;

                startTile.type = safeTile.type;
                startTile.value = safeTile.value;
                startTile.powerupType = safeTile.powerupType;

                safeTile.type = tempType;
                safeTile.value = tempVal;
                safeTile.powerupType = tempPType;

                // Re-calc adjacency for affected area (simplest is all)
                this.calculateAdjacency();
            }
        }
    }

    setupInput() {
        const canvas = this.renderer.canvas;

        const handleStart = (e) => {
            if (this.gameOver) return;
            e.preventDefault();
            this.sfx.ensureContext();

            const rect = canvas.getBoundingClientRect();
            let clientX, clientY;

            if (e.touches) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }

            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            const x = (clientX - rect.left) * scaleX;
            const y = (clientY - rect.top) * scaleY;

            // HUD / Exit Button Area
            // Let's define an Exit Button area in top right or bottom?
            // Renderer draws HUD at top. Let's say "Bank" button is at top center-right.
            // approx x: 300-400, y: 0-50.
            if (y < 60) {
                // Check if clicked "EXIT" or "BANK"
                // Assuming button is rendered around center-right.
                // Simple hit box:
                if (x > canvas.width - 100 && x < canvas.width) {
                    this.endGame(true);
                    return;
                }
            }

            const gridOffsetY = 60;
            if (y < gridOffsetY) return;

            const col = Math.floor((x - 10) / CONSTANTS.TILE_SIZE);
            const row = Math.floor((y - gridOffsetY) / CONSTANTS.TILE_SIZE);

            if (col >= 0 && col < CONSTANTS.COLS && row >= 0 && row < CONSTANTS.ROWS) {
                if (e.button === 2 || e.type === 'contextmenu') {
                    this.toggleFlag(col, row);
                } else {
                    this.reveal(col, row);
                }
            }
        };

        canvas.addEventListener('mousedown', handleStart);
        canvas.addEventListener('touchstart', handleStart, {passive: false});
        canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); });
    }

    toggleFlag(x, y) {
        const tile = this.grid[y][x];
        if (tile.revealed) return;
        tile.flagged = !tile.flagged;
        this.sfx.play('flag');
        this.render();
    }

    reveal(x, y) {
        const tile = this.grid[y][x];
        if (tile.revealed || tile.flagged) return;

        if (this.firstClick) {
            this.ensureSafety(x, y);
            this.firstClick = false;
        }

        tile.revealed = true;
        this.movesLeft--;

        if (tile.type === 'mine') {
            this.sfx.play('mine');
            this.endGame(false);
        } else {
            if (tile.type === 'treasure') {
                this.score += tile.value;
                this.sfx.play('treasure');
            } else if (tile.type === 'powerup') {
                if (tile.powerupType === 'extraMove') {
                    this.movesLeft += 3;
                    this.sfx.play('treasure'); // Reuse sound or new one
                    // Show floating text?
                }
            } else {
                this.sfx.play('reveal');
            }

            if (tile.adjacentMines === 0 && tile.type !== 'treasure' && tile.type !== 'powerup') {
                this.cascade(x, y);
            }

            if (this.movesLeft <= 0) {
                this.endGame(true);
            }
        }

        this.render();
    }

    cascade(cx, cy) {
        const queue = [[cx, cy]];
        const seen = new Set([`${cx},${cy}`]);

        while(queue.length > 0) {
            const [x, y] = queue.shift();

            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = x + dx;
                    const ny = y + dy;

                    if (nx >= 0 && nx < CONSTANTS.COLS && ny >= 0 && ny < CONSTANTS.ROWS) {
                        const neighbor = this.grid[ny][nx];
                        if (!neighbor.revealed && !neighbor.flagged && neighbor.type !== 'mine') {
                            neighbor.revealed = true;

                            if (neighbor.type === 'treasure') {
                                this.score += neighbor.value;
                            } else if (neighbor.type === 'powerup') {
                                if (neighbor.powerupType === 'extraMove') this.movesLeft += 3;
                            }

                            if (neighbor.adjacentMines === 0 && neighbor.type !== 'treasure' && neighbor.type !== 'powerup') {
                                const key = `${nx},${ny}`;
                                if (!seen.has(key)) {
                                    seen.add(key);
                                    queue.push([nx, ny]);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    endGame(survived) {
        if (this.gameOver) return;
        this.gameOver = true;
        if (survived) {
            this.sfx.play('win');
            this.bridge.sendScore(this.score, this.seed, Date.now() - this.startTime);
        } else {
            this.score = Math.floor(this.score / 2);
            this.bridge.sendScore(this.score, this.seed, Date.now() - this.startTime);
        }
    }

    loop() {
        this.renderer.render(this);
        if (!this.gameOver) {
            requestAnimationFrame(() => this.loop());
        } else {
            this.renderer.render(this);
        }
    }

    render() {
        this.renderer.render(this);
    }
}
