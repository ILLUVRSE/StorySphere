import { mulberry32 } from './utils.js';

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.faceUp = true;
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
        this.rand = seedFn; // Expected to be a mulberry32 instance or similar
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
        if (!c.faceUp) continue; // Only count face-up cards for value logic visible
        if (c.rank === 'A') {
            aces++;
            total += 1; // Count as 1 initially
        } else if (['J', 'Q', 'K'].includes(c.rank)) {
            total += 10;
        } else {
            total += parseInt(c.rank);
        }
    }

    // Upgrade Aces from 1 to 11 if possible
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

export function isSoft17(cards) {
    // Soft 17 means total is 17 and one Ace is counted as 11.
    // Logic: Calculate value. If 17, check if we used an Ace as 11.
    // Simple check: if total is 17 and we have an Ace, and treating that Ace as 1 would make it 7...
    // Actually, calculateHandValue does the max possible.
    // If calculateHandValue is 17, we need to know if it's "soft".
    // It's soft if we can subtract 10 and still have a valid hand (value 7).
    // But wait, "Soft 17" specifically means A+6 (or A+3+3 etc).

    let val = calculateHandValue(cards);
    if (val !== 17) return false;

    // Check if it's soft:
    // A hand is soft if it contains an Ace counted as 11.
    // If we have an Ace, and the total is 17, is it soft?
    // If we count all Aces as 1, what is the total?
    let rawTotal = 0;
    let hasAce = false;
    for (const c of cards) {
        if (c.rank === 'A') { hasAce = true; rawTotal += 1; }
        else if (['J', 'Q', 'K'].includes(c.rank)) rawTotal += 10;
        else rawTotal += parseInt(c.rank);
    }

    // If rawTotal is <= 7 and we have an Ace, we added 10 to reach 17. So it is soft.
    return hasAce && rawTotal <= 11; // Wait. Ace=1. If rawTotal is 7, 7+10=17. Correct.
    // If rawTotal is 17 (e.g. 10, 6, A), then 10+6+1 = 17. We can't add 10 (27). So it's hard 17.
}
