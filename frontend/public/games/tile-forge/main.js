import { Bridge } from './bridge.js';
import { getDailySeed } from './utils.js';
import { MatchEngine } from './match.js';
import { Renderer } from './renderer.js';
import { CraftingSystem } from './craft.js';
import { CombatEngine } from './combat.js';
import { AudioHandler } from './audio.js';

// Parse params
const params = new URLSearchParams(window.location.search);
const seed = params.get('seed') || getDailySeed();

const bridge = new Bridge('tile-forge');
const canvas = document.getElementById('game-canvas');
const renderer = new Renderer(canvas);
const crafting = new CraftingSystem();
const audio = new AudioHandler();

let matchEngine;
let combatEngine;
let lastTime = 0;
let phase = 'BOOT'; // BOOT, MATCH, COMBAT, RESULT, GAME_OVER
let round = 1;
const MAX_ROUNDS = 3;
let totalScore = 0;
let totalTime = 0;
let matchTimer = 30000; // 30s

// Input Handling
canvas.addEventListener('mousedown', (e) => {
    if (phase === 'MATCH' && matchEngine) {
        const {r, c} = renderer.getGridCoords(e.clientX, e.clientY);
        matchEngine.selectTile(r, c);
    }
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (phase === 'MATCH' && matchEngine) {
        const touch = e.changedTouches[0];
        const {r, c} = renderer.getGridCoords(touch.clientX, touch.clientY);
        matchEngine.selectTile(r, c);
    }
}, {passive: false});

// Keyboard Input (Combat)
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.key] = true;

    if (phase === 'COMBAT' && combatEngine) {
        if (e.key === '1') { combatEngine.useWeapon(0); audio.play('shoot'); }
        if (e.key === '2') { combatEngine.useWeapon(1); audio.play('shoot'); }
        if (e.key === '3') { combatEngine.useWeapon(2); audio.play('shoot'); }
    }
});
window.addEventListener('keyup', e => keys[e.key] = false);


function onMatch(matchData) {
    audio.play('match');
    const weapon = crafting.craft(matchData);
    if (weapon) {
        audio.play('craft');
        // Add to inventory (limit 3)
        if (crafting.craftedItems.length < 3) {
            crafting.craftedItems.push(weapon);
            updateMatchUI();

            // If full, maybe early exit? Or just wait for timer.
            // Spec: "30s timer (configurable) or until player crafts X items."
            if (crafting.craftedItems.length === 3) {
                // Shorten timer to 3s to let them finish up visual
                matchTimer = Math.min(matchTimer, 3000);
            }
        }
    }
}

function onCombatOver(result) {
    totalScore += result.score;
    // Survival bonus?
    if (result.won) totalScore += 500;

    phase = 'RESULT';
    updateResultUI(result);

    setTimeout(() => {
        if (!result.won || round >= MAX_ROUNDS) {
            endGame(result.won);
        } else {
            round++;
            startMatchPhase();
        }
    }, 4000);
}

function endGame(won) {
    phase = 'GAME_OVER';

    if (won) audio.play('win');
    else audio.play('lose');

    bridge.sendScore(totalScore, seed, Date.now(), { rounds: round, won });

    const ui = document.getElementById('ui-layer');
    ui.innerHTML = `
        <div style="
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.85);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            color: #fff; font-family: monospace;
        ">
            <h1>${won ? 'VICTORY' : 'GAME OVER'}</h1>
            <h2>Score: ${totalScore}</h2>
            <p>Rounds Survived: ${round}</p>
            <button onclick="window.location.reload()" style="
                padding: 10px 20px; background: #009688; border: none; color: #fff; font-size: 16px; cursor: pointer;
            ">PLAY AGAIN</button>
        </div>
    `;
}

function startMatchPhase() {
    phase = 'MATCH';
    matchTimer = 30000;
    crafting.craftedItems = []; // Clear for new round? Or keep? Spec: "3-6 rounds... Match phase: until player crafts X items".
    // "Core loop: ...craft 1-3 temporary weapons -> fight... Repeat."
    // Usually roguelikes keep inventory, but this is "Match tiles to craft TEMPORARY weapons".
    // So we clear inventory.

    matchEngine = new MatchEngine(seed + '_' + round, onMatch);
    updateMatchUI();
}

