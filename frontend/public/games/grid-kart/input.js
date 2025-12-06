// TILE Constants used in engine.js and renderer.js
import { TILE, TrackGenerator } from './generator.js';

export const Input = {
    keys: {
        up: false,
        down: false,
        left: false,
        right: false,
        drift: false
    },

    init: () => {
        window.addEventListener('keydown', (e) => {
            switch(e.code) {
                case 'ArrowUp':
                case 'KeyW': Input.keys.up = true; break;
                case 'ArrowDown':
                case 'KeyS': Input.keys.down = true; break;
                case 'ArrowLeft':
                case 'KeyA': Input.keys.left = true; break;
                case 'ArrowRight':
                case 'KeyD': Input.keys.right = true; break;
                case 'Space':
                case 'ShiftLeft':
                case 'ShiftRight': Input.keys.drift = true; break;
            }
        });

        window.addEventListener('keyup', (e) => {
            switch(e.code) {
                case 'ArrowUp':
                case 'KeyW': Input.keys.up = false; break;
                case 'ArrowDown':
                case 'KeyS': Input.keys.down = false; break;
                case 'ArrowLeft':
                case 'KeyA': Input.keys.left = false; break;
                case 'ArrowRight':
                case 'KeyD': Input.keys.right = false; break;
                case 'Space':
                case 'ShiftLeft':
                case 'ShiftRight': Input.keys.drift = false; break;
            }
        });

        // Touch / Mobile Controls (Overlay)
        const leftZone = document.getElementById('zone-left');
        const rightZone = document.getElementById('zone-right');
        const startBtn = document.getElementById('start-btn');
        const restartBtn = document.getElementById('restart-btn');

        // Simple touch logic: Left Zone = Left/Right (slide), Right Zone = Gas/Drift
        // This is a placeholder for complex touch. Simple arcade buttons work better.

        // For now, let's just ensure keyboard is solid.
    }
};

export const MathUtils = {
    dist: (x1, y1, x2, y2) => Math.sqrt((x2-x1)**2 + (y2-y1)**2),
    lerp: (a, b, t) => a + (b - a) * t
};
