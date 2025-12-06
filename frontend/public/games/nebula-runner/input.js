export class InputHandler {
  constructor() {
    this.queuedMove = 0;
    this.queuedFire = false;
    this.setupListeners();
  }

  setupListeners() {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        this.queuedMove = -1;
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        this.queuedMove = 1;
        e.preventDefault();
      } else if (e.code === 'Space' || e.key === ' ') {
        this.queuedFire = true;
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
       if (e.code === 'Space' || e.key === ' ') {
           this.queuedFire = false;
       }
    });

    // Touch
    let touchStartY = 0;
    let touchStartX = 0;

    window.addEventListener('touchstart', (e) => {
      // We process every touch to support multi-touch (move + fire same time)
      for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          const halfWidth = window.innerWidth / 2;

          if (t.clientX > halfWidth) {
              // Right side = Fire
              this.queuedFire = true;
          } else {
              // Left side = Move Start
              touchStartY = t.clientY;
              touchStartX = t.clientX;
          }
      }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          const halfWidth = window.innerWidth / 2;

          if (t.clientX > halfWidth) {
             this.queuedFire = false;
          } else {
             // Left side = Move End
             // If we already started a touch on left, resolve it
             const touchEndY = t.clientY;
             const diffY = touchEndY - touchStartY;

             if (Math.abs(diffY) > 30) {
                 this.queuedMove = diffY > 0 ? 1 : -1; // Swipe
             } else {
                 // Tap zones on left side
                 // Top half of screen vs bottom half of screen logic
                 if (touchEndY < window.innerHeight / 2) {
                     this.queuedMove = -1;
                 } else {
                     this.queuedMove = 1;
                 }
             }
          }
      }
    }, { passive: false });
  }

  popMove() {
    const move = this.queuedMove;
    this.queuedMove = 0;
    return move;
  }

  // Fire is state-based or trigger-based?
  // For auto-fire holding space, we return state.
  // For semi-auto, we'd pop. Let's do state-based for "Rapid Fire" feel,
  // but the engine will likely limit fire rate.
  getFireState() {
      return this.queuedFire;
  }

  reset() {
    this.queuedMove = 0;
    this.queuedFire = false;
  }
}