function startCombatPhase() {
    phase = 'COMBAT';
    // If no weapons, give a pea shooter fallback?
    if (crafting.craftedItems.length === 0) {
        crafting.craftedItems.push({
            id: 'default',
            archetype: 'pistol',
            element: 'energy',
            tier: 'common',
            power: 5,
            charges: 99,
            cooldownMs: 400,
            meta: {}
        });
    }

    combatEngine = new CombatEngine(seed + '_' + round, crafting.craftedItems, onCombatOver);
    updateCombatUI();
}

function updateMatchUI() {
    const ui = document.getElementById('ui-layer');
    ui.innerHTML = `
        <div style="position: absolute; top: 10px; right: 10px; font-family: monospace; font-size: 20px; text-align: right;">
            <div>Round ${round}/${MAX_ROUNDS}</div>
            <div>Time: ${Math.ceil(matchTimer/1000)}</div>
        </div>
        <div style="position: absolute; bottom: 10px; left: 10px; display: flex; gap: 10px;">
            ${crafting.craftedItems.map(w =>
                `<div style="background: rgba(0,0,0,0.8); border: 1px solid #ffd700; padding: 5px; color: #fff; font-size: 12px;">
                    ${w.tier} ${w.element} ${w.archetype}<br>Pwr: ${w.power}
                </div>`
            ).join('')}
            ${crafting.craftedItems.length < 3 ? '<div style="padding:10px; color:#aaa;">Craft items...</div>' : ''}
        </div>
    `;
}

function updateCombatUI() {
    // Combat UI handled by renderer overlay for HUD
    // But we need the Weapon selector
    const ui = document.getElementById('ui-layer');
    ui.innerHTML = `
        <div style="position: absolute; bottom: 10px; left: 0; width: 100%; display: flex; justify-content: center; gap: 10px;">
            ${crafting.craftedItems.map((w, i) =>
                `<div style="
                    background: rgba(0,0,0,0.8);
                    border: 1px solid ${combatEngine.player.weaponCooldowns[i] > 0 ? 'red' : '#009688'};
                    padding: 5px; color: #fff; font-size: 12px; width: 80px; text-align: center;
                    opacity: ${w.charges > 0 ? 1 : 0.5};
                ">
                    <div style="font-weight:bold; color: #ffd700;">[${i+1}] ${w.archetype}</div>
                    <div>${w.charges} chg</div>
                </div>`
            ).join('')}
        </div>
    `;
}

function updateResultUI(result) {
    const ui = document.getElementById('ui-layer');
    ui.innerHTML = `
        <div style="
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            color: #fff; font-family: monospace;
        ">
            <h2>ROUND COMPLETE</h2>
            <p>Score: ${result.score}</p>
            <p>${result.won ? 'Sector Cleared' : 'Defeated'}</p>
        </div>
    `;
}

function init() {
    console.log("Tile Forge initializing...");
    bridge.sendReady(canvas.width, canvas.height);

    startMatchPhase();
    requestAnimationFrame(loop);
}

function loop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    if (phase === 'MATCH') {
        matchTimer -= dt;
        if (matchTimer <= 0) {
            startCombatPhase();
        } else {
            renderer.renderMatch(matchEngine, dt);
            updateMatchUI(); // Just for timer
        }
    } else if (phase === 'COMBAT') {
        // Input polling for movement
        let dx = 0; let dy = 0;
        if (keys['ArrowUp'] || keys['w']) dy = -1;
        if (keys['ArrowDown'] || keys['s']) dy = 1;
        if (keys['ArrowLeft'] || keys['a']) dx = -1;
        if (keys['ArrowRight'] || keys['d']) dx = 1;

        if (dx !== 0 || dy !== 0) combatEngine.movePlayer(dx, dy);

        combatEngine.update(dt);
        renderer.renderCombat(combatEngine, dt);
        updateCombatUI(); // Cooldowns
    }

    requestAnimationFrame(loop);
}

init();
