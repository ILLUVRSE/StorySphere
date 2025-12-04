// input.js

export class InputManager {
  constructor(canvas, engine, renderer) {
    this.canvas = canvas;
    this.engine = engine;
    this.renderer = renderer;
    this.active = false;

    this.mouse = { x: 0, y: 0, gridX: -1, gridY: -1, down: false };
  }

  init() {
    this.active = true;

    // Mouse events
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

    // Touch events
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

    // Prevent context menu
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  getGridPos(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return this.renderer.screenToGrid(x, y);
  }

  updateMousePos(clientX, clientY) {
    const pos = this.getGridPos(clientX, clientY);
    this.mouse.gridX = pos.x;
    this.mouse.gridY = pos.y;
    this.engine.setHover(pos.x, pos.y);
  }

  handleMouseMove(e) {
    this.updateMousePos(e.clientX, e.clientY);
  }

  handleMouseDown(e) {
    if (e.button === 0) { // Left click
      this.mouse.down = true;
      this.updateMousePos(e.clientX, e.clientY);
      this.engine.handleInput(this.mouse.gridX, this.mouse.gridY, 'place');
    } else if (e.button === 2) { // Right click
      this.updateMousePos(e.clientX, e.clientY);
      this.engine.handleInput(this.mouse.gridX, this.mouse.gridY, 'sell');
    }
  }

  handleMouseUp(e) {
    this.mouse.down = false;
  }

  handleMouseLeave(e) {
    this.mouse.gridX = -1;
    this.mouse.gridY = -1;
    this.engine.setHover(-1, -1);
  }

  handleTouchStart(e) {
    e.preventDefault();
    if (e.touches.length > 0) {
      this.updateMousePos(e.touches[0].clientX, e.touches[0].clientY);
      this.engine.handleInput(this.mouse.gridX, this.mouse.gridY, 'place');
    }
  }

  handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length > 0) {
      this.updateMousePos(e.touches[0].clientX, e.touches[0].clientY);
    }
  }

  handleTouchEnd(e) {
    e.preventDefault();
    this.mouse.down = false;
  }
}
