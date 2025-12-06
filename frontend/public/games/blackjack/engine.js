import { mulberry32 } from './utils.js';

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.faceUp = true;
        // Animation props
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
    }

    get value() {
        if (['J', 'Q', 'K'].includes(this.rank)) return 10;
        if (this.rank === 'A') return 11;
        return parseInt(this.rank);
    }
}

export class Deck {
    constructor(seedFn) {
        this.cards = [];
        this.rand = seedFn;
        this.reset();
        this.shuffle();
    }

    reset() {
        this.cards = [];
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                this.cards.push(new Card(suit, rank));
            }
        }
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(this.rand() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    draw() {
        return this.cards.pop();
    }
}

export function calculateHandValue(cards) {
    let total = 0;
    let aces = 0;
    for (const c of cards) {
        if (!c.faceUp) continue;
        if (c.rank === 'A') {
            aces++;
            total += 1;
        } else if (['J', 'Q', 'K'].includes(c.rank)) {
            total += 10;
        } else {
            total += parseInt(c.rank);
        }
    }

    // Upgrade Aces
    for (let i = 0; i < aces; i++) {
        if (total + 10 <= 21) {
            total += 10;
        }
    }
    return total;
}

export function isBlackjack(cards) {
    if (cards.length !== 2) return false;
    return calculateHandValue(cards) === 21;
}

export function isBusted(cards) {
    return calculateHandValue(cards) > 21;
}

export function canSplit(cards) {
    if (cards.length !== 2) return false;
    // Allow splitting any 10-value cards (e.g. K & J)
    return cards[0].value === cards[1].value;
}
