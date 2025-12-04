export class InputController {
    constructor(canvas, handler) {
        this.canvas = canvas;
        this.handler = handler; // Callback for actions

        this.attachListeners();
    }

    attachListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleStart(e));
        this.canvas.addEventListener('touchstart', (e) => this.handleStart(e), { passive: false });
    }

    getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        let x, y;
        if (e.touches) {
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else {
            x = e.clientX - rect.left;
            y = e.clientY - rect.top;
        }
        // Scale for canvas resolution vs display size
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return { x: x * scaleX, y: y * scaleY };
    }

    handleStart(e) {
        if (e.type === 'touchstart') e.preventDefault();
        const pos = this.getPos(e);
        this.handler(pos);
    }
}
