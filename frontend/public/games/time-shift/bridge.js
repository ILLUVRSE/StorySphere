
export const ArcadeBridge = {
  sendScore: (scoreData) => {
    // scoreData: { score: number, timeMs: number, rewinds: number, ... }
    window.parent.postMessage({ type: 'arcade-score', ...scoreData }, '*');
  },
  sendReady: () => {
    window.parent.postMessage({ type: 'arcade-ready' }, '*');
  }
};
