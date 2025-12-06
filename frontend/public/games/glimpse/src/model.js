// Constants
export const SUITS = ['♠', '♥', '♣', '♦'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const RANK_VALUES = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

// Sigil Definitions
export const SIGILS = [
    { name: 'Neutral', expr: '1', val: 1.000 },
    { name: 'Root 2', expr: '√2', val: 1.414 },
    { name: 'Phi', expr: 'φ', val: 1.618 },
    { name: 'Root 3', expr: '√3', val: 1.732 },
    { name: 'Root 5', expr: '√5', val: 2.236 },
    { name: '1 + Root 2', expr: '1+√2', val: 2.414 },
    { name: '1 + Root 3', expr: '1+√3', val: 2.732 },
    { name: '2 Root 2', expr: '2√2', val: 2.828 },
    { name: '1 + Root 5', expr: '1+√5', val: 3.236 },
    { name: '2 + Root 3', expr: '2+√3', val: 3.732 }
];

export class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }

    reset() {
        this.cards = [];
        for (let suit of SUITS) {
            for (let rank of RANKS) {
                this.cards.push({ suit, rank, value: RANK_VALUES[rank] });
            }
        }
        this.shuffle();
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal(count) {
        return this.cards.splice(0, count);
    }
}

export class GlimpseModel {
    constructor(playerCount = 4) {
        this.playerCount = playerCount;
        this.deck = new Deck();
        this.players = []; // Array of objects { id, hand, sigil, score, penaltyPoints }
        this.currentTrick = []; // Array of { playerId, card, playedAt }
        this.trickHistory = [];
        this.turn = 0; // Player index who is currently acting
        this.leader = 0; // Player index who led the current trick
        this.heartsBroken = false;
        this.scores = new Array(playerCount).fill(0);
        this.round = 0;
        this.maxRounds = 3; // Game over after X rounds
        this.phase = 'setup'; // setup, playing, roundEnd, gameOver
        this.trickWinner = null;

        this.init();
    }

    init() {
        this.players = [];
        for (let i = 0; i < this.playerCount; i++) {
            this.players.push({
                id: i,
                isHuman: i === 0,
                hand: [],
                sigil: null,
                score: 0,
                penaltyPoints: 0,
                tricksWon: 0
            });
        }
    }

    startHand() {
        this.deck.reset();

        // Deal cards
        const cardsPerPlayer = 52 / this.playerCount;
        for (let p of this.players) {
            p.hand = this.deck.deal(cardsPerPlayer);
            p.hand.sort((a, b) => {
                if (a.suit !== b.suit) return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
                return a.value - b.value;
            });
            p.penaltyPoints = 0;
        }

        // Deal Sigils (No replacement)
        let availableSigils = [...SIGILS];
        // Shuffle sigils
        for (let i = availableSigils.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableSigils[i], availableSigils[j]] = [availableSigils[j], availableSigils[i]];
        }

        for (let i = 0; i < this.playerCount; i++) {
            this.players[i].sigil = availableSigils[i];
        }

        // Reset state
        this.heartsBroken = false;
        this.currentTrick = [];
        this.trickHistory = [];

        // Determine leader (Standard Hearts: 2♣ leads. If not dealt, random or p0)
        // For simplicity in this variant, Player 0 or winner of last trick leads.
        // If first round, Player with 2♣ leads.
        this.turn = this.findTwoOfClubs() || 0;
        this.leader = this.turn;
        this.phase = 'playing';

