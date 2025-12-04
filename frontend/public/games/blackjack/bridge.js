export class Bridge {
    constructor() {
        this.parent = window.parent;
    }

    sendReady() {
        this.parent.postMessage({ type: 'arcade-ready' }, '*');
    }

    sendScore(scoreObj) {
        // { score: number, meta: object }
        this.parent.postMessage({ type: 'arcade-score', ...scoreObj }, '*');
    }
}
