export class Bridge {
    constructor() {
        this.origin = '*'; // In prod this should be stricter
    }

    sendReady(width, height) {
        window.parent.postMessage({
            type: 'arcade-ready',
            width: width,
            height: height
        }, this.origin);
    }

    sendScore(score, seed, duration, metadata = {}) {
        window.parent.postMessage({
            type: 'arcade-score',
            score: Math.floor(score),
            seed: seed,
            time_ms: Math.floor(duration),
            metadata: metadata
        }, this.origin);

        console.log(`[Bridge] Sent Score: ${score} (Seed: ${seed})`);
    }
}
