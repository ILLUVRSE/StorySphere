import { GameState, STATUS } from './engine.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { updateGuards, checkDetection, calculateVision } from './ai.js';
import { LEVELS } from './levels.js';
import { generateLevel } from './generator.js';
import { ArcadeBridge } from './bridge.js';
import { SFX } from './sfx.js';

// Game Globals
let gameState;
let renderer;
let currentLevelIdx = 0;
let isDaily = false;
let accumulatedScore = 0;

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const levelCompleteScreen = document.getElementById('level-complete-screen');
const scoreDisplay = document.getElementById('score-display');
const levelDisplay = document.getElementById('level-display');

// Init
function init() {
    ArcadeBridge.init();

    const canvas = document.getElementById('gameCanvas');
    renderer = new Renderer(canvas);

    // Check URL params for daily seed
    const params = new URLSearchParams(window.location.search);
    const seed = params.get('seed');

    if (seed) {
        isDaily = true;
        // Generate daily level
        startGame(generateLevel(seed));
    } else {
        // Show start screen
        document.getElementById('start-btn').onclick = () => {
            SFX.init();
            startLevel(0);
        };
    }

    // Attach Input
    new InputHandler(document.getElementById('game-container'), handleAction);

    // Resize handler
    window.addEventListener('resize', () => {
        if (renderer && gameState) renderer.resize(gameState);
        render();
    });

    // Setup UI buttons
    document.getElementById('retry-btn').onclick = restartLevel;
    document.getElementById('next-level-btn').onclick = nextLevel;

    // Game Loop (Render only)
    requestAnimationFrame(loop);
}

function startLevel(idx) {
    currentLevelIdx = idx;
    if (idx < LEVELS.length) {
        startGame(LEVELS[idx]);
        levelDisplay.innerText = `Level ${idx + 1}`;
    } else {
        // End of tutorial, generate random?
        // Or loop?
        startGame(generateLevel("TrainingComplete" + idx));
        levelDisplay.innerText = `Infinity ${idx - 7}`;
    }
}

function startGame(levelData) {
    gameState = new GameState({ width: levelData.width, height: levelData.height });
    gameState.init(levelData);

    // Pre-calculate vision for initial state
    updateGuardVision();

    renderer.resize(gameState);

    hideScreens();
    updateHUD();
    render();
}

function restartLevel() {
    if (isDaily) {
        // Daily retry
        const params = new URLSearchParams(window.location.search);
        startGame(generateLevel(params.get('seed')));
    } else {
        startLevel(currentLevelIdx);
    }
}

function nextLevel() {
    startLevel(currentLevelIdx + 1);
}

function hideScreens() {
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    levelCompleteScreen.style.display = 'none';
}

function handleAction(action) {
    SFX.resume(); // Ensure audio context is running

    if (!gameState || gameState.status !== STATUS.PLAYING) return;

    // Special: Mouse/Touch input returns {x,y}
    if (action.type === 'pointer') {
        const gridPos = renderer.getGridFromScreen(action.x, action.y);
        // Determine logical action from grid click
        // If adjacent to player, move. If on player, wait.
        const px = gameState.entities.player.x;
        const py = gameState.entities.player.y;

        const dx = gridPos.x - px;
        const dy = gridPos.y - py;

        if (dx === 0 && dy === 0) {
            action = { type: 'wait' };
        } else if (Math.abs(dx) + Math.abs(dy) === 1) {
            action = { type: 'move', dx, dy };
        } else {
            return; // Invalid click
        }
    }

    // 1. Player Turn
    const playerMoved = gameState.processPlayerInput(action);
    if (!playerMoved) return; // Invalid move

    SFX.step();
    if (gameState.stats.lootCollected > (accumulatedScore + gameState.score)) {
         SFX.loot(); // Just collected something
    }

    // 2. Check Immediate Detection (e.g. walked into view?)
    updateGuardVision(); // Update based on player new pos (guards haven't moved yet)
    if (checkDetection(gameState)) {
        failGame();
        return;
    }

    // 3. Guard Turn
    updateGuards(gameState); // Moves guards and updates their vision

    // 4. Check Detection Again (Guard walked into player)
    if (checkDetection(gameState)) {
        failGame();
        return;
    }

    // 5. Check Win
    if (gameState.status === STATUS.WON) {
        winGame();
    }

    gameState.turn++;
    updateHUD();
    render();
}

function updateGuardVision() {
    gameState.entities.guards.forEach(g => {
        g.visibleTiles = calculateVision(g, gameState);
    });
}

function failGame() {
    gameState.status = STATUS.LOST;
    SFX.fail();

    document.getElementById('go-title').innerText = "Detected!";
    document.getElementById('go-score').innerText = `Score: ${gameState.score}`;
    gameOverScreen.style.display = 'block';
}

function winGame() {
    SFX.win();

    // Calculate Score
    const baseScore = gameState.stats.lootCollected * 100;
    const stealthBonus = (gameState.stats.detections === 0) ? 500 : 0;
    const turnBonus = Math.max(0, 100 - gameState.turn); // Speed bonus

    const levelScore = baseScore + stealthBonus + turnBonus;
    accumulatedScore += levelScore;

    // Submit Score
    ArcadeBridge.submitScore(accumulatedScore, {
        level: currentLevelIdx + 1,
        turns: gameState.turn,
        stealth: gameState.stats.detections === 0
    });

    document.getElementById('lc-stats').innerText = `Score: ${levelScore}\nStealth: ${gameState.stats.detections === 0 ? 'Perfect' : 'Compromised'}`;
    levelCompleteScreen.style.display = 'block';
}

function updateHUD() {
    if (!gameState) return;
    scoreDisplay.innerText = `Loot: ${gameState.stats.lootCollected} | Turns: ${gameState.turn}`;
}

function loop() {
    render();
    requestAnimationFrame(loop);
}

function render() {
    if (renderer && gameState) {
        renderer.draw(gameState);
    }
}

// Boot
window.onload = init;
