export class InputHandler {
    constructor(gameContainer, onAction) {
        this.onAction = onAction; // callback(action)
        this.touchStartX = 0;
        this.touchStartY = 0;

        window.addEventListener('keydown', this.handleKey.bind(this));

        const canvas = gameContainer.querySelector('canvas');
        canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
    }

    handleKey(e) {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", " "].indexOf(e.code) > -1) {
            e.preventDefault();
        }

        switch(e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                this.onAction({ type: 'move', dx: 0, dy: -1 }); break;
            case 'ArrowDown':
            case 's':
            case 'S':
                this.onAction({ type: 'move', dx: 0, dy: 1 }); break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                this.onAction({ type: 'move', dx: -1, dy: 0 }); break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                this.onAction({ type: 'move', dx: 1, dy: 0 }); break;
            case ' ':
            case 'Enter':
            case 'e':
            case 'E':
                this.onAction({ type: 'wait' }); break;
        }
    }

    handlePointerDown(e) {
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.onAction({ type: 'pointer', x, y });
    }
}
