// Bridge to Parent Application

window.Bridge = {
  init: function() {
    console.log("[Rhythm Blocks] Bridge initialized");
    window.parent.postMessage({ type: 'arcade-ready', game: 'rhythm-blocks' }, '*');
  },

  submitScore: function(score, meta) {
    const finalScore = Math.round(score);
    const message = {
      type: 'arcade-score',
      game: 'rhythm-blocks',
      score: finalScore,
      meta: meta || {}
    };

    console.log("[Rhythm Blocks] Submitting score:", message);
    window.parent.postMessage(message, '*');

    // Try API POST
    fetch('/api/v1/arcade/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game: 'rhythm-blocks',
        score: finalScore,
        meta: meta
      })
    }).catch(err => console.warn("API Score Post Failed", err));

    // Local fallback for offline/testing
    try {
      const history = JSON.parse(localStorage.getItem('rhythm-blocks-scores') || '[]');
      history.push({
        score: Math.round(score),
        date: new Date().toISOString(),
        meta: meta
      });
      history.sort((a, b) => b.score - a.score);
      localStorage.setItem('rhythm-blocks-scores', JSON.stringify(history.slice(0, 10)));
    } catch (e) {
      console.warn("Local storage access failed", e);
    }
  }
};
