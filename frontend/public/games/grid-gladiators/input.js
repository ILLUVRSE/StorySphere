import { dist } from './utils.js';

export class Input {
  constructor() {
    this.keys = {};
    this.p1 = { x: 0, y: 0, a1: false, a2: false, aim: { x: 1, y: 0 } };
    this.p2 = { x: 0, y: 0, a1: false, a2: false, aim: { x: -1, y: 0 } };

    // Mouse support for P1 aiming
    this.mouse = { x: 0, y: 0, active: false };

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    // Prevent scrolling with arrows/space
    window.addEventListener('keydown', (e) => {
      if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) {
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        this.mouse.active = true;
    });

    window.addEventListener('mousedown', (e) => {
        if (e.button === 0) this.p1.a1 = true;
        if (e.button === 2) this.p1.a2 = true;
    });
    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) this.p1.a1 = false;
        if (e.button === 2) this.p1.a2 = false;
    });
    window.addEventListener('contextmenu', e => e.preventDefault());
  }

  onKeyDown(e) {
    this.keys[e.code] = true;
  }

  onKeyUp(e) {
    this.keys[e.code] = false;
  }

  update(bounds) {
    // P1: WASD
    this.p1.x = 0;
    this.p1.y = 0;
    if (this.keys['KeyW']) this.p1.y -= 1;
    if (this.keys['KeyS']) this.p1.y += 1;
    if (this.keys['KeyA']) this.p1.x -= 1;
    if (this.keys['KeyD']) this.p1.x += 1;

    // Normalize
    const p1Len = Math.sqrt(this.p1.x**2 + this.p1.y**2);
    if (p1Len > 0) {
      this.p1.x /= p1Len;
      this.p1.y /= p1Len;
    }

    // P1 Abilities (Space/Shift or Mouse)
    if (!this.mouse.active) {
        // Keyboard only aim: based on movement or last direction
        if (p1Len > 0) {
            this.p1.aim.x = this.p1.x;
            this.p1.aim.y = this.p1.y;
        }
        this.p1.a1 = this.keys['Space'] || false;
        this.p1.a2 = this.keys['ShiftLeft'] || false;
    } else {
        // Mouse Aim calculation needs canvas bounds relative to player
        // This requires player position which input doesn't have directly.
        // We will just expose mouse coordinates and let engine solve aim.
    }

    // P2: Arrows
    this.p2.x = 0;
    this.p2.y = 0;
    if (this.keys['ArrowUp']) this.p2.y -= 1;
    if (this.keys['ArrowDown']) this.p2.y += 1;
    if (this.keys['ArrowLeft']) this.p2.x -= 1;
    if (this.keys['ArrowRight']) this.p2.x += 1;

    const p2Len = Math.sqrt(this.p2.x**2 + this.p2.y**2);
    if (p2Len > 0) {
      this.p2.x /= p2Len;
      this.p2.y /= p2Len;
      this.p2.aim.x = this.p2.x;
      this.p2.aim.y = this.p2.y;
    }

    this.p2.a1 = this.keys['Enter'] || this.keys['Numpad0'] || false;
    this.p2.a2 = this.keys['ControlRight'] || this.keys['ShiftRight'] || false;
  }

  getMouseAim(playerScreenX, playerScreenY) {
     if (!this.mouse.active) return null;
     const dx = this.mouse.x - playerScreenX;
     const dy = this.mouse.y - playerScreenY;
     const d = Math.sqrt(dx*dx + dy*dy);
     return { x: dx/d, y: dy/d };
  }
}
