export class InputHandler {
    constructor(canvas, gameInstance) {
        this.canvas = canvas;
        this.game = gameInstance;
        this.isDragging = false;
        this.dragStart = null; // {r, c}
        this.dragEnd = null;

        // Touch/Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleStart(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleEnd(e));

        this.canvas.addEventListener('touchstart', (e) => this.handleStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleEnd(e));
    }

    getGridPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        const tileSize = this.canvas.width / 8;
        const c = Math.floor(x / tileSize);
        const r = Math.floor(y / tileSize);

        if (r >= 0 && r < 8 && c >= 0 && c < 8) return { r, c };
        return null;
    }

    handleStart(e) {
        e.preventDefault();
        const pos = this.getGridPos(e);
        if (pos) {
            this.game.onInteractStart(pos);
            this.isDragging = true;
            this.dragStart = pos;
        }
    }

    handleMove(e) {
        e.preventDefault();
        if (this.isDragging) {
            // Optional: Update drag visual in renderer
        }
    }

    handleEnd(e) {
        e.preventDefault();
        if (this.isDragging) {
            // For Touchend, we might not get position easily from changedTouches if we want "drop" location.
            // But standard 'mouseup' gives clientX/Y. Touch end uses changedTouches.

            let pos = null;
            if (e.changedTouches && e.changedTouches.length > 0) {
                 const rect = this.canvas.getBoundingClientRect();
                 const touch = e.changedTouches[0];
                 const x = touch.clientX - rect.left;
                 const y = touch.clientY - rect.top;
                 const tileSize = this.canvas.width / 8;
                 const c = Math.floor(x / tileSize);
                 const r = Math.floor(y / tileSize);
                 if (r >= 0 && r < 8 && c >= 0 && c < 8) pos = { r, c };
            } else {
                pos = this.getGridPos(e);
            }

            if (pos) {
                // Determine if this was a Click or a Drag
                if (this.dragStart && pos.r === this.dragStart.r && pos.c === this.dragStart.c) {
                    // It's a Click (Start == End)
                    // The 'Start' interaction already selected it.
                    // If we are clicking the same tile again, maybe deselect?
                    // Game logic handles "Click Source -> Click Dest".
                    // InteractionStart selected the source. Now we are releasing on the same tile.
                    // This is just "Selection".
                    // If we release on a DIFFERENT tile, it's a "Drag-Drop" Move attempt.
                } else {
                    // Drag Drop
                    this.game.onInteractEnd(pos); // Attempt move to 'pos'
                }
            } else {
                // Released outside
            }

            this.isDragging = false;
            this.dragStart = null;
        }
    }
}
