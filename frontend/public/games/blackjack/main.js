import { Deck, calculateHandValue, isBlackjack, isBusted } from './engine.js';
import { Renderer } from './renderer.js';
import { InputController } from './input.js';
import { AudioController } from './sfx.js';
import { Bridge } from './bridge.js';
import { mulberry32, cyrb128 } from './utils.js';

const STATE = {
    INIT: 'INIT',
    BETTING: 'BETTING',
    DEALING: 'DEALING',
    PLAYER_TURN: 'PLAYER_TURN',
    DEALER_TURN: 'DEALER_TURN',
    RESOLVE: 'RESOLVE',
    GAME_OVER: 'GAME_OVER'
};

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.renderer = new Renderer(this.canvas);
        this.audio = new AudioController();
        this.bridge = new Bridge();

        // Game State
        this.state = STATE.INIT;
        this.chips = 1000;
        this.bet = 0;
        this.deck = null;
        this.playerHand = [];
        this.dealerHand = [];
        this.message = "Tap to Start";

        // Input
        this.input = new InputController(this.canvas, (pos) => this.handleInput(pos));

        // Loop
        this.lastTime = 0;
        requestAnimationFrame((t) => this.loop(t));

        this.init();
    }

    init() {
        // Parse seed
        const urlParams = new URLSearchParams(window.location.search);
        const seedStr = urlParams.get('seed') || new Date().toISOString().split('T')[0]; // Daily default
        const seedHash = cyrb128(seedStr);
        const rand = mulberry32(seedHash[0]);

        this.deck = new Deck(rand);
        this.state = STATE.BETTING;
        this.message = "Place Your Bet";

        this.bridge.sendReady();
    }

    loop(timestamp) {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        // Dealer AI logic could be ticked here if we wanted delays
    }

    draw() {
        this.renderer.clear();

        if (this.state === STATE.BETTING) {
            this.renderer.drawHUD(this.state, this.chips, this.bet, "Place Bet");
            this.renderer.drawControls(this.state);
        } else {
            this.renderer.drawHUD(this.state, this.chips, this.bet, this.message);

            // Draw Hands
            this.renderer.drawHand(this.dealerHand, this.canvas.width/2, this.renderer.layout.dealerY);
            this.renderer.drawHand(this.playerHand, this.canvas.width/2, this.renderer.layout.playerY);

            // Hand Values
            // Player
            if (this.playerHand.length > 0) {
                 const pVal = calculateHandValue(this.playerHand);
                 this.renderer.ctx.fillStyle = '#fff';
                 this.renderer.ctx.fillText(pVal, this.canvas.width/2, this.renderer.layout.playerY + 110);
            }
            // Dealer (hide if card down)
            if (this.dealerHand.length > 0) {
                let dVal = "?";
                if (this.dealerHand.every(c => c.faceUp)) {
                    dVal = calculateHandValue(this.dealerHand);
                }
                this.renderer.ctx.fillText(dVal, this.canvas.width/2, this.renderer.layout.dealerY + 110);
            }

            this.renderer.drawControls(this.state, this.canDouble());
        }
    }

    canDouble() {
        return this.state === STATE.PLAYER_TURN && this.playerHand.length === 2 && this.chips >= this.bet;
    }

    handleInput(pos) {
        this.audio.ensureContext();

        // Button Hit Tests
        const y = this.renderer.layout.uiY;
        const btnW = 100;
        const btnH = 40;
        const gap = 20;

        if (this.state === STATE.BETTING) {
            // BET 10 Button
            const bx = this.canvas.width/2 - btnW/2;
            if (this.hitTest(pos, bx, y, btnW, btnH)) {
                this.placeBet(10);
            }
        } else if (this.state === STATE.PLAYER_TURN) {
            let x = this.canvas.width/2 - btnW - gap;
            // Hit
            if (this.hitTest(pos, x, y, btnW, btnH)) {
                this.hit();
            }
            x += btnW + gap;
            // Stand
            if (this.hitTest(pos, x, y, btnW, btnH)) {
                this.stand();
            }
            // Double
            if (this.canDouble()) {
                x += btnW + gap;
                if (this.hitTest(pos, x, y, btnW, btnH)) {
                    this.doubleDown();
                }
            }
        } else if (this.state === STATE.RESOLVE) {
             const bx = this.canvas.width/2 - btnW/2;
             if (this.hitTest(pos, bx, y, btnW, btnH)) {
                 this.nextHand();
             }
        } else if (this.state === STATE.GAME_OVER) {
             // Maybe restart?
        }
    }

    hitTest(pos, x, y, w, h) {
        return pos.x >= x && pos.x <= x + w && pos.y >= y && pos.y <= y + h;
    }

    placeBet(amount) {
        if (this.chips < amount) {
            // Not enough chips
            if (this.chips > 0) amount = this.chips; // All in
            else return; // Broke
        }
        this.bet = amount;
        this.chips -= amount;
        this.startHand();
    }

    async startHand() {
        this.state = STATE.DEALING;
        this.message = "";
        this.playerHand = [];
        this.dealerHand = [];

        if (this.deck.cards.length < 10) {
            this.deck.reset();
            this.deck.shuffle();
        }

        // Deal initial cards
        this.audio.playDeal();
        this.playerHand.push(this.deck.draw());
        await this.wait(200);
        this.dealerHand.push(this.deck.draw());
        await this.wait(200);
        this.playerHand.push(this.deck.draw());
        await this.wait(200);
        const hiddenCard = this.deck.draw();
        hiddenCard.faceUp = false;
        this.dealerHand.push(hiddenCard);

        // Check for instant blackjack
        if (isBlackjack(this.playerHand)) {
            // Check dealer blackjack (reveal first)
            this.dealerHand[1].faceUp = true;
            if (isBlackjack(this.dealerHand)) {
                this.resolve('PUSH');
            } else {
                this.resolve('BLACKJACK');
            }
        } else {
            this.state = STATE.PLAYER_TURN;
        }
    }

    hit() {
        this.playerHand.push(this.deck.draw());
        this.audio.playDeal();
        if (isBusted(this.playerHand)) {
            this.resolve('BUST');
        }
    }

    stand() {
        this.state = STATE.DEALER_TURN;
        this.playDealer();
    }

    doubleDown() {
        this.chips -= this.bet;
        this.bet *= 2;
        this.playerHand.push(this.deck.draw());
        this.audio.playDeal();

        if (isBusted(this.playerHand)) {
            this.resolve('BUST');
        } else {
            this.stand();
        }
    }

    async playDealer() {
        // Reveal hole card
        this.dealerHand[1].faceUp = true;
        await this.wait(500);

        while (calculateHandValue(this.dealerHand) < 17) {
            this.dealerHand.push(this.deck.draw());
            this.audio.playDeal();
            await this.wait(500);
        }

        const dVal = calculateHandValue(this.dealerHand);
        const pVal = calculateHandValue(this.playerHand);

        if (dVal > 21) {
            this.resolve('WIN');
        } else if (dVal > pVal) {
            this.resolve('LOSE');
        } else if (dVal < pVal) {
            this.resolve('WIN');
        } else {
            this.resolve('PUSH');
        }
    }

    resolve(result) {
        this.state = STATE.RESOLVE;
        if (result === 'BLACKJACK') {
            this.message = "BLACKJACK!";
            this.chips += Math.floor(this.bet * 2.5);
            this.audio.playWin();
        } else if (result === 'WIN') {
            this.message = "YOU WIN!";
            this.chips += this.bet * 2;
            this.audio.playWin();
        } else if (result === 'PUSH') {
            this.message = "PUSH";
            this.chips += this.bet;
            this.audio.playPush();
        } else if (result === 'LOSE') {
            this.message = "DEALER WINS";
            this.audio.playLose();
        } else if (result === 'BUST') {
            this.message = "BUST!";
            this.audio.playLose();
        }

        this.bet = 0;

        // Send score update
        this.bridge.sendScore({
            score: this.chips,
            meta: {
                finalChips: this.chips,
                handsPlayed: 0 // TODO: Track hands
            }
        });

        if (this.chips <= 0) {
            this.message = "GAME OVER";
            this.state = STATE.GAME_OVER;
        }
    }

    nextHand() {
        if (this.chips <= 0) return;
        this.state = STATE.BETTING;
        this.message = "Place Bet";
        this.playerHand = [];
        this.dealerHand = [];
    }

    wait(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}

// Start
window.onload = () => {
    new Game();
};
