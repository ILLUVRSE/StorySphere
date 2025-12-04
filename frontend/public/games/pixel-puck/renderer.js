export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Theme Colors
        this.colors = {
            bg: '#004d40', // Dark Teal
            grid: '#00695c',
            p1: '#009688', // Accent Teal
            p2: '#ffd700', // Gold
            puck: '#fdfbf7', // Cream
            wall: '#00251a',
            bumper: '#ff5252',
            text: '#ffffff'
        };

        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
    }

    resize(w, h, gridW, gridH) {
        this.canvas.width = w;
        this.canvas.height = h;

        // Scale to fit while maintaining aspect ratio
        const scaleX = w / gridW;
        const scaleY = h / gridH;
        this.scale = Math.min(scaleX, scaleY);

        this.offsetX = (w - gridW * this.scale) / 2;
        this.offsetY = (h - gridH * this.scale) / 2;
    }

    draw(state, alpha) {
        const ctx = this.ctx;
        const map = state.map;

        // Clear
        ctx.fillStyle = this.colors.bg;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, this.scale);

        // Grid Lines
        ctx.strokeStyle = this.colors.grid;
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        for(let x=0; x<=map.gridW; x++) { ctx.moveTo(x,0); ctx.lineTo(x, map.gridH); }
        for(let y=0; y<=map.gridH; y++) { ctx.moveTo(0,y); ctx.lineTo(map.gridW, y); }
        ctx.stroke();

        // Center Line
        ctx.lineWidth = 0.1;
        ctx.beginPath();
        ctx.moveTo(map.gridW/2, 0);
        ctx.lineTo(map.gridW/2, map.gridH);
        ctx.stroke();

        // Center Circle
        ctx.beginPath();
        ctx.arc(map.gridW/2, map.gridH/2, 1.5, 0, Math.PI*2);
        ctx.stroke();

        // Tiles
        if (map.tiles) {
            for(const t of map.tiles) {
                if(t.type === 'speed') ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
                else if(t.type === 'slow') ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
                else ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';

                ctx.fillRect(t.x, t.y, t.w, t.h);
                // Icon or text
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.font = '0.5px monospace';
                ctx.fillText(t.type === 'speed' ? '>>>' : '<<<', t.x + t.w/2 - 0.4, t.y + t.h/2 + 0.2);
            }
        }

        // Goals
        for(const g of map.goals) {
            ctx.fillStyle = g.owner === 1 ? this.colors.p1 : this.colors.p2;
            ctx.globalAlpha = 0.3;
            ctx.fillRect(g.x, g.y, g.w, g.h);
            ctx.globalAlpha = 1.0;
        }

        // Bumpers
        if (map.bumpers) {
            ctx.fillStyle = this.colors.bumper;
            for(const b of map.bumpers) {
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2);
                ctx.fill();
                // Shine
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(b.x - b.radius*0.3, b.y - b.radius*0.3, b.radius*0.2, 0, Math.PI*2);
                ctx.fill();
                ctx.fillStyle = this.colors.bumper;
            }
        }

        // Players (Interpolation ideally, but state here is raw physics state usually passed)
        // If we want alpha interpolation, we need prev state.
        // For MVP 60fps, drawing raw state is usually smooth enough unless monitor is 144hz.
        // Let's draw raw state for simplicity first.

        this.drawPaddle(ctx, state.p1, this.colors.p1);
        this.drawPaddle(ctx, state.p2, this.colors.p2);

        // Puck
        ctx.fillStyle = this.colors.puck;
        ctx.shadowColor = this.colors.puck;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(state.puck.x, state.puck.y, state.puck.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Overlay text (Score)
        ctx.restore(); // Undo transform for UI

        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';

        // P1 Score
        ctx.fillStyle = this.colors.p1;
        ctx.fillText(state.p1.score, this.canvas.width * 0.25, 60);

        // P2 Score
        ctx.fillStyle = this.colors.p2;
        ctx.fillText(state.p2.score, this.canvas.width * 0.75, 60);

        // Timer
        const timeLeft = Math.max(0, Math.ceil((state.maxTimeMs - state.timeMs)/1000));
        ctx.fillStyle = timeLeft < 10 ? '#ff5252' : '#fff';
        ctx.font = '32px monospace';
        ctx.fillText(timeLeft, this.canvas.width/2, 40);

        if (state.gameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            ctx.fillStyle = '#fff';
            ctx.font = '48px monospace';
            const msg = state.winner === 0 ? "DRAW" : `PLAYER ${state.winner} WINS!`;
            ctx.fillText(msg, this.canvas.width/2, this.canvas.height/2);

            ctx.font = '24px monospace';
            ctx.fillText("Press REFRESH to play again", this.canvas.width/2, this.canvas.height/2 + 50);
        }
    }

    drawPaddle(ctx, p, color) {
        ctx.fillStyle = color;

        // Dash Aura
        if (p.dashTimer > 0) {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 0.05;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius + 0.1, 0, Math.PI*2);
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
        ctx.fill();

        // Handle visualization
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.5, 0, Math.PI*2);
        ctx.fill();
    }
}
