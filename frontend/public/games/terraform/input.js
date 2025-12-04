export class InputHandler {
  constructor(canvas, game, renderer) {
    this.canvas = canvas;
    this.game = game;
    this.renderer = renderer;

    this.lastClickTime = 0;
    this.lastClickPos = {x: -1, y: -1};
    this.doubleTapDelay = 300;

    this.setupEvents();
  }

  setupEvents() {
    this.canvas.addEventListener('pointerdown', (e) => this.handleInput(e));
    // Prevent default touch actions (scrolling)
    this.canvas.addEventListener('touchstart', (e) => e.preventDefault(), {passive: false});
  }

  handleInput(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Map to grid
    if (!this.renderer.gridMetrics) return;

    const { startX, gridY, cellSize } = this.renderer.gridMetrics;

    if (x >= startX && x < startX + this.game.width * cellSize &&
        y >= gridY && y < gridY + this.game.height * cellSize) {

        const gridX = Math.floor((x - startX) / cellSize);
        const gridYPos = Math.floor((y - gridY) / cellSize);

        // Double tap detection
        const now = performance.now();
        const isDoubleTap = (
            now - this.lastClickTime < this.doubleTapDelay &&
            this.lastClickPos.x === gridX &&
            this.lastClickPos.y === gridYPos
        );

        this.game.handleInput(gridX, gridYPos, isDoubleTap);

        this.lastClickTime = now;
        this.lastClickPos = {x: gridX, y: gridYPos};
    }
  }
}
