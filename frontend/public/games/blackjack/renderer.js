import { RANKS } from './engine.js';

export class Renderer {
    constructor(canvas, assets) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.assets = assets || {}; // Could hold loaded images if we had them

        // Layout constants
        this.layout = {
            dealerY: this.height * 0.2,
            playerY: this.height * 0.6,
            cardWidth: 60,
            cardHeight: 90,
            cardSpacing: 20,
            chipRadius: 25,
            uiY: this.height * 0.9
        };
    }

    resize() {
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.layout.dealerY = this.height * 0.2;
        this.layout.playerY = this.height * 0.6;
        this.layout.uiY = this.height * 0.85;
    }

    clear() {
        // Felt green background
        this.ctx.fillStyle = '#004d40';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Table line
        this.ctx.strokeStyle = '#00796b';
        this.ctx.lineWidth = 5;
        this.ctx.beginPath();
        this.ctx.arc(this.width/2, -this.height, this.height * 1.5, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    drawCard(card, x, y) {
        const w = this.layout.cardWidth;
        const h = this.layout.cardHeight;
        const r = 5; // corner radius

        if (!card.faceUp) {
            // Draw card back
            this.ctx.fillStyle = '#b71c1c';
            this.ctx.beginPath();
            this.ctx.roundRect(x, y, w, h, r);
            this.ctx.fill();
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            // Pattern
            this.ctx.fillStyle = '#e53935';
            this.ctx.beginPath();
            this.ctx.arc(x + w/2, y + h/2, 10, 0, Math.PI*2);
            this.ctx.fill();
            return;
        }

        // Card Face
        this.ctx.fillStyle = 'white';
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, w, h, r);
        this.ctx.fill();
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        // Text
        const isRed = ['hearts', 'diamonds'].includes(card.suit);
        this.ctx.fillStyle = isRed ? '#d32f2f' : '#212121';
        this.ctx.font = 'bold 20px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Top Left
        this.ctx.fillText(card.rank, x + 15, y + 20);

        // Suit
        let suitIcon = '';
        if (card.suit === 'hearts') suitIcon = '♥';
        else if (card.suit === 'diamonds') suitIcon = '♦';
        else if (card.suit === 'clubs') suitIcon = '♣';
        else if (card.suit === 'spades') suitIcon = '♠';

        this.ctx.font = '24px serif';
        this.ctx.fillText(suitIcon, x + w/2, y + h/2 + 10);

        // Corner mini suit
        this.ctx.font = '14px serif';
        this.ctx.fillText(suitIcon, x + w - 15, y + 20);
    }

    drawHand(cards, centerX, y) {
        const totalW = cards.length * this.layout.cardWidth + (cards.length - 1) * this.layout.cardSpacing;
        let startX = centerX - totalW / 2;

        for (let i = 0; i < cards.length; i++) {
            this.drawCard(cards[i], startX + i * (this.layout.cardWidth + this.layout.cardSpacing), y);
        }
    }

    drawHUD(state, chips, bet, message) {
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 18px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`CHIPS: $${chips}`, 20, 30);
        this.ctx.fillText(`BET: $${bet}`, 20, 60);

        if (message) {
            this.ctx.fillStyle = '#ffd700';
            this.ctx.font = 'bold 24px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(message, this.width / 2, this.height / 2);
        }
    }

    drawControls(state, canDouble) {
        // We'll define buttons here, but hit detection is in input.js
        // Just drawing them.
        const y = this.layout.uiY;
        const btnW = 100;
        const btnH = 40;
        const gap = 20;

        if (state === 'BETTING') {
            // Bet Buttons
            this.drawButton('BET 10', this.width/2 - btnW/2, y, btnW, btnH, '#009688');
        } else if (state === 'PLAYER_TURN') {
            let x = this.width/2 - btnW - gap;
            this.drawButton('HIT', x, y, btnW, btnH, '#2196f3');
            x += btnW + gap;
            this.drawButton('STAND', x, y, btnW, btnH, '#f44336');

            if (canDouble) {
                x += btnW + gap;
                this.drawButton('DOUBLE', x, y, btnW, btnH, '#ff9800');
            }
        } else if (state === 'RESOLVE' || state === 'GAME_OVER') {
             this.drawButton('NEXT HAND', this.width/2 - btnW/2, y, btnW, btnH, '#4caf50');
        }
    }

    drawButton(text, x, y, w, h, color) {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, w, h, 8);
        this.ctx.fill();
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 16px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, x + w/2, y + h/2);
    }
}
