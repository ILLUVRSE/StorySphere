
export class Input {
  constructor() {
    this.keys = {};
    this.queue = []; // Movement queue
    this.rewindPressed = false;

    this.setupListeners();
  }

  setupListeners() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Movement
      if (['ArrowUp', 'KeyW'].includes(e.code)) this.queue.push({x: 0, y: -1});
      if (['ArrowDown', 'KeyS'].includes(e.code)) this.queue.push({x: 0, y: 1});
      if (['ArrowLeft', 'KeyA'].includes(e.code)) this.queue.push({x: -1, y: 0});
      if (['ArrowRight', 'KeyD'].includes(e.code)) this.queue.push({x: 1, y: 0});

      // Rewind (Hold or Press)
      if (['Space', 'KeyR', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        this.rewindPressed = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
       if (['Space', 'KeyR', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        this.rewindPressed = false;
      }
    });

    // Touch controls
    // We can assume an external UI or simple touch zones
    // Ideally the main game binds touch events to these methods
  }

  // Consumes one movement input if available
  popMove() {
    return this.queue.shift();
  }

  isRewinding() {
    return this.rewindPressed;
  }

  clear() {
    this.queue = [];
    this.rewindPressed = false;
  }
}
