import { WHEEL_SECTORS } from './engine.js';

export class Renderer {
    constructor(canvas, engine) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.engine = engine;

        // Font setup
        this.ctx.font = 'bold 20px monospace';

        this.wheelRadius = 0;
        this.centerX = 0;
        this.centerY = 0;

        // Juice state
        this.particles = [];
        this.shake = 0;
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;

        // Layout: Wheel on Left (or Top on mobile), Board on Right/Center
        const isLandscape = this.canvas.width > this.canvas.height;

        if (isLandscape) {
            this.wheelRadius = this.canvas.height * 0.4;
            this.centerX = this.wheelRadius + 20;
            this.centerY = this.canvas.height / 2;
        } else {
            // Portrait
            this.wheelRadius = this.canvas.width * 0.35;
            this.centerX = this.canvas.width / 2;
            this.centerY = this.wheelRadius + 20;
        }
    }

    draw() {
        const ctx = this.ctx;

        // Screen Shake
        ctx.save();
        if (this.shake > 0) {
            const dx = (Math.random() - 0.5) * this.shake;
            const dy = (Math.random() - 0.5) * this.shake;
            ctx.translate(dx, dy);
            this.shake *= 0.9; // Decay
            if (this.shake < 0.5) this.shake = 0;
        }

        // Clear
        ctx.fillStyle = '#004d40'; // Dark Teal Theme
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawWheel();
        this.drawBoard();
        this.drawHUD();
        this.drawControls();
        this.drawParticles();

        ctx.restore();
    }

    triggerShake(amount) {
        this.shake = amount;
    }

    spawnParticles(x, y, color, count = 20) {
        for(let i=0; i<count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1.0,
                color: color
            });
        }
    }

    drawParticles() {
        const ctx = this.ctx;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2; // Gravity
            p.life -= 0.02;

            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 4, 4);
            ctx.globalAlpha = 1.0;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    drawWheel() {
        const ctx = this.ctx;
        const cx = this.centerX;
        const cy = this.centerY;
        const r = this.wheelRadius;
        const numSectors = WHEEL_SECTORS.length;
        const arc = (Math.PI * 2) / numSectors;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.engine.wheelAngle);

        for (let i = 0; i < numSectors; i++) {
            const sector = WHEEL_SECTORS[i];
            const angle = i * arc;

            ctx.beginPath();
            ctx.fillStyle = sector.color;
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, r, angle, angle + arc);
            ctx.lineTo(0, 0);
            ctx.fill();
            ctx.stroke();

            // Text
            ctx.save();
            ctx.rotate(angle + arc / 2);
            ctx.textAlign = "right";
            ctx.fillStyle = sector.textColor || '#000';
            ctx.font = `bold ${r/10}px sans-serif`;
            const text = sector.label || (sector.value > 0 ? "$" + sector.value : "");
            ctx.fillText(text, r - 10, 5);
            ctx.restore();
        }

        // Center cap
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd700';
        ctx.fill();
        ctx.stroke();

        ctx.restore();

        // Pointer
        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(-10, -r + 10);
        ctx.lineTo(10, -r + 10);
        ctx.lineTo(0, -r - 10);
        ctx.fill();
        ctx.restore();
    }

    drawBoard() {
        if (!this.engine.puzzle) return;

        const ctx = this.ctx;
        const isLandscape = this.canvas.width > this.canvas.height;

        // Calculate board area
        let boardX, boardY, boardW, boardH;
        if (isLandscape) {
            boardX = this.centerX + this.wheelRadius + 20;
            boardY = 50;
            boardW = this.canvas.width - boardX - 20;
            boardH = this.canvas.height * 0.6;
        } else {
            boardX = 20;
            boardY = this.centerY + this.wheelRadius + 20;
            boardW = this.canvas.width - 40;
            boardH = this.canvas.height * 0.3;
        }

        const text = this.engine.puzzle.text;
        const grid = this.engine.puzzle.grid;

        const maxLineLen = Math.max(...grid.map(l => l.length));
        const tileSize = Math.min(boardW / (maxLineLen + 2), boardH / (grid.length + 2));

        const totalW = maxLineLen * tileSize;
        const totalH = grid.length * tileSize;
        const startX = boardX + (boardW - totalW) / 2;
        const startY = boardY + (boardH - totalH) / 2;

        let globalIdx = 0;

        ctx.font = `bold ${tileSize * 0.6}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let line of grid) {
            const lineWidth = line.length * tileSize;
            let lineX = startX + (totalW - lineWidth) / 2;

            for (let char of line) {
                 if (char !== ' ') {
                     ctx.fillStyle = '#fdfbf7'; // Cream
                     ctx.fillRect(lineX, cursorY, tileSize - 2, tileSize - 2);
                     ctx.strokeStyle = '#000';
                     ctx.strokeRect(lineX, cursorY, tileSize - 2, tileSize - 2);

                     // Find index
                     while(this.engine.puzzle.text[globalIdx] === ' ') globalIdx++;

                     if (this.engine.revealed[globalIdx]) {
                         ctx.fillStyle = '#000';
                         ctx.fillText(char, lineX + tileSize/2, cursorY + tileSize/2);
                     }
                     globalIdx++;
                 }
                 lineX += tileSize;
            }
            cursorY += tileSize;
        }
    }

    drawHUD() {
        const ctx = this.ctx;
        const engine = this.engine;

        // Players List (Top Right or Bottom in portrait?)
        // Let's put it on the Right side in landscape
        const isLandscape = this.canvas.width > this.canvas.height;
        let hudX = isLandscape ? this.canvas.width - 250 : 20;
        let hudY = isLandscape ? 50 : this.canvas.height - 200;

        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'left';

        engine.players.forEach((p, i) => {
            const isCurrent = i === engine.currentPlayerIndex;

            // Highlight current player box
            if (isCurrent) {
                ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
                ctx.fillRect(hudX - 10, hudY - 25, 240, 60);
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 2;
                ctx.strokeRect(hudX - 10, hudY - 25, 240, 60);
            }

            ctx.fillStyle = isCurrent ? '#ffd700' : '#ccc';
            ctx.fillText(`${p.name}`, hudX, hudY);

            ctx.fillStyle = '#fff';
            ctx.fillText(`$${p.roundCash} (Bank: $${p.bank})`, hudX, hudY + 25);

            // Inventory
            if (p.inventory.length > 0) {
                 ctx.font = '14px sans-serif';
                 ctx.fillStyle = '#8bc34a';
                 ctx.fillText(`ITEMS: ${p.inventory.join(', ')}`, hudX, hudY + 45);
                 ctx.font = 'bold 20px sans-serif';
            }

            hudY += 80;
        });

        // Jackpot Display
        ctx.fillStyle = '#ffd700';
        ctx.textAlign = 'center';
        ctx.font = 'bold 30px sans-serif';
        if (isLandscape) {
             ctx.fillText(`JACKPOT: $${engine.jackpot}`, this.centerX, 40);
        } else {
             ctx.fillText(`JACKPOT: $${engine.jackpot}`, this.canvas.width / 2, 40);
        }

        // Message Bar
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px sans-serif';
        // Pulse effect for message
        const scale = 1.0 + Math.sin(Date.now() / 200) * 0.05;
        ctx.save();
        ctx.translate(this.canvas.width / 2, this.canvas.height - 50);
        ctx.scale(scale, scale);
        ctx.fillText(this.engine.message, 0, 0);
        ctx.restore();
    }

    drawControls() {
        // Visuals only
    }
}