        return { type: 'handStarted', turn: this.turn };
    }

    findTwoOfClubs() {
        for (let i = 0; i < this.playerCount; i++) {
            if (this.players[i].hand.some(c => c.suit === '♣' && c.rank === '2')) {
                return i;
            }
        }
        return null;
    }

    canPlayCard(playerId, card) {
        const player = this.players[playerId];
        const hand = player.hand;

        // Must have card
        if (!hand.includes(card)) return false;

        // If leading
        if (this.currentTrick.length === 0) {
            // Cannot lead Hearts unless broken, unless hand only has Hearts
            if (card.suit === '♥' && !this.heartsBroken) {
                const hasNonHeart = hand.some(c => c.suit !== '♥');
                if (hasNonHeart) return false;
            }
            return true;
        }

        // Following suit
        const leadCard = this.currentTrick[0].card;
        const leadSuit = leadCard.suit;

        // If player has lead suit, must play it
        const hasLeadSuit = hand.some(c => c.suit === leadSuit);
        if (hasLeadSuit) {
            return card.suit === leadSuit;
        }

        // Otherwise can play anything (breaking hearts if played)
        return true;
    }

    playCard(playerId, card) {
        if (this.turn !== playerId) return { success: false, reason: 'Not your turn' };
        if (!this.canPlayCard(playerId, card)) return { success: false, reason: 'Invalid move' };

        // Remove from hand
        const player = this.players[playerId];
        player.hand = player.hand.filter(c => c !== card);

        // Add to trick
        this.currentTrick.push({ playerId, card });

        // Check if hearts broken
        if (card.suit === '♥') {
            this.heartsBroken = true;
        }

        // Advance turn
        this.turn = (this.turn + 1) % this.playerCount;

        // Check if trick complete
        if (this.currentTrick.length === this.playerCount) {
            return { success: true, trickComplete: true };
        }

        return { success: true, trickComplete: false };
    }

    calculateCombinedPower(card, sigil) {
        // Power = Rank * SigilValue
        let power = card.value * sigil.val;
        // Cap large multipliers (house rule balancing) -> keeping standard per user design for now,
        // user mentioned "Cap SigilValue to 4.0" if using big algebraics, but our max is 3.732, so no cap needed.

        // Round to 2 decimals
        return Math.round(power * 100) / 100;
    }

    resolveTrick() {
        const leadSuit = this.currentTrick[0].card.suit;

        let highestPower = -1;
        let winnerIndex = -1;

        // 1. Filter cards of lead suit
        // 2. Calculate power
        // 3. Find max

        for (let play of this.currentTrick) {
            if (play.card.suit !== leadSuit) continue; // Only lead suit can win (standard Hearts/Whist rules)

            const playerSigil = this.players[play.playerId].sigil;
            const power = this.calculateCombinedPower(play.card, playerSigil);

            // Tie-breaker: higher sigil value then higher rank (User spec)
            if (power > highestPower) {
                highestPower = power;
                winnerIndex = play.playerId;
            } else if (power === highestPower) {
                // Rare tie: higher sigil value wins
                const currentWinnerSigil = this.players[winnerIndex].sigil.val;
                if (playerSigil.val > currentWinnerSigil) {
                    winnerIndex = play.playerId;
                } else if (playerSigil.val === currentWinnerSigil) {
                    // Super rare: same sigil? (Impossible with no replacement)
                    // If same power and same sigil (implies same rank), stick with first played?
                    // With 1 deck, unique cards, same rank+suit impossible.
                }
            }
        }

        const winner = winnerIndex;
        this.trickWinner = winner;
        this.leader = winner;
        this.turn = winner;

        // Calculate penalties
        let trickPoints = 0;
        let hearts = 0;
        let qs = false;

        for (let play of this.currentTrick) {
            if (play.card.suit === '♥') {
                trickPoints += 1;
                hearts++;
            }
            if (play.card.suit === '♠' && play.card.rank === 'Q') {
                trickPoints += 13;
                qs = true;
            }
        }

        this.players[winner].penaltyPoints += trickPoints;
        this.players[winner].tricksWon++;

        // Log history
        this.trickHistory.push({
            trick: [...this.currentTrick],
            winner,
            points: trickPoints
        });

        // Reset trick
        this.currentTrick = [];

        // Check if hand ended
        if (this.players[0].hand.length === 0) {
            this.endHand();
            return { winner, handEnded: true };
        }

        return { winner, handEnded: false };
    }

    endHand() {
        // Handle Shooting the Moon
        for (let p of this.players) {
            // Check if captured all hearts (13) and QS (1) -> total 14 points bearing cards?
            // Actually Hearts has 13 hearts + QS (13 pts) = 26 pts total.
            // My implementation above counted points: Hearts = 1 pt each, QS = 13 pts.
            // So max points is 26.
            if (p.penaltyPoints === 26) {
                // Shoot the moon!
                p.penaltyPoints = 0;
                for (let other of this.players) {
                    if (other !== p) other.penaltyPoints += 26;
                }
                // OR subtract 26. Using option A (others get +26) as default.
                break;
            }
        }

        // Add to global score
        for (let p of this.players) {
            p.score += p.penaltyPoints;
        }

        this.round++;
        if (this.round >= this.maxRounds) {
            this.phase = 'gameOver';
        } else {
            this.phase = 'roundEnd';
        }
    }
}
