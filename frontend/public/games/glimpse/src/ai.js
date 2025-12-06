import { SUITS, SIGILS } from './model.js';

export class BotAI {
    constructor(playerId, model) {
        this.id = playerId;
        this.model = model;
    }

    // Helper: Estimate own sigil value (Mean of unseen sigils)
    estimateOwnSigil() {
        const visibleSigils = this.model.players
            .filter(p => p.id !== this.id && p.sigil)
            .map(p => p.sigil.name);

        const unseenSigils = SIGILS.filter(s => !visibleSigils.includes(s.name));

        if (unseenSigils.length === 0) return 1.0; // Fallback

        const sum = unseenSigils.reduce((acc, s) => acc + s.val, 0);
        return sum / unseenSigils.length;
    }

    chooseCard() {
        const hand = this.model.players[this.id].hand;
        const validMoves = hand.filter(c => this.model.canPlayCard(this.id, c));

        if (validMoves.length === 0) return null; // Should not happen
        if (validMoves.length === 1) return validMoves[0];

        // Context
        const isLeader = this.model.currentTrick.length === 0;
        const myEstimatedSigilVal = this.estimateOwnSigil();

        if (isLeader) {
            return this.chooseLeadCard(validMoves, myEstimatedSigilVal);
        } else {
            return this.chooseFollowCard(validMoves, myEstimatedSigilVal);
        }
    }

    chooseLeadCard(validMoves, mySigilVal) {
        // Strategy: Lead low cards to drain opponents, or safe suits.
        // Avoid leading Spades if holding QS and risky?
        // Simple MVP: Sort by value and play lowest.

        // Sort by value ascending
        validMoves.sort((a, b) => a.value - b.value);
        return validMoves[0];
    }

    chooseFollowCard(validMoves, mySigilVal) {
        const leadCard = this.model.currentTrick[0].card;
        const leadSuit = leadCard.suit;
        const followingSuit = validMoves[0].suit === leadSuit;

        // Calculate current winner stats
        let currentHighestPower = -1;
        let currentWinnerId = -1;

        for (let play of this.model.currentTrick) {
            if (play.card.suit !== leadSuit) continue;
            const pSigil = this.model.players[play.playerId].sigil.val;
            const pPower = play.card.value * pSigil;
            if (pPower > currentHighestPower) {
                currentHighestPower = pPower;
                currentWinnerId = play.playerId;
            }
        }

        if (followingSuit) {
            // Trying to duck? (Standard Hearts strategy: avoid winning unless shooting moon)
            // We want to play the highest card that is LOWER than the current winner,
            // OR if we must win, play the lowest winner.
            // AND watch out for sigil multipliers!

            // Calculate my potential powers
            const movesWithPower = validMoves.map(card => {
                return {
                    card,
                    power: card.value * mySigilVal
                };
            });

            // Sort by power descending
            movesWithPower.sort((a, b) => b.power - a.power);

            // Find any card that loses to current highest
            const safeCards = movesWithPower.filter(m => m.power < currentHighestPower);

            if (safeCards.length > 0) {
                // Play the highest safe card (standard defensive play)
                return safeCards[0].card;
            } else {
                // All my cards beat the current winner (or I am first follower and have big cards)
                // Play lowest power to minimize risk? Or highest to secure lead if forced?
                // Usually play lowest card to minimize "winning margin" or save high cards?
                // Actually in Hearts, if you MUST win, you play the highest to drain others?
                // Let's stick to: Play lowest power card if we are forced to be high.
                return movesWithPower[movesWithPower.length - 1].card;
            }

        } else {
            // Sloughing / Discarding
            // Dump high penalty cards (QS, Hearts) or high rank cards
            const qs = validMoves.find(c => c.suit === '♠' && c.rank === 'Q');
            if (qs) return qs;

            const hearts = validMoves.filter(c => c.suit === '♥');
            if (hearts.length > 0) {
                // Dump highest heart
                hearts.sort((a, b) => b.value - a.value);
                return hearts[0];
            }

            // Otherwise dump highest value card
            validMoves.sort((a, b) => b.value - a.value);
            return validMoves[0];
        }
    }
}
