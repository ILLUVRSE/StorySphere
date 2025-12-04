export const ArcadeBridge = {
    init: () => {
        if (window.parent) {
            window.parent.postMessage({ type: 'arcade-ready' }, '*');
        }
        console.log("ArcadeBridge: Ready");
    },

    /**
     * Submit score to the parent window/leaderboard.
     * @param {Object} matchData - The match data.
     * @param {number} matchData.goalsFor
     * @param {number} matchData.goalsAgainst
     * @param {number} matchData.timeMs
     * @param {boolean} matchData.winner - True if the player won.
     * @param {string} matchData.seed - The seed used for the match.
     */
    submitScore: (matchData) => {
        // Score Formula: (winner ? 1_000_000 : 0) + (goalsFor - goalsAgainst) * 1000 - timeMs
        // Higher is better.
        const winBonus = matchData.winner ? 1000000 : 0;
        const goalDiff = (matchData.goalsFor - matchData.goalsAgainst) * 1000;
        const score = Math.floor(winBonus + goalDiff - matchData.timeMs);

        const payload = {
            game: 'pixel-puck',
            score: score,
            meta: {
                goalsFor: matchData.goalsFor,
                goalsAgainst: matchData.goalsAgainst,
                timeMs: matchData.timeMs,
                winner: matchData.winner,
                seed: matchData.seed
            }
        };

        if (window.parent) {
            window.parent.postMessage({
                type: 'arcade-score',
                score: score,
                meta: payload.meta
            }, '*');
        }

        // Local storage fallback
        try {
            const key = `pixel-puck-last-score`;
            localStorage.setItem(key, JSON.stringify(payload));
            console.log("ArcadeBridge: Score saved locally", payload);
        } catch (e) {
            console.warn("ArcadeBridge: LocalStorage error", e);
        }
    }
};
