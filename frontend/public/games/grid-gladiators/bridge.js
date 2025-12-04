export class Bridge {
  constructor() {
    this.ready = false;
  }

  notifyReady() {
    if (this.ready) return;
    this.ready = true;
    if (window.parent) {
      window.parent.postMessage({ type: "arcade-ready" }, "*");
    }
  }

  submitScore(score, meta = {}) {
    // Local fallback
    try {
      const history = JSON.parse(localStorage.getItem("grid-gladiators-scores") || "[]");
      history.push({ score, meta, date: new Date().toISOString() });
      history.sort((a, b) => b.score - a.score);
      localStorage.setItem("grid-gladiators-scores", JSON.stringify(history.slice(0, 10)));
    } catch (e) {
      console.warn("LocalStorage access failed", e);
    }

    if (window.parent) {
      window.parent.postMessage({
        type: "arcade-score",
        score: Math.floor(score),
        meta
      }, "*");
    }
  }
}
