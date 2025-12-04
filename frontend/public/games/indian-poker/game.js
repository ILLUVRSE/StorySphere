/**
 * Indian Poker - MVP
 * Local Single Player vs Bots
 */

// --- Constants ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const TICK_RATE = 60; // FPS

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const COLORS = {
    TABLE: '#006400',
    CARD_BACK: '#b22222',
    CARD_FRONT: '#fdfbf7',
    TEXT_BLACK: '#1a1a1a',
    TEXT_RED: '#d32f2f',
    GOLD: '#ffd700',
    CHIP: '#ff8c00',
    PLAYER_BG: 'rgba(0,0,0,0.5)',
    ACTIVE_BORDER: '#ffd700',
    FOLDED_OVERLAY: 'rgba(0,0,0,0.7)'
};

// --- Utilities ---
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- Classes ---

class Card {
    constructor(rank, suit) {
        this.rank = rank;
        this.suit = suit;
        this.value = RANK_VALUES[rank];
        this.color = (suit === '♥' || suit === '♦') ? COLORS.TEXT_RED : COLORS.TEXT_BLACK;
    }

    toString() {
        return `${this.rank}${this.suit}`;
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }

    reset() {
        this.cards = [];
        for (let s of SUITS) {
            for (let r of RANKS) {
                this.cards.push(new Card(r, s));
            }
        }
        shuffle(this.cards);
    }

    deal() {
        return this.cards.pop();
    }
}

class Player {
    constructor(id, name, isHuman = false, chips = 1000) {
        this.id = id;
        this.name = name;
        this.isHuman = isHuman;
        this.chips = chips;
        this.hand = null; // Card object
        this.folded = false;
        this.currentBet = 0;
        this.action = null; // Last action text
        this.actionTimer = 0;
    }

    resetForRound() {
        this.hand = null;
        this.folded = false;
        this.currentBet = 0;
        this.action = null;
    }
}

class LocalServer {
    constructor(game) {
        this.game = game;
        this.players = [
            new Player(0, "Hero", true, 1000),
            new Player(1, "Bot-L", false, 1000),
            new Player(2, "Bot-T", false, 1000),
            new Player(3, "Bot-R", false, 1000)
        ];
        this.deck = new Deck();
        this.pot = 0;
        this.dealerIdx = 0;
        this.turnIdx = 0;
        this.minBet = 10;
        this.currentRoundBet = 0;
        this.phase = 'PRE_ROUND'; // PRE_ROUND, DEALING, BETTING, SHOWDOWN, END_ROUND
        this.lastRaiserIdx = -1;
        this.roundWinners = [];

        // Timer for automated flow
        this.flowTimer = 0;
        this.turnTimer = 0;
    }

    get activePlayers() {
        return this.players.filter(p => !p.folded && p.chips > 0); // Or chips=0 but allin (not handling allin sidepots fully for MVP)
    }

    startRound() {
        if (this.players[0].chips <= 0) {
            this.game.showStatus("GAME OVER");
            return;
        }

        this.deck.reset();
        this.pot = 0;
        this.currentRoundBet = 0;
        this.phase = 'DEALING';
        this.roundWinners = [];

        // Ante
        const ante = 5;
        this.players.forEach(p => {
            p.resetForRound();
            if (p.chips >= ante) {
                p.chips -= ante;
                this.pot += ante;
            } else {
                // Handle bust? MVP: just give them 500 reset or game over
                 if(p.chips <= 0) p.chips = 500; // Mercy rule for bots
                 else {
                     this.pot += p.chips;
                     p.chips = 0;
                 }
            }
        });

        // Deal
        setTimeout(() => {
            this.players.forEach(p => {
                p.hand = this.deck.deal();
            });
            this.startBetting();
        }, 1000);
    }

    startBetting() {
        this.phase = 'BETTING';
        this.turnIdx = (this.dealerIdx + 1) % 4;
        this.lastRaiserIdx = this.turnIdx;
        this.currentRoundBet = 0; // Reset for new round, but actually it's single round
        // Wait, standard betting: if no one bets, it's check.
        // Let's say big blind logic?
        // MVP: Simple flat betting. Everyone starts at 0 currentBet.

        // Ensure first player exists and is not folded
        this.advanceTurn(false);
    }

