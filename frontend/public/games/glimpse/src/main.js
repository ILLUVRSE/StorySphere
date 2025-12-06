import { GlimpseModel } from './model.js';
import { GlimpseRenderer } from './renderer.js';
import { BotAI } from './ai.js';

// Setup
const canvas = document.getElementById('glimpse-canvas');
const model = new GlimpseModel(4);
const renderer = new GlimpseRenderer(canvas, model);
const bots = [];

// Debug
window.revealMySigil = false;
document.getElementById('reveal-sigil-cb').addEventListener('change', (e) => {
    window.revealMySigil = e.target.checked;
    renderer.draw();
});

// Init Bots
for (let i = 1; i < 4; i++) {
    bots.push(new BotAI(i, model));
}

// UI Controls
const controlsDiv = document.getElementById('controls');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalAction = document.getElementById('modal-action');

modalAction.addEventListener('click', () => {
    modal.style.display = 'none';
    startGame();
});

// Game Loop
let lastTime = 0;
function loop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    // Update logic? (Usually event driven, but animations go here)
    renderer.draw();

    // AI Turn handling
    if (model.phase === 'playing' && model.turn !== 0 && !model.trickWinner) {
        // Add small delay for realism
        if (!window.aiThinking) {
            window.aiThinking = true;
            setTimeout(() => {
                const bot = bots.find(b => b.id === model.turn);
                if (bot) {
                    const card = bot.chooseCard();
                    if (card) {
                        model.playCard(bot.id, card);
                        checkTrickEnd();
                    } else {
                        console.error("Bot could not find move!");
                    }
                }
                window.aiThinking = false;
                renderer.draw();
            }, 800);
        }
    }

    requestAnimationFrame(loop);
}

// Input Handling
canvas.addEventListener('click', (e) => {
    if (model.turn !== 0 || model.phase !== 'playing' || window.aiThinking) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const card = renderer.getCardAt(x, y);
    if (card) {
        const result = model.playCard(0, card);
        if (result.success) {
            renderer.draw();
            checkTrickEnd();
        } else {
            console.warn(result.reason);
            // Shake effect?
        }
    }
});

function checkTrickEnd() {
    if (model.currentTrick.length === model.playerCount) {
        // Trick complete
        window.aiThinking = true; // Block input during resolution
        setTimeout(() => {
            const { winner, handEnded } = model.resolveTrick();
            console.log(`Player ${winner} won the trick!`);

            if (handEnded) {
                setTimeout(() => {
                    handleHandEnd();
                }, 1500);
            }

            window.aiThinking = false;
            renderer.draw();
        }, 1500);
    }
}

function handleHandEnd() {
    if (model.phase === 'gameOver') {
        showGameOver();
    } else {
        // Show score summary or just start next hand
        alert(`Hand Ended!\nScores:\n${model.players.map(p => `P${p.id+1}: ${p.score}`).join('\n')}`);
        model.startHand();
    }
}

function showGameOver() {
    const sorted = [...model.players].sort((a,b) => a.score - b.score);
    const winner = sorted[0];

    modalTitle.innerText = "Game Over";
    modalMessage.innerHTML = `Winner: Player ${winner.id + 1}<br>Score: ${winner.score}`;
    modal.style.display = 'block';
}

function startGame() {
    model.init();
    model.startHand();
    requestAnimationFrame(loop);
}

// Start
startGame();
