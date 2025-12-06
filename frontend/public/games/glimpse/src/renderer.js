import { SUITS, RANKS } from './model.js';

export class GlimpseRenderer {
    constructor(canvas, model) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.model = model;

        this.width = canvas.width;
        this.height = canvas.height;

        this.cardWidth = 80;
        this.cardHeight = 120;

        // Animation state
        this.animations = []; // { type: 'cardSlide', card, startX, startY, endX, endY, progress, duration }

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.draw();
    }

    // Coordinate helpers based on 4-player layout
    // 0: Bottom (Human), 1: Left, 2: Top, 3: Right
    getPlayerPos(index) {
        // Adjust index relative to human player (0)
        // In this fixed view, Human is always bottom.
        // If we want to support rotating view, we'd offset by myPlayerId.
        // Assuming Human is always index 0 for now as per Model init.

        const padding = 100;
        const cx = this.width / 2;
        const cy = this.height / 2;

        switch(index) {
            case 0: return { x: cx, y: this.height - padding, align: 'center' }; // Bottom
            case 1: return { x: padding, y: cy, align: 'left' }; // Left
            case 2: return { x: cx, y: padding, align: 'center' }; // Top
            case 3: return { x: this.width - padding, y: cy, align: 'right' }; // Right
        }
        return { x: 0, y: 0 };
    }

    getHandPos(index, cardIndex, totalCards) {
        const pos = this.getPlayerPos(index);
        const overlap = 30;
        const totalW = (totalCards - 1) * overlap + this.cardWidth;

        let x = pos.x;
        let y = pos.y;

        // Offset to center the hand
        if (index === 0 || index === 2) {
            x = pos.x - totalW / 2 + cardIndex * overlap;
        } else {
            y = pos.y - totalW / 2 + cardIndex * overlap;
        }

        return { x, y };
    }

    getTrickPos(index) {
        const cx = this.width / 2;
        const cy = this.height / 2;
        const offset = 80;

        switch(index) {
            case 0: return { x: cx, y: cy + offset };
            case 1: return { x: cx - offset, y: cy };
            case 2: return { x: cx, y: cy - offset };
            case 3: return { x: cx + offset, y: cy };
        }
        return { x: cx, y: cy };
    }

    // Drawing methods
    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw Table Background (felt)
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw Center Info
        this.drawCenterInfo();

        // Draw Players & Sigils
        this.model.players.forEach((p, i) => {
            this.drawPlayerZone(p, i);
            this.drawHand(p, i);
        });

        // Draw Trick
        this.drawTrick();

        // Draw Animations
        this.updateAnimations();
    }

    drawCenterInfo() {
        this.ctx.fillStyle = 'rgba(255,255,255,0.1)';
        this.ctx.font = 'bold 100px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        if (this.model.phase === 'gameOver') {
            this.ctx.fillText("GAME OVER", this.width/2, this.height/2);
        } else if (this.model.heartsBroken) {
             this.ctx.fillStyle = 'rgba(255,50,50,0.1)';
             this.ctx.fillText("♥", this.width/2, this.height/2);
        }
    }

    drawPlayerZone(player, index) {
        const pos = this.getPlayerPos(index);

        // Draw Avatar/Name
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`P${index + 1} (${player.score} pts)`, pos.x, pos.y + (index === 0 || index === 2 ? 0 : 40));

        // Draw Sigil (Forehead)
        // Human (0) doesn't see their own sigil unless debug
        const shouldReveal = index !== 0 || window.revealMySigil;

        if (player.sigil && shouldReveal) {
            this.drawSigilCard(pos.x, pos.y - 60, player.sigil);
        } else if (index === 0) {
            // Draw placeholder for self
            this.drawSigilCard(pos.x, pos.y - 60, { name: '?', expr: '?', val: '???' }, true);
        }
    }

    drawSigilCard(x, y, sigil, isMystery=false) {
        const w = 60;
        const h = 40;

        this.ctx.fillStyle = isMystery ? '#444' : '#f1c40f';
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;

        this.ctx.beginPath();
        this.ctx.roundRect(x - w/2, y - h/2, w, h, 5);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.fillStyle = isMystery ? '#aaa' : '#000';
        this.ctx.textAlign = 'center';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillText(sigil.expr, x, y - 5);

        this.ctx.font = '10px Arial';
        this.ctx.fillText(typeof sigil.val === 'number' ? sigil.val.toFixed(3) : sigil.val, x, y + 12);
    }

    drawHand(player, index) {
        // Draw cards
        const hand = player.hand;
        hand.forEach((card, cardIndex) => {
            const pos = this.getHandPos(index, cardIndex, hand.length);
            // Hide opponent cards
            if (index !== 0) {
                this.drawCardBack(pos.x, pos.y);
            } else {
                this.drawCard(pos.x, pos.y, card);
            }
        });
    }

    drawTrick() {
        this.model.currentTrick.forEach(play => {
            const pos = this.getTrickPos(play.playerId);
            this.drawCard(pos.x, pos.y, play.card);

            // Draw Calculated Power Badge
            const player = this.model.players[play.playerId];
            if (player.sigil) { // Should check visibility? The rule says "Others can read yours".
                // In game view, usually everyone sees the 'Result' of the power calculation
                // BUT knowing the exact power requires knowing the sigil.
                // If I am P0, I don't see my sigil, so I don't know my exact power?
                // Actually core idea: "Players see everyone else's secret sigil... play card... compute combined power".
                // If I don't know my sigil, I can't confirm my power.
                // So we should only show power for opponents? Or show '?' for self?

                let powerText = "?";
                const isMe = play.playerId === 0;

                if (!isMe || window.revealMySigil) {
                    const power = this.model.calculateCombinedPower(play.card, player.sigil);
                    powerText = power.toFixed(2);
                }

                this.ctx.fillStyle = '#000';
                this.ctx.fillRect(pos.x - 20, pos.y - 70, 40, 20);
                this.ctx.fillStyle = '#0f0';
                this.ctx.font = 'bold 12px Arial';
                this.ctx.fillText(powerText, pos.x, pos.y - 56);
            }
        });
    }

    drawCard(x, y, card) {
        const w = this.cardWidth;
        const h = this.cardHeight;

        this.ctx.fillStyle = 'white';
        this.ctx.shadowBlur = 5;
        this.ctx.shadowColor = 'rgba(0,0,0,0.3)';
        this.ctx.fillRect(x - w/2, y - h/2, w, h);
        this.ctx.shadowBlur = 0;

        this.ctx.strokeStyle = '#ccc';
        this.ctx.strokeRect(x - w/2, y - h/2, w, h);

        const isRed = card.suit === '♥' || card.suit === '♦';
        this.ctx.fillStyle = isRed ? '#e74c3c' : '#2c3e50';

        // Corners
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(card.rank, x - w/2 + 5, y - h/2 + 20);
        this.ctx.fillText(card.suit, x - w/2 + 5, y - h/2 + 38);

        // Center
        this.ctx.font = '40px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(card.suit, x, y);
    }

    drawCardBack(x, y) {
        const w = this.cardWidth;
        const h = this.cardHeight;

        this.ctx.fillStyle = '#34495e';
        this.ctx.fillRect(x - w/2, y - h/2, w, h);
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x - w/2 + 5, y - h/2 + 5, w - 10, h - 10);
    }

    // Interaction
    getCardAt(x, y) {
        // Only check human hand (Player 0)
        const player = this.model.players[0];
        const hand = player.hand;

        for (let i = hand.length - 1; i >= 0; i--) {
            const pos = this.getHandPos(0, i, hand.length);
            const w = this.cardWidth;
            const h = this.cardHeight;

            if (x >= pos.x - w/2 && x <= pos.x + w/2 &&
                y >= pos.y - h/2 && y <= pos.y + h/2) {
                return hand[i];
            }
        }
        return null;
    }

    updateAnimations() {
        // Placeholder for smooth animations
    }
}
