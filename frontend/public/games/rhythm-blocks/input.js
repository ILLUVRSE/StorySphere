// Input Handling

class InputSystem {
  constructor(laneCount) {
    this.laneCount = laneCount;
    // Map lanes 0-5
    this.keyMap = {
      's': 0, 'S': 0,
      'd': 1, 'D': 1,
      'f': 2, 'F': 2,
      'j': 3, 'J': 3,
      'k': 4, 'K': 4,
      'l': 5, 'L': 5
    };

    // Store active inputs { lane: timestamp }
    this.activeInputs = [];
    this.onInput = null; // Callback
  }

  init(onInputCallback) {
    this.onInput = onInputCallback;

    window.addEventListener('keydown', (e) => this.handleKey(e, true));
    // We don't necessarily need keyup for taps, but for holds (later) we might.

    // Touch/Mouse setup requires binding to the canvas or specific areas
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
        canvas.addEventListener('touchstart', (e) => this.handleTouch(e), {passive: false});
        canvas.addEventListener('mousedown', (e) => this.handleMouse(e));
    }
  }

  handleKey(e, isDown) {
    if (e.repeat) return;
    if (this.keyMap.hasOwnProperty(e.key)) {
        const lane = this.keyMap[e.key];
        this.triggerInput(lane);
    }
  }

  triggerInput(lane) {
    // Debounce extremely close inputs if needed, or just pass through
    // For Rhythm games, we just pass the timestamp and lane
    if (this.onInput) {
        this.onInput(lane, performance.now()); // Using performance.now for internal relativity, but engine syncs to audio
    }
  }

  handleTouch(e) {
    e.preventDefault();
    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const laneWidth = rect.width / this.laneCount;

    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const x = t.clientX - rect.left;
        const lane = Math.floor(x / laneWidth);
        if (lane >= 0 && lane < this.laneCount) {
            this.triggerInput(lane);
        }
    }
  }

  handleMouse(e) {
    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const laneWidth = rect.width / this.laneCount;
    const x = e.clientX - rect.left;
    const lane = Math.floor(x / laneWidth);
    if (lane >= 0 && lane < this.laneCount) {
        this.triggerInput(lane);
    }
  }
}

window.InputSystem = InputSystem;
