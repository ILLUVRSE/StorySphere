import { mulberry32, getDailySeed, cyrb128 } from './utils.js';
import { GameEngine } from './engine.js';
import { Renderer } from './renderer.js';
import { SoundManager } from './sfx.js';
import { sendScore } from './bridge.js';

// Setup
const canvas = document.getElementById('gameCanvas');
const sfx = new SoundManager();
const renderer = new Renderer(canvas);

// UI Layers
const startScreen = document.getElementById('start-screen');
const ladderContainer = document.getElementById('ladder-container');
const classicPowerups = document.getElementById('classic-powerups');
const millionaireLifelines = document.getElementById('millionaire-lifelines');
const hintText = document.getElementById('hint-text');
const roastMsg = document.getElementById('roast-msg');
const spotlight = document.getElementById('spotlight');

// Roasts
const ROASTS = [
    "My grandmother guesses better.",
    "Did you even try?",
    "That was embarrassing.",
    "Oof. Just oof.",
    "Maybe stick to Tic-Tac-Toe?",
    "The odds were 50/50 and you still lost.",
    "A coin flip would have done better.",
    "Your intuition is broken.",
    "Is this your first day?",
    "I'd ask for a refund if this wasn't free."
];

// Seed & Mode
let currentMode = 'arcade';
let seedStr = getDailySeed(); // Default to daily seed base
let seedVal = cyrb128(seedStr);

let engine = null;
let isProcessingGuess = false;

// Mode Buttons
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.onclick = () => {
        const selectedMode = btn.dataset.mode;
        startGame(selectedMode);
    };
});

function startGame(mode) {
    currentMode = mode;
    startScreen.style.display = 'none';

    // For non-daily modes, maybe randomize seed?
    // The requirement implies these are new modes. Let's make them random seeds for replayability
    // unless it's strictly the "Daily" challenge.
    // Let's assume Streak and Millionaire are replayable arcade modes.
    seedStr = Math.random().toString(36).substring(7);
    seedVal = cyrb128(seedStr);

    renderer.setMode(mode);

    // Initialize Engine FIRST so we can access constants like MONEY_LADDER
    initEngine();

    // UI Config
    if (mode === 'millionaire') {
        ladderContainer.style.display = 'flex';
        classicPowerups.style.display = 'none';
        millionaireLifelines.style.display = 'flex';
        buildLadderUI();
        updateLadderUI();
    } else {
        ladderContainer.style.display = 'none';
        classicPowerups.style.display = 'flex';
        millionaireLifelines.style.display = 'none';
    }
}

function initEngine() {
    const rng = mulberry32(seedVal);
    engine = new GameEngine(seedStr, currentMode);
    engine.init(rng);

    isProcessingGuess = false;
    renderer.setHidden(false);
    renderer.roastText = "";
    hintText.innerText = '';
    roastMsg.style.opacity = 0;
    spotlight.classList.remove('dimmed');

    updateUI();
    render();
}

function buildLadderUI() {
    ladderContainer.innerHTML = '';
    engine.MONEY_LADDER.forEach((amt, i) => {
        const div = document.createElement('div');
        div.className = 'ladder-step';
        if (engine.CHECKPOINTS.includes(i)) div.classList.add('safe');
        div.innerText = `$${amt.toLocaleString()}`;
        div.id = `ladder-${i}`;
        ladderContainer.appendChild(div);
    });
}

function updateLadderUI() {
    if (currentMode !== 'millionaire') return;

    for (let i = 0; i < engine.MONEY_LADDER.length; i++) {
        const el = document.getElementById(`ladder-${i}`);
        if (!el) continue;
        el.className = 'ladder-step';
        if (engine.CHECKPOINTS.includes(i)) el.classList.add('safe');

        if (i < engine.ladderIndex) {
            el.classList.add('completed');
        } else if (i === engine.ladderIndex) {
             // current won
             el.classList.add('completed');
        } else if (i === engine.ladderIndex + 1) {
             // current target
             el.classList.add('active');
        }
    }
}

// Handling Guesses
async function handleGuess(choice) {
    if (isProcessingGuess || engine.gameOver) return;
    sfx.ensureContext();

    if (currentMode === 'millionaire') {
        await handleMillionaireGuess(choice);
    } else {
        // Instant result for others
        const result = engine.guess(choice);
        processResult(result);
    }
}

async function handleMillionaireGuess(choice) {
    isProcessingGuess = true;

    // 1. Dramatic Pause Setup
    renderer.setHidden(true); // Hide the card
    spotlight.classList.add('dimmed'); // Darken screen
    sfx.playHeartbeat();
    render();

    // 2. Wait...
    await new Promise(r => setTimeout(r, 2000));

    // 3. Reveal
    const result = engine.guess(choice); // Logic happens here
    renderer.setHidden(false); // Show the card
    spotlight.classList.remove('dimmed');

    // 4. Stinger
    sfx.playSting();
    render();

    // 5. Result processing
    await new Promise(r => setTimeout(r, 500)); // Brief pause to look at card
    processResult(result);

    isProcessingGuess = false;
}

