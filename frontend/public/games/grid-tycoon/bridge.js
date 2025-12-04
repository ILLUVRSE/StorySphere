// bridge.js

export class Bridge {
  constructor() {
    this.ready = false;
  }

  init() {
    // Listen for messages if needed (though mostly we send)
    window.addEventListener('message', (event) => {
      // Handle incoming messages if any
    });

    // Notify parent that arcade is ready
    if (window.parent) {
      window.parent.postMessage({ type: 'arcade-ready' }, '*');
    }
    this.ready = true;
    console.log('[Bridge] Arcade ready signal sent.');
  }

  sendScore(score, meta = {}) {
    const payload = {
      type: 'arcade-score',
      game: 'grid-tycoon',
      score: Math.floor(score),
      meta
    };

    console.log('[Bridge] Sending score:', payload);

    if (window.parent) {
      window.parent.postMessage(payload, '*');
    }

    // Fallback: LocalStorage for offline/dev
    try {
      const history = JSON.parse(localStorage.getItem('grid-tycoon-scores') || '[]');
      history.push({ date: new Date().toISOString(), score, meta });
      localStorage.setItem('grid-tycoon-scores', JSON.stringify(history));
    } catch (e) {
      console.warn('[Bridge] LocalStorage unavailable:', e);
    }
  }
}