    advanceTurn(wasActionTaken = true) {
        // Check if betting round is over
        // Round ends if:
        // 1. Only 1 player left.
        // 2. All active players have matched the current bet AND we have gone full circle at least once (or checked around).

        const active = this.activePlayers;
        if (active.length === 1) {
            this.resolveShowdown(true); // Winner by default
            return;
        }

        // Logic check: have all active players acted and matched bet?
        // We need a flag for "has everyone acted?".
        // Simplified: use lastRaiserIdx. If turn comes back to lastRaiserIdx and they have matched, we are done.
        // But if lastRaiserIdx checks (0 bet), and everyone checks, we end when it returns to him.

        // Find next player
        let nextIdx = wasActionTaken ? (this.turnIdx + 1) % 4 : this.turnIdx;
        let loops = 0;
        while ((this.players[nextIdx].folded || this.players[nextIdx].chips === 0) && loops < 4) {
            nextIdx = (nextIdx + 1) % 4;
            loops++;
        }

        // If we wrapped around to the person who last raised (or started the checking round) AND everyone has matched
        if (wasActionTaken && nextIdx === this.lastRaiserIdx) {
            const allMatched = active.every(p => p.currentBet === this.currentRoundBet);
            if (allMatched) {
                this.resolveShowdown();
                return;
            }
        }

        this.turnIdx = nextIdx;
        this.turnTimer = 300; // 5 seconds for bot thinking / player timeout

        // Check for Human Turn or Bot Turn
        const currentPlayer = this.players[this.turnIdx];
        if (!currentPlayer.isHuman) {
            setTimeout(() => this.processBotTurn(currentPlayer), 1000 + Math.random() * 1000);
        } else {
            this.game.ui.updateControls(); // Enable buttons
        }
    }

    processBotTurn(bot) {
        if (this.phase !== 'BETTING') return;

        // Bot AI
        // 1. Analyze Visible Cards (Hero + Other Bots)
        // 2. Don't see OWN card.
        // 3. Simple heuristic:
        //    - Strength of visible cards.
        //    - If I see High Cards (A, K, Q) -> My chance is LOWER.
        //    - If I see Low Cards (2, 3, 4) -> My chance is HIGHER.

        const visibleCards = this.players.filter(p => p !== bot && !p.folded && p.hand).map(p => p.hand);

        let visibleStrength = 0;
        visibleCards.forEach(c => visibleStrength += c.value);
        const avgVisible = visibleCards.length > 0 ? visibleStrength / visibleCards.length : 7;

        // "Confidence" is inverse to visible strength.
        // Max rank 14.
        // If avg visible is 14 (All Aces), I am dead. Confidence 0.
        // If avg visible is 2, I am king. Confidence 1.

        let confidence = (15 - avgVisible) / 13; // 0.0 to 1.0

        // Adjust by current bet
        const toCall = this.currentRoundBet - bot.currentBet;
        const potOdds = toCall / (this.pot + toCall);

        // Random factor
        confidence += (Math.random() * 0.2 - 0.1);

        let action = 'fold';
        let raiseAmt = 0;

        if (confidence > 0.8) {
            action = 'raise';
            raiseAmt = this.minBet * randomInt(1, 3);
        } else if (confidence > 0.4 || toCall === 0) {
            action = 'call';
        } else {
            action = 'fold';
        }

        // Execute
        this.handleAction(bot.id, action, raiseAmt);
    }

