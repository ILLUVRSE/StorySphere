// Bridge to the Arcade platform
export const ArcadeBridge = {
    init() {
        window.parent.postMessage({ type: 'arcade-ready' }, '*');
    },

    submitScore(score, meta = {}) {
        window.parent.postMessage({
            type: 'arcade-score',
            score: Math.floor(score),
            meta
        }, '*');

        // Local fallback
        try {
            const current = localStorage.getItem('spy-grid-high-score') || 0;
            if (score > current) {
                localStorage.setItem('spy-grid-high-score', score);
            }
        } catch(e) { console.warn('Local storage fallback failed', e); }
    }
};
