import { CONSTANTS, getDailySeed } from './utils.js';
import { Renderer } from './renderer.js';
import { DungeonGenerator } from './generator.js';
import { Player } from './player.js';
import { Enemy } from './enemies.js';
import { Projectile } from './combat.js';
import { Bridge } from './bridge.js';
import { SFX } from './sfx.js';

export class GameEngine {
    constructor() {
        this.sfx = new SFX();
        this.renderer = new Renderer();
        this.lastTickTime = 0;
        this.accumulatedTime = 0;
        this.currentTick = 0;

        // Input state
        this.keys = {};
        this.lastPlayerMoveTick = -1;
        this.inputQueue = null; // { dx, dy }

        // Entities
        this.enemies = [];
        this.projectiles = [];

        this.bridge = new Bridge();

        this.init();
        this.startLoop();
    }

    init() {
        this.bridge.sendReady(CONSTANTS.CANVAS_WIDTH, CONSTANTS.CANVAS_HEIGHT);

        // Setup input listeners
        window.addEventListener('keydown', (e) => {
            if (this.keys[e.code]) return; // Prevent repeat if held (optional)
            this.keys[e.code] = true;
            this.handleInput(e.code);
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // Check for seed in URL or use daily
        const params = new URLSearchParams(window.location.search);
        this.seed = params.get('seed') || getDailySeed();
        document.getElementById('seed-display').innerText = `SEED: ${this.seed}`;

        console.log(`Initialized with seed: ${this.seed}`);

        // Generate Dungeon
        this.generator = new DungeonGenerator(this.seed);
        this.levelRooms = this.generator.generateLevel(1);

        this.loadRoom(0, 'left');
    }

    handleInput(code) {
        if (!this.player.alive) {
             if (code === 'Enter' || code === 'Space') {
                 // Restart
                 location.reload();
             }
             return;
        }

        // Simple input mapping
        let dx = 0;
        let dy = 0;

        if (code === 'ArrowUp' || code === 'KeyW') dy = -1;
        else if (code === 'ArrowDown' || code === 'KeyS') dy = 1;
        else if (code === 'ArrowLeft' || code === 'KeyA') dx = -1;
        else if (code === 'ArrowRight' || code === 'KeyD') dx = 1;
        else if (code === 'Space' || code === 'Enter') {
            // Player Attack (Melee)
            this.playerAttack();
            return;
        }
        else return;

        // Immediate Player Move Check
        // Rule: 1 move per tick.
        if (this.lastPlayerMoveTick !== this.currentTick) {
            // Execute move immediately
            this.movePlayer(dx, dy);
            this.lastPlayerMoveTick = this.currentTick;
        } else {
            // Queue input
            this.inputQueue = { dx, dy };
        }
    }

    movePlayer(dx, dy) {
        // Check if attacking into enemy
        const targetX = this.player.x + dx;
        const targetY = this.player.y + dy;

        const enemy = this.enemies.find(e => e.alive && e.x === targetX && e.y === targetY);
        if (enemy) {
            this.damageEnemy(enemy, 1);
            this.sfx.play('hit');
            // Action consumed
            return;
        }

        const moved = this.player.tryMove(dx, dy, this.currentRoom);
        if (moved) {
            this.sfx.play('move');
            this.checkRoomExit();
        }
    }

    playerAttack() {
        // Simple AoE around player? Or just directional?
        // Let's do simple directional if we tracked last dir, or just allow 'bump to attack' as primary.
        // If Space is pressed, maybe skip turn (Wait)?
        console.log("Player Waits");
        // Consumes turn
        if (this.lastPlayerMoveTick !== this.currentTick) {
            this.lastPlayerMoveTick = this.currentTick;
        }
    }

    checkRoomExit() {
        const tile = this.currentRoom.tiles[this.player.y][this.player.x];
        if (tile.type === 'door_next') {
            this.loadRoom(this.currentRoomIdx + 1, 'left');
        } else if (tile.type === 'door_prev') {
            this.loadRoom(this.currentRoomIdx - 1, 'right');
        } else if (tile.type === 'stairs_down') {
            console.log("Level Complete!");
            // TODO: Next level or Win
        }
    }

    loadRoom(idx, entrySide) {
        if (idx < 0 || idx >= this.levelRooms.length) return;
        this.currentRoomIdx = idx;
        this.currentRoom = this.levelRooms[idx];

        // Init Player if first time
        if (!this.player) {
             this.player = new Player(1, 3);
        }

        // Position Player at entrance
        if (entrySide === 'left') {
            this.player.x = 1;
            this.player.y = 3;
        } else if (entrySide === 'right') {
            this.player.x = CONSTANTS.COLS - 2;
            this.player.y = 3;
        }

        // Instantiate Enemies from Room Data
        this.enemies = [];
        if (this.currentRoom.enemies) {
            this.currentRoom.enemies.forEach((eData, i) => {
                const enemy = new Enemy(i, eData.type, eData.x, eData.y);
                this.enemies.push(enemy);
            });
        }

        this.projectiles = []; // Clear projectiles on room switch
        this.updateUi();
    }

    startLoop() {
        this.lastTickTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    loop(timestamp) {
        const dt = timestamp - this.lastTickTime;
        this.lastTickTime = timestamp;
        this.accumulatedTime += dt;

        // Fixed Tick Update
        while (this.accumulatedTime >= CONSTANTS.TICK_MS) {
            this.tick();
            this.accumulatedTime -= CONSTANTS.TICK_MS;
        }

        // Render Interpolation (optional) or just Render
        this.render();

        requestAnimationFrame((t) => this.loop(t));
    }

    tick() {
        this.currentTick++;

        // Process Buffered Input if any
        if (this.inputQueue) {
             if (this.lastPlayerMoveTick !== this.currentTick) {
                 this.movePlayer(this.inputQueue.dx, this.inputQueue.dy);
                 this.lastPlayerMoveTick = this.currentTick;
                 this.inputQueue = null;
             }
        }

        // Update Enemies
        this.enemies.forEach(e => e.update(this.currentTick, this.player, this.currentRoom, this));

        // Update Projectiles
        this.projectiles.forEach(p => p.update(this.currentRoom, this));
        this.projectiles = this.projectiles.filter(p => p.active);
    }

    damagePlayer(amount) {
        if (!this.player.alive) return;
        this.player.hp -= amount;
        this.sfx.play('hit');
        console.log(`Player damaged! HP: ${this.player.hp}`);
        this.updateUi();
        if (this.player.hp <= 0) {
            this.player.alive = false;
            this.sfx.play('die');
            this.onGameOver();
        }
    }

    damageEnemy(enemy, amount) {
        enemy.hp -= amount;
        if (enemy.hp <= 0) {
            enemy.alive = false;
            // Drop item? Score?
        }
    }

    spawnProjectile(x, y, dx, dy, owner) {
        this.projectiles.push(new Projectile(x, y, dx, dy, owner));
        this.sfx.play('shoot');
    }

    onGameOver() {
        console.log("GAME OVER");
        document.getElementById('ui-layer').innerHTML += `<div style="position:absolute;top:50%;width:100%;text-align:center;font-size:40px;color:red;text-shadow:2px 2px 0 #000">GAME OVER<br><span style="font-size:20px;color:#fff">Press Enter to Restart</span></div>`;

        this.bridge.sendScore(this.currentRoomIdx * 100, this.seed, this.accumulatedTime);
    }

    render() {
        this.renderer.clear();

        // Draw Room
        this.renderer.drawLevel(this.currentRoom);

        // Draw Enemies
        this.enemies.forEach(e => {
            if (e.alive) {
                 this.renderer.drawEntity(
                     e.x * CONSTANTS.TILE_SIZE,
                     e.y * CONSTANTS.TILE_SIZE,
                     CONSTANTS.COLORS.ENEMY,
                     e.type === 'grunt' ? 'G' : 'S'
                 );
            }
        });

        // Draw Projectiles
        this.projectiles.forEach(p => {
            this.renderer.drawEntity(
                p.x * CONSTANTS.TILE_SIZE + CONSTANTS.TILE_SIZE*0.25,
                p.y * CONSTANTS.TILE_SIZE + CONSTANTS.TILE_SIZE*0.25,
                '#ff0', // Yellow
                '*'
            );
        });

        // Draw Player
        if (this.player && this.player.alive) {
            this.renderer.drawEntity(
                this.player.x * CONSTANTS.TILE_SIZE,
                this.player.y * CONSTANTS.TILE_SIZE,
                CONSTANTS.COLORS.PLAYER
            );
        }
    }

    updateUi() {
        document.getElementById('hp-display').innerText = `HP: ${this.player.hp}/${this.player.maxHp}`;
        document.getElementById('level-display').innerText = `ROOM: ${this.currentRoomIdx + 1}/${this.levelRooms.length}`;
    }
}