    handleAction(playerId, actionType, amount = 0) {
        const p = this.players[playerId];
        if (this.turnIdx !== playerId || this.phase !== 'BETTING') return;

        p.action = actionType.toUpperCase();

        if (actionType === 'fold') {
            p.folded = true;
        } else if (actionType === 'call' || actionType === 'check') {
            const toCall = this.currentRoundBet - p.currentBet;
            const contribution = Math.min(p.chips, toCall);
            p.chips -= contribution;
            p.currentBet += contribution;
            this.pot += contribution;
        } else if (actionType === 'raise') {
            const toCall = this.currentRoundBet - p.currentBet;
            const raise = Math.max(amount, this.minBet);
            const total = toCall + raise;
            const contribution = Math.min(p.chips, total);

            p.chips -= contribution;
            p.currentBet += contribution;
            this.pot += contribution;

            this.currentRoundBet = p.currentBet;
            this.lastRaiserIdx = playerId; // Reset round end marker
        }

        this.game.playSound(actionType === 'fold' ? 'fold' : 'chip');
        this.advanceTurn();
    }

    resolveShowdown(defaultWinner = false) {
        this.phase = 'SHOWDOWN';

        const active = this.activePlayers;

        if (active.length === 0) return; // Should not happen

        let winners = [];

        if (defaultWinner) {
            winners = active;
        } else {
            // Compare hands
            let maxVal = -1;
            active.forEach(p => {
                if (p.hand.value > maxVal) maxVal = p.hand.value;
            });
            winners = active.filter(p => p.hand.value === maxVal);
        }

        const share = Math.floor(this.pot / winners.length);
        winners.forEach(w => {
            w.chips += share;
        });
        this.roundWinners = winners;

        // Bridge: Arcade Score
        if (this.players[0] === winners[0] || winners.includes(this.players[0])) {
             window.parent.postMessage({ type: 'arcade-score', score: this.players[0].chips }, '*');
        }

        setTimeout(() => this.endRound(), 4000);
    }

    endRound() {
        this.phase = 'PRE_ROUND';
        this.dealerIdx = (this.dealerIdx + 1) % 4;
        setTimeout(() => this.startRound(), 1000);
    }
}