function processResult(result) {
    if (result.result === 'correct' || result.result === 'win_big') {
        if (currentMode === 'millionaire') {
             sfx.playCheer();
             if (result.result === 'win_big') {
                 renderer.spawnConfetti();
                 hintText.innerText = "MILLIONAIRE!!!";
             }
        } else {
             sfx.playWin();
             sfx.playFlip();
        }
    } else if (result.result === 'saved') {
        sfx.playTone(200, 'square', 0.1);
        hintText.innerText = "Shield Saved You!";
        setTimeout(() => hintText.innerText = "", 1500);
    } else if (result.result === 'game_over') {
        if (currentMode === 'millionaire') {
            sfx.playSadTrombone(); // Fail sound
            // Pick Roast
            const roast = ROASTS[Math.floor(Math.random() * ROASTS.length)];
            renderer.roastText = roast;
            roastMsg.innerText = roast;
            roastMsg.style.opacity = 1;
        } else {
            sfx.playLoss();
        }

        // Use generic score or streak depending on mode
        let scoreToSend = engine.score;
        if (currentMode === 'millionaire') {
             // Send money as score? Or level?
             // Leaderboard expects int. Let's send money.
             scoreToSend = (result.prize !== undefined) ? result.prize : 0;
             // If they won big, money is in result.money
             if (result.money) scoreToSend = result.money;
        } else if (currentMode === 'streak') {
             scoreToSend = engine.streak;
        }

        sendScore(scoreToSend, engine);
    }

    updateUI();
    render();
}

function updateUI() {
    updateLadderUI();

    const disabled = engine.gameOver || isProcessingGuess;

    // Classic
    const btnDouble = document.getElementById('btn-double');
    const btnHint = document.getElementById('btn-hint');
    const btnHigher = document.getElementById('btn-higher');
    const btnLower = document.getElementById('btn-lower');

    btnDouble.disabled = disabled || engine.streak < 1 || engine.doubleOrNothingActive;
    btnHint.disabled = disabled || engine.hintUsed;
    btnHigher.disabled = disabled;
    btnLower.disabled = disabled;

    if (engine.doubleOrNothingActive) {
        btnDouble.classList.add('active');
    } else {
        btnDouble.classList.remove('active');
    }

    // Millionaire
    const btnAudience = document.getElementById('btn-audience');
    const btnPhone = document.getElementById('btn-phone');
    const btnSwap = document.getElementById('btn-swap');

    if (engine.lifelines) {
        btnAudience.disabled = disabled || !engine.lifelines.audience;
        btnPhone.disabled = disabled || !engine.lifelines.phone;
        btnSwap.disabled = disabled || !engine.lifelines.swap;
    }
}

// Bindings
document.getElementById('btn-higher').onclick = () => handleGuess('higher');
document.getElementById('btn-lower').onclick = () => handleGuess('lower');

document.getElementById('btn-double').onclick = () => {
    if (engine.activatePowerup('double')) updateUI();
};
document.getElementById('btn-hint').onclick = () => {
    const info = engine.activatePowerup('hint');
    if (info) {
        hintText.innerText = `Hint: ${info.range}, ${info.color}`;
        updateUI();
    }
};

// Millionaire Lifelines
document.getElementById('btn-audience').onclick = () => {
    const info = engine.activatePowerup('audience');
    if (info) {
        hintText.innerText = `Audience says: ${info.vote.toUpperCase()} (${info.percent}%)`;
        document.getElementById('btn-audience').disabled = true;
    }
};
document.getElementById('btn-phone').onclick = () => {
    const info = engine.activatePowerup('phone');
    if (info) {
        hintText.innerText = `Friend: "${info.message}"`;
        document.getElementById('btn-phone').disabled = true;
    }
};
document.getElementById('btn-swap').onclick = () => {
    const info = engine.activatePowerup('swap');
    if (info) {
        // Animation for swap?
        sfx.playFlip();
        render();
        document.getElementById('btn-swap').disabled = true;
    }
};

// Controls
window.addEventListener('keydown', (e) => {
    if (startScreen.style.display !== 'none') return;

    if (e.code === 'ArrowUp') handleGuess('higher');
    if (e.code === 'ArrowDown') handleGuess('lower');

    if (currentMode === 'arcade') {
        if (e.code === 'KeyD') document.getElementById('btn-double').click();
        if (e.code === 'KeyH') document.getElementById('btn-hint').click();
    }

    if (engine && engine.gameOver && (e.code === 'Enter' || e.code === 'Space')) {
        // In Millionaire, maybe go back to menu? Or restart same mode.
        // Let's restart same mode.
        seedStr = Math.random().toString(36).substring(7);
        seedVal = cyrb128(seedStr);
        initEngine();
    }
});

canvas.addEventListener('click', () => {
    if (engine && engine.gameOver) {
         seedStr = Math.random().toString(36).substring(7);
         seedVal = cyrb128(seedStr);
         initEngine();
    }
});

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderer.resize();
    render();
}
window.addEventListener('resize', resize);

function render() {
    if (engine) renderer.render(engine);
}

// Initial Render for background
renderer.clear();
