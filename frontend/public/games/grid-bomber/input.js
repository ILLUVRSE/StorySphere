export class InputManager {
  constructor() {
    this.keys = {};
    this.touchState = {
        up: false, down: false, left: false, right: false,
        action: false, remote: false
    };

    // Bindings
    this.p1Keys = {
        up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
        action: ['Space'], remote: ['KeyE']
    };
    this.p2Keys = {
        up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
        action: ['Enter'], remote: ['ShiftRight', 'Slash']
    };

    window.addEventListener('keydown', (e) => {
        this.keys[e.code] = true;
        // Prevent scrolling with arrows/space
        if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys[e.code] = false);

    this.setupTouch();
  }

  setupTouch() {
      // Check if mobile (simple check)
      const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (!isMobile) return;

      const ctrl = document.getElementById('mobile-controls');
      if (ctrl) ctrl.style.display = 'block';

      const bindTouch = (selector, key) => {
          const el = document.querySelector(selector);
          if (!el) return;
          el.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchState[key] = true; });
          el.addEventListener('touchend', (e) => { e.preventDefault(); this.touchState[key] = false; });
      };

      bindTouch('.dpad-up', 'up');
      bindTouch('.dpad-down', 'down');
      bindTouch('.dpad-left', 'left');
      bindTouch('.dpad-right', 'right');
      bindTouch('#btn-bomb', 'action');
      bindTouch('#btn-remote', 'remote');
  }

  getInputs(activePlayers) {
      // Returns array of input objects for each active player
      // activePlayers is array of player objects (to check IDs)

      const inputs = [];

      // P1 (ID 1)
      if (activePlayers.some(p => p.id === 1 && !p.isBot)) {
          const k = this.p1Keys;
          const t = this.touchState;

          const input = {
              id: 1,
              up: this.isDown(k.up) || t.up,
              down: this.isDown(k.down) || t.down,
              left: this.isDown(k.left) || t.left,
              right: this.isDown(k.right) || t.right,
              action: this.isDown(k.action) || t.action,
              remote: this.isDown(k.remote) || t.remote,
              // State tracking for "just pressed" logic handles in engine
          };

          // Manage "prev" state in engine or here?
          // Engine handles "just pressed" by storing prev input,
          // but we are sending raw state. The engine needs to track history if it wants edge detection.
          // BUT, `engine.js` line 146 checks `!input.prevAction`.
          // So we need to store history here.

          if (!this.prevP1) this.prevP1 = {};
          input.prevAction = this.prevP1.action;
          input.prevRemote = this.prevP1.remote;
          this.prevP1 = { action: input.action, remote: input.remote };

          inputs.push(input);
      }

      // P2 (ID 2)
      if (activePlayers.some(p => p.id === 2 && !p.isBot)) {
          const k = this.p2Keys;
          const input = {
              id: 2,
              up: this.isDown(k.up),
              down: this.isDown(k.down),
              left: this.isDown(k.left),
              right: this.isDown(k.right),
              action: this.isDown(k.action),
              remote: this.isDown(k.remote)
          };

          if (!this.prevP2) this.prevP2 = {};
          input.prevAction = this.prevP2.action;
          input.prevRemote = this.prevP2.remote;
          this.prevP2 = { action: input.action, remote: input.remote };

          inputs.push(input);
      }

      return inputs;
  }

  isDown(codes) {
      return codes.some(c => this.keys[c]);
  }
}