class Renderer {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.scale = Math.min(this.canvas.width / CANVAS_WIDTH, this.canvas.height / CANVAS_HEIGHT);
        this.offsetX = (this.canvas.width - CANVAS_WIDTH * this.scale) / 2;
        this.offsetY = (this.canvas.height - CANVAS_HEIGHT * this.scale) / 2;
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, this.scale);

        // Background / Table
        ctx.fillStyle = COLORS.TABLE;
        ctx.beginPath();
        ctx.ellipse(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, 350, 250, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#3e2723'; // Wood
        ctx.stroke();

        // Pot
        ctx.fillStyle = COLORS.GOLD;
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`POT: ${this.game.server.pot}`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 20);
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.fillText(`Current Bet: ${this.game.server.currentRoundBet}`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 10);

        // Players
        // Positions: 0:Bottom, 1:Left, 2:Top, 3:Right
        const positions = [
            { x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT - 60, align: 'center' }, // Hero
            { x: 60, y: CANVAS_HEIGHT/2, align: 'left' },      // Left
            { x: CANVAS_WIDTH/2, y: 60, align: 'center' },     // Top
            { x: CANVAS_WIDTH - 60, y: CANVAS_HEIGHT/2, align: 'right' } // Right
        ];

        this.game.server.players.forEach((p, i) => {
            this.drawPlayer(ctx, p, positions[i], i === this.game.server.turnIdx);
        });

        // Dealer Button
        const dealerPos = positions[this.game.server.dealerIdx];
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(dealerPos.x + (dealerPos.align === 'left' ? 40 : dealerPos.align === 'right' ? -40 : 40), dealerPos.y + 40, 10, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px Arial';
        ctx.fillText('D', dealerPos.x + (dealerPos.align === 'left' ? 40 : dealerPos.align === 'right' ? -40 : 40), dealerPos.y + 44);

        // Status Overlay
        if (this.game.server.phase === 'SHOWDOWN') {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, CANVAS_HEIGHT/2 - 50, CANVAS_WIDTH, 100);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            let winnerText = "Winners: " + this.game.server.roundWinners.map(p => p.name).join(', ');
            ctx.fillText(winnerText, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 12);
        }

        ctx.restore();
    }

    drawPlayer(ctx, p, pos, isActive) {
        const w = 120;
        const h = 80;
        let x = pos.x;
        let y = pos.y;

        // Adjust anchor
        if (pos.align === 'center') x -= w/2;
        if (pos.align === 'right') x -= w;

        // Avatar Box
        ctx.fillStyle = isActive ? 'rgba(255, 215, 0, 0.3)' : COLORS.PLAYER_BG;
        if (p.folded) ctx.fillStyle = 'rgba(50,50,50,0.5)';
        ctx.fillRect(x, y - h/2, w, h);

        if (isActive) {
            ctx.strokeStyle = COLORS.ACTIVE_BORDER;
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y - h/2, w, h);
        }

        // Name & Chips
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, x + w/2, y - 5);
        ctx.font = '14px Arial';
        ctx.fillStyle = COLORS.CHIP;
        ctx.fillText(`$${p.chips}`, x + w/2, y + 15);

        // Action Text bubble
        if (p.action) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.fillText(p.action, x + w/2, y - h/2 - 10);
        }

        // Card
        // Local Player (0) sees BACK of card (unless showdown).
        // Others see FRONT of card.
        if (p.hand) {
            const cardX = x + w/2 - 20;
            const cardY = y + 25; // Overlap bottom

            const isHero = (p.id === 0);
            const isShowdown = (this.game.server.phase === 'SHOWDOWN');

            // Should we show face?
            // Hero: Only on Showdown.
            // Others: Always (unless Showdown reveals all, which is redundant but yes).
            const showFace = isShowdown || !isHero;

            this.drawCard(ctx, cardX, cardY, p.hand, showFace);
        }
    }

    drawCard(ctx, x, y, card, showFace) {
        const w = 40;
        const h = 60;

        ctx.fillStyle = showFace ? COLORS.CARD_FRONT : COLORS.CARD_BACK;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);

        if (showFace) {
            ctx.fillStyle = card.color;
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(card.rank, x + w/2, y + 20);
            ctx.font = '24px Arial';
            ctx.fillText(card.suit, x + w/2, y + 45);
        } else {
            // Pattern
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(x + w/2, y + h/2, 10, 0, Math.PI*2);
            ctx.fill();
        }
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.server = new LocalServer(this);
        this.renderer = new Renderer(this.canvas, this);
        this.ui = {
            btnFold: document.getElementById('btn-fold'),
            btnCheck: document.getElementById('btn-check'),
            btnRaise: document.getElementById('btn-raise'),
            raiseVal: document.getElementById('raise-val'),
            status: document.getElementById('status-message')
        };

        this.setupInputs();
        this.server.startRound();
        this.loop();

        // Signal ready
        window.parent.postMessage({ type: 'arcade-ready' }, '*');
    }

    setupInputs() {
        this.ui.btnFold.onclick = () => this.server.handleAction(0, 'fold');
        this.ui.btnCheck.onclick = () => this.server.handleAction(0, 'call'); // 'check' if bet==0, but generic handler
        this.ui.btnRaise.onclick = () => this.server.handleAction(0, 'raise', this.server.minBet * 2);
    }

    showStatus(msg) {
        this.ui.status.innerText = msg;
        this.ui.status.style.display = 'block';
        setTimeout(() => {
            this.ui.status.style.display = 'none';
        }, 2000);
    }

    playSound(type) {
        // Placeholder for AudioContext implementation
    }

    loop() {
        this.renderer.render();
        this.ui.updateControls = () => {
            const p = this.server.players[0];
            const myTurn = (this.server.turnIdx === 0 && this.server.phase === 'BETTING');

            this.ui.btnFold.disabled = !myTurn;
            this.ui.btnCheck.disabled = !myTurn;
            this.ui.btnRaise.disabled = !myTurn;

            if (myTurn) {
                const toCall = this.server.currentRoundBet - p.currentBet;
                this.ui.btnCheck.innerText = (toCall > 0) ? `CALL ${toCall}` : 'CHECK';
            }
        };

        // Constant UI update for simplicity
        if (this.ui.updateControls) this.ui.updateControls();

        requestAnimationFrame(() => this.loop());
    }
}

// Start
window.onload = () => {
    const game = new Game();
};
