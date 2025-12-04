export class Input {
    constructor(canvas, logicalWidth, logicalHeight) {
        this.canvas = canvas;
        this.logicalWidth = logicalWidth;
        this.logicalHeight = logicalHeight; // For coordinate mapping

        this.state = {
            p1: { x: null, y: null, moveVector: {x: 0, y: 0}, dash: false, device: 'keyboard' }, // device: 'keyboard' | 'touch' | 'mouse'
            p2: { moveVector: {x: 0, y: 0}, dash: false }
        };

        this.keys = {};
        this.touchId = null; // Track single touch for joystick or direct control

        // Mobile Virtual Joystick State
        this.joystick = {
            active: false,
            origin: { x: 0, y: 0 },
            current: { x: 0, y: 0 },
            radius: 50 // px
        };

        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        this.initListeners();
    }

    initListeners() {
        const resumeAudio = () => {
            if (window.gameSFX) window.gameSFX.ensureContext();
        };

        // Keyboard
        window.addEventListener('keydown', (e) => {
            resumeAudio();
            this.keys[e.code] = true;
            if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // Mouse (Single Player / P1)
        if (!this.isMobile) {
            this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            this.canvas.addEventListener('mousedown', (e) => {
                resumeAudio();
                this.handleMouseDash(e);
            });
        }

        // Touch (Mobile - Virtual Joystick + Tap)
        if (this.isMobile) {
            this.canvas.addEventListener('touchstart', (e) => {
                resumeAudio();
                this.handleTouchStart(e);
            }, { passive: false });
            this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
            this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        }
    }

    getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.logicalWidth / rect.width;
        const scaleY = this.logicalHeight / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    handleMouseMove(e) {
        // Direct mapping for Mouse
        const pos = this.getCanvasPos(e);
        this.state.p1.x = pos.x;
        this.state.p1.y = pos.y;
        this.state.p1.device = 'mouse';
    }

    handleMouseDash(e) {
        // Click to dash
        this.state.p1.dash = true;
    }

    handleTouchStart(e) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            const rect = this.canvas.getBoundingClientRect();
            // Right side of screen -> Dash button area (roughly)
            if (t.clientX > rect.left + rect.width / 2) {
                this.state.p1.dash = true;
            } else {
                // Left side -> Joystick
                if (!this.joystick.active) {
                    this.joystick.active = true;
                    this.joystick.id = t.identifier;
                    this.joystick.origin = { x: t.clientX, y: t.clientY };
                    this.joystick.current = { x: t.clientX, y: t.clientY };
                    this.state.p1.device = 'touch';
                }
            }
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (this.joystick.active && t.identifier === this.joystick.id) {
                this.joystick.current = { x: t.clientX, y: t.clientY };
            }
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (this.joystick.active && t.identifier === this.joystick.id) {
                this.joystick.active = false;
                this.state.p1.moveVector = { x: 0, y: 0 };
            }
        }
        // Dash is instantaneous trigger, usually cleared by game loop,
        // but for touch button logic, we let the loop consume it.
    }

    update() {
        // Player 1 Keyboard (WASD) - Only if not using mouse/touch recently
        if (this.state.p1.device === 'keyboard') {
            let dx = 0, dy = 0;
            if (this.keys['KeyW']) dy -= 1;
            if (this.keys['KeyS']) dy += 1;
            if (this.keys['KeyA']) dx -= 1;
            if (this.keys['KeyD']) dx += 1;

            // Normalize
            const mag = Math.sqrt(dx*dx + dy*dy);
            if (mag > 0) {
                dx /= mag;
                dy /= mag;
            }
            this.state.p1.moveVector = { x: dx, y: dy };

            if (this.keys['Space']) this.state.p1.dash = true;
            // Note: If mouse moves, device flips to 'mouse'
        }

        // If using Mouse, movement is determined by position diff in Engine,
        // but Input just provides absolute target position.

        // If using Touch Joystick
        if (this.state.p1.device === 'touch' && this.joystick.active) {
            const dx = this.joystick.current.x - this.joystick.origin.x;
            const dy = this.joystick.current.y - this.joystick.origin.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const max = this.joystick.radius;

            // Normalized vector
            if (dist > 10) { // Deadzone
                this.state.p1.moveVector = { x: dx/max, y: dy/max };
                // Clamp magnitude to 1
                const mag = Math.sqrt(this.state.p1.moveVector.x**2 + this.state.p1.moveVector.y**2);
                if (mag > 1) {
                    this.state.p1.moveVector.x /= mag;
                    this.state.p1.moveVector.y /= mag;
                }
            } else {
                this.state.p1.moveVector = { x: 0, y: 0 };
            }
        }

        // Player 2 Keyboard (Arrows)
        let p2dx = 0, p2dy = 0;
        if (this.keys['ArrowUp']) p2dy -= 1;
        if (this.keys['ArrowDown']) p2dy += 1;
        if (this.keys['ArrowLeft']) p2dx -= 1;
        if (this.keys['ArrowRight']) p2dx += 1;

        const p2mag = Math.sqrt(p2dx*p2dx + p2dy*p2dy);
        if (p2mag > 0) {
            p2dx /= p2mag;
            p2dy /= p2mag;
        }
        this.state.p2.moveVector = { x: p2dx, y: p2dy };
        if (this.keys['Enter'] || this.keys['ShiftRight']) this.state.p2.dash = true;

        return this.state;
    }

    // Call this after game loop consumes dash to reset it
    resetDash() {
        // For keyboard, we might want to wait for key up, but for simple trigger:
        // We only reset if the key is NOT held? Or just rely on cooldown in engine.
        // The engine handles cooldown. We just report if the button is currently pressed/triggered.
        // Actually, for "Trigger" logic, it's safer to let Engine consume 'dash' flag and set it back to false here if we want "one press one dash"
        // But the prompt says "Cooldown", so holding it down shouldn't matter much.
        this.state.p1.dash = false;
        this.state.p2.dash = false;
    }
}
