import { Deck, calculateHandValue, isBlackjack, isBusted, canSplit } from './engine.js';
import { Renderer } from './renderer.js';
import { InputController } from './input.js';
import { AudioController } from './sfx.js';
import { Bridge } from './bridge.js';
import { mulberry32, cyrb128, TweenManager, Easing } from './utils.js';

const STATE = {
    INIT: 'INIT',
    BETTING: 'BETTING',
    DEALING: 'DEALING',
    INSURANCE: 'INSURANCE',
    PLAYER_TURN: 'PLAYER_TURN',
    DEALER_TURN: 'DEALER_TURN',
    RESOLVE: 'RESOLVE',
    GAME_OVER: 'GAME_OVER'
};

const CHIP_VALUES = [10, 50, 100, 500];

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.renderer = new Renderer(this.canvas);
        this.audio = new AudioController();
        this.bridge = new Bridge();
        this.tweens = new TweenManager();

        // Game State
        this.state = STATE.INIT;
        this.chips = 1000;
        this.currentBet = 0;

        // Multi-hand support
        this.deck = null;
        this.hands = []; // Array of { cards: [], bet: 0, status: 'PLAYING', result: null, id: int }
        this.currentHandIndex = 0;

        this.dealerHand = [];
        this.insuranceBet = 0;
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
        const seedStr = urlParams.get('seed') || new Date().toISOString().split('T')[0];
        const seedHash = cyrb128(seedStr);
        const rand = mulberry32(seedHash[0]);

        this.deck = new Deck(rand);
        this.state = STATE.BETTING;
        this.message = "Place Your Bet";

        // Initial setup
        this.resetHands();

        this.bridge.sendReady();
    }

    resetHands() {
        this.hands = [];
        this.dealerHand = [];
        this.currentHandIndex = 0;
        this.insuranceBet = 0;
        this.currentBet = 0;
    }

    loop(timestamp) {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        this.tweens.update(dt);
    }

    draw() {
        this.renderer.clear();

        // Pass relevant data to renderer
        const context = {
            state: this.state,
            chips: this.chips,
            bet: this.currentBet, // Current accum bet during betting phase
            message: this.message,
            hands: this.hands,
            dealerHand: this.dealerHand,
            currentHandIndex: this.currentHandIndex,
            insuranceBet: this.insuranceBet
        };

        if (this.state === STATE.BETTING) {
            this.renderer.drawHUD(context);
            this.renderer.drawBettingControls(CHIP_VALUES, this.chips, this.currentBet);
        } else {
            this.renderer.drawHUD(context);
            this.renderer.drawTable(context);

            const activeHand = this.hands[this.currentHandIndex];
            // Determine available actions
            let actions = {
                canHit: false,
                canStand: false,
                canDouble: false,
                canSplit: false,
                canInsurance: this.state === STATE.INSURANCE
            };

            if (this.state === STATE.PLAYER_TURN && activeHand) {
                actions.canHit = true;
                actions.canStand = true;
                actions.canDouble = activeHand.cards.length === 2 && this.chips >= activeHand.bet;
                actions.canSplit = canSplit(activeHand.cards) && this.chips >= activeHand.bet;
            }

            this.renderer.drawControls(this.state, actions);
        }
    }

    handleInput(pos) {
        this.audio.ensureContext();

        // Delegate to specific handlers based on state
        if (this.state === STATE.BETTING) {
            this.handleBettingInput(pos);
        } else if (this.state === STATE.PLAYER_TURN) {
            this.handlePlayerInput(pos);
        } else if (this.state === STATE.INSURANCE) {
            this.handleInsuranceInput(pos);
        } else if (this.state === STATE.RESOLVE || this.state === STATE.GAME_OVER) {
            this.handleResolveInput(pos);
        }
    }

    handleBettingInput(pos) {
        // Chip buttons
        const chipAction = this.renderer.hitTestChips(pos, CHIP_VALUES);
        if (chipAction) {
            if (chipAction === 'clear') {
                this.chips += this.currentBet;
                this.currentBet = 0;
            } else if (chipAction === 'deal') {
                if (this.currentBet > 0) this.startRound();
            } else {
                // chip value
                if (this.chips >= chipAction) {
                    this.chips -= chipAction;
                    this.currentBet += chipAction;
                }
            }
        }
    }

    handlePlayerInput(pos) {
        const action = this.renderer.hitTestControls(pos);
        if (!action) return;

        const hand = this.hands[this.currentHandIndex];

        if (action === 'HIT') this.hit(hand);
        if (action === 'STAND') this.stand(hand);
        if (action === 'DOUBLE') this.doubleDown(hand);
        if (action === 'SPLIT') this.splitHand(hand);
    }

    handleInsuranceInput(pos) {
        const action = this.renderer.hitTestControls(pos); // Should return YES/NO
        if (action === 'YES') {
            this.buyInsurance();
        } else if (action === 'NO') {
            this.declineInsurance();
        }
    }

    handleResolveInput(pos) {
        const action = this.renderer.hitTestControls(pos); // Next Hand
        if (action === 'NEXT') {
            this.nextHand();
        }
    }

    async startRound() {
        this.state = STATE.DEALING;
        this.message = "";

        // Initialize first hand
        this.hands = [{
            cards: [],
            bet: this.currentBet,
            status: 'PLAYING',
            id: 1
        }];
        this.currentHandIndex = 0;
        this.currentBet = 0; // Reset accumulator

        if (this.deck.cards.length < 15) {
            this.deck.reset();
            this.deck.shuffle();
        }

        // Deal sequence
        await this.dealCard(this.hands[0], true);
        await this.dealCardToDealer(true);
        await this.dealCard(this.hands[0], true);
        await this.dealCardToDealer(false); // Hole card

        // Check Insurance
        const dealerUpCard = this.dealerHand[0];
        if (dealerUpCard.rank === 'A' && this.chips >= Math.floor(this.hands[0].bet / 2)) {
            this.state = STATE.INSURANCE;
            this.message = "Insurance?";
            return;
        }

        // Check Dealer Blackjack (Peek)
        if (isBlackjack(this.dealerHand)) {
            // Reveal hole card immediately if player doesn't have blackjack (or even if they do)
            this.dealerHand[1].faceUp = true;
            this.resolveRound();
        } else {
             // Check Player Blackjack
            if (isBlackjack(this.hands[0].cards)) {
                this.hands[0].status = 'BLACKJACK';
                this.resolveRound();
            } else {
                this.state = STATE.PLAYER_TURN;
            }
        }
    }

    async dealCard(hand, faceUp = true) {
        const card = this.deck.draw();
        card.faceUp = faceUp;

        // Setup Animation (handled by renderer if we set props)
        // For now, assume renderer uses card.x/y
        // We'll simulate delay here
        this.audio.playDeal();
        hand.cards.push(card);
        await this.wait(300);
    }

    async dealCardToDealer(faceUp = true) {
        const card = this.deck.draw();
        card.faceUp = faceUp;
        this.audio.playDeal();
        this.dealerHand.push(card);
        await this.wait(300);
    }

    // --- Actions ---

    hit(hand) {
        this.dealCard(hand).then(() => {
            if (isBusted(hand.cards)) {
                hand.status = 'BUST';
                this.message = "Bust!";
                this.advanceHand();
            }
        });
    }

    stand(hand) {
        hand.status = 'STAND';
        this.advanceHand();
    }

    async doubleDown(hand) {
        if (this.chips < hand.bet) return; // Should not happen due to button check
        this.chips -= hand.bet;
        hand.bet *= 2;

        await this.dealCard(hand);

        if (isBusted(hand.cards)) {
            hand.status = 'BUST';
        } else {
            hand.status = 'STAND';
        }
        this.advanceHand();
    }

    async splitHand(hand) {
        // Validation handled by button visibility
        this.chips -= hand.bet;

        const cardToMove = hand.cards.pop();
        const newHand = {
            cards: [cardToMove],
            bet: hand.bet,
            status: 'PLAYING',
            id: this.hands.length + 1
        };

        // Insert new hand after current hand
        this.hands.splice(this.currentHandIndex + 1, 0, newHand);

        // Deal 1 card to current hand
        await this.dealCard(hand);

        // If split aces, usually just one card.
        // Simplified rule: Allow play on split aces for now unless strict rules required.
        // Standard Arcade: Allow normal play.

        // Note: New hand (index+1) needs a card too, but we deal that when we get to it?
        // OR dealing logic usually fills both immediately?
        // Standard: Deal to Hand 1. Play Hand 1. Then Deal to Hand 2. Play Hand 2.

        // Check for Blackjack on the split hand (usually counts as 21, not BJ, but here we treat simple)
    }

    buyInsurance() {
        const bet = Math.floor(this.hands[0].bet / 2);
        this.insuranceBet = bet;
        this.chips -= bet;
        this.resolveInsurance();
    }

    declineInsurance() {
        this.resolveInsurance();
    }

    async resolveInsurance() {
        // Check dealer hole card for 10/Face
        if (isBlackjack(this.dealerHand)) {
            this.dealerHand[1].faceUp = true;
            this.state = STATE.RESOLVE;

            // Insurance Pays 2:1
            if (this.insuranceBet > 0) {
                this.chips += this.insuranceBet * 3; // Return bet + 2x winnings
                this.message = "Insurance Pays!";
            } else {
                this.message = "Dealer Blackjack";
            }
            // Main hand loses (unless BJ push)
            this.resolveRound();
        } else {
            // Insurance loses
            this.message = "Nobody Home";
            await this.wait(500);
            this.state = STATE.PLAYER_TURN;
        }
    }

    advanceHand() {
        // Move to next hand if playing multiple
        if (this.currentHandIndex < this.hands.length - 1) {
            this.currentHandIndex++;
            const hand = this.hands[this.currentHandIndex];

            // If this is a split hand that needs a second card (from the split logic earlier)
            if (hand.cards.length === 1) {
                this.dealCard(hand).then(() => {
                    this.state = STATE.PLAYER_TURN;
                });
            } else {
                this.state = STATE.PLAYER_TURN;
            }
        } else {
            // All hands done
            this.state = STATE.DEALER_TURN;
            this.playDealer();
        }
    }

    async playDealer() {
        // Skip dealer turn if all hands busted
        const allBusted = this.hands.every(h => h.status === 'BUST');
        if (allBusted) {
            this.resolveRound();
            return;
        }

        this.dealerHand[1].faceUp = true;
        await this.wait(500);

        while (calculateHandValue(this.dealerHand) < 17) {
            await this.dealCardToDealer();
        }

        this.resolveRound();
    }

    resolveRound() {
        this.state = STATE.RESOLVE;
        const dVal = calculateHandValue(this.dealerHand);
        const dealerBust = dVal > 21;
        const dealerBJ = isBlackjack(this.dealerHand);

        let totalWin = 0;

        this.hands.forEach(hand => {
            const pVal = calculateHandValue(hand.cards);
            const playerBJ = isBlackjack(hand.cards) && hand.cards.length === 2 && this.hands.length === 1;
            // Note: Split hands usually don't count as natural Blackjack. Length check implies splits.
            // Actually, if we split, length is 2, but hands.length > 1.

            if (hand.status === 'BUST') {
                hand.result = 'LOSE';
            } else if (dealerBJ) {
                if (playerBJ) {
                    hand.result = 'PUSH';
                    this.chips += hand.bet;
                } else {
                    hand.result = 'LOSE';
                }
            } else if (playerBJ) {
                // Dealer no BJ
                hand.result = 'BLACKJACK';
                this.chips += Math.floor(hand.bet * 2.5);
                totalWin += Math.floor(hand.bet * 2.5);
            } else if (dealerBust) {
                hand.result = 'WIN';
                this.chips += hand.bet * 2;
                totalWin += hand.bet * 2;
            } else if (pVal > dVal) {
                hand.result = 'WIN';
                this.chips += hand.bet * 2;
                totalWin += hand.bet * 2;
            } else if (pVal === dVal) {
                hand.result = 'PUSH';
                this.chips += hand.bet;
            } else {
                hand.result = 'LOSE';
            }
        });

        if (totalWin > 0) this.audio.playWin();
        else if (this.hands.some(h => h.result === 'PUSH')) this.audio.playPush();
        else this.audio.playLose();

        // Bridge score
        this.bridge.sendScore({
            score: this.chips,
            meta: { finalChips: this.chips }
        });

        if (this.chips <= 0) {
            this.message = "GAME OVER";
            this.state = STATE.GAME_OVER;
        } else {
            this.message = "Round Over";
        }
    }

    nextHand() {
        if (this.chips <= 0) return;
        this.state = STATE.BETTING;
        this.message = "Place Bet";
        this.resetHands();
    }

    wait(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}

window.onload = () => {
    new Game();
};
