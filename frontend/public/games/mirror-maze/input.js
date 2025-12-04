export class Input {
  constructor(canvas, engine, sfx) {
    this.canvas = canvas;
    this.engine = engine;
    this.sfx = sfx;
    this.renderer = null; // Set later

    this.handler = this.handleClick.bind(this);
    canvas.addEventListener('mousedown', this.handler);
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        this.handleClick({
            clientX: touch.clientX,
            clientY: touch.clientY,
            preventDefault: () => {}
        });
    }, {passive: false});
  }

  setRenderer(r) {
    this.renderer = r;
  }

  handleClick(e) {
    e.preventDefault();
    if (!this.renderer || this.engine.isWin) return;

    // Resume audio context
    this.sfx.ensureContext();

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const gridX = Math.floor((x - this.renderer.offsetX) / this.renderer.tileSize);
    const gridY = Math.floor((y - this.renderer.offsetY) / this.renderer.tileSize);

    if (this.engine.rotateMirror(gridX, gridY)) {
        this.sfx.playRotate();
    }
  }
}
