export class Bridge {
  constructor(gameId) {
    this.gameId = gameId;
    this.userId = null;

    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'arcade-set-user') {
            this.userId = event.data.user_id;
        }
    });

    // Try to resend failed scores on startup
    this.retryFailed();
  }

  sendReady(width, height) {
    window.parent.postMessage({
      type: 'arcade-ready',
      game: this.gameId,
      width,
      height
    }, '*');
  }

  sendScore(score, seed, durationMs, meta = {}) {
    const payload = {
      type: 'arcade-score',
      game: this.gameId,
      score,
      seed,
      durationMs,
      timestamp: Date.now(),
      meta
    };
    window.parent.postMessage(payload, '*');

    this.submitToApi(score, seed, durationMs, meta);
  }

  async submitToApi(score, seed, durationMs, meta) {
      try {
          const body = {
              game: this.gameId,
              score,
              seed,
              duration_ms: durationMs,
              meta
          };
          if (this.userId) {
              body.user_id = this.userId;
          }

          const res = await fetch('/api/v1/arcade/score', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
          });

          if (!res.ok) {
              this.queueLocally(body);
          }
      } catch (e) {
          console.warn('Score submission failed, queuing locally', e);
          this.queueLocally({
              game: this.gameId,
              score,
              seed,
              duration_ms: durationMs,
              meta,
              user_id: this.userId
          });
      }
  }

  queueLocally(payload) {
      try {
          const key = `${this.gameId}:failed-scores`;
          const current = JSON.parse(localStorage.getItem(key) || '[]');
          // Limit queue size
          if (current.length > 50) current.shift();
          current.push({ payload, timestamp: Date.now() });
          localStorage.setItem(key, JSON.stringify(current));
      } catch (e) {
          console.error("Local storage error", e);
      }
  }

  async retryFailed() {
      const key = `${this.gameId}:failed-scores`;
      let current;
      try {
          current = JSON.parse(localStorage.getItem(key) || '[]');
      } catch (e) { return; }

      if (current.length === 0) return;

      const remaining = [];
      for (const item of current) {
           // Skip old items (> 30 days)
           if (Date.now() - item.timestamp > 30 * 24 * 60 * 60 * 1000) continue;

           try {
               const res = await fetch('/api/v1/arcade/score', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify(item.payload)
               });
               if (!res.ok) remaining.push(item);
           } catch (e) {
               remaining.push(item);
           }
      }
      localStorage.setItem(key, JSON.stringify(remaining));
  }
}
