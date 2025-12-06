import { calculateHandValue } from './engine.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        // Layout constants
        this.layout = {
            dealerY: this.height * 0.15,
            playerY: this.height * 0.55,
            cardWidth: 60,
            cardHeight: 90,
            cardSpacing: 20,
            uiY: this.height * 0.88,
            chipY: this.height * 0.75,
            chipRadius: 30
        };

        // Cache button regions for hit testing
        this.buttons = [];
    }

    clear() {
        this.buttons = []; // Reset hit regions

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

    drawHUD(ctxData) {
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 18px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`CHIPS: $${ctxData.chips}`, 20, 30);
        this.ctx.fillText(`BET: $${ctxData.bet}`, 20, 60);

        if (ctxData.message) {
            this.ctx.fillStyle = '#ffd700';
            this.ctx.font = 'bold 24px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(ctxData.message, this.width / 2, this.height / 2);
        }
    }

    drawTable(ctxData) {
        // Dealer Hand
        if (ctxData.dealerHand.length > 0) {
            this.drawHand(ctxData.dealerHand, this.width/2, this.layout.dealerY, false);

            // Dealer Value (hide if hole card down)
            let dVal = "?";
            if (ctxData.dealerHand.every(c => c.faceUp)) {
                dVal = calculateHandValue(ctxData.dealerHand);
            }
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '16px monospace';
            this.ctx.fillText(dVal, this.width/2, this.layout.dealerY + 110);
        }

        // Player Hands
        const hands = ctxData.hands;
        const handCount = hands.length;
        if (handCount === 0) return;

        // Calculate spacing
        // Available width approx 80% of screen
        const availableWidth = this.width * 0.9;
        const spacing = availableWidth / (handCount + 1);

        hands.forEach((hand, index) => {
            // Center X for this hand
            // If 1 hand: width/2
            // If 2 hands: width/3, 2*width/3
            // General: spacing * (index + 1) ? No, that centers in segments.
            // Let's use specific offsets.
            let x;
            if (handCount === 1) x = this.width / 2;
            else {
                const startX = (this.width - (handCount - 1) * 200) / 2; // Rough estimate width per hand
                // Actually simpler: spread evenly around center
                const totalSpan = (handCount - 1) * 160;
                x = (this.width / 2) - (totalSpan / 2) + (index * 160);
            }

            // Highlight active hand
            const isActive = index === ctxData.currentHandIndex;

            if (isActive && ctxData.state === 'PLAYER_TURN') {
                this.ctx.shadowColor = '#ffd700';
                this.ctx.shadowBlur = 15;
            }

            this.drawHand(hand.cards, x, this.layout.playerY, isActive);

            this.ctx.shadowBlur = 0;

            // Hand Info (Bet & Value)
            const val = calculateHandValue(hand.cards);
            this.ctx.fillStyle = isActive ? '#ffd700' : '#fff';
            this.ctx.font = '16px monospace';
            this.ctx.fillText(`${val}`, x, this.layout.playerY + 110);
            this.ctx.fillStyle = '#bbb';
            this.ctx.fillText(`$${hand.bet}`, x, this.layout.playerY + 130);

            if (hand.status !== 'PLAYING') {
                this.ctx.fillStyle = '#ff5252';
                this.ctx.font = 'bold 14px sans-serif';
                this.ctx.fillText(hand.status, x, this.layout.playerY - 20);
            }
            if (hand.result) {
                const color = hand.result === 'WIN' || hand.result === 'BLACKJACK' ? '#69f0ae' :
                              hand.result === 'PUSH' ? '#ffe082' : '#ff5252';
                this.ctx.fillStyle = color;
                this.ctx.font = 'bold 20px sans-serif';
                this.ctx.fillText(hand.result, x, this.layout.playerY + 50);
            }
        });
    }

    drawHand(cards, centerX, y, isActive) {
        // Simple overlapping fan
        const overlap = 25;
        const totalWidth = this.layout.cardWidth + (cards.length - 1) * overlap;
        let startX = centerX - totalWidth / 2;

        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const targetX = startX + i * overlap;
            const targetY = y;

            // Animation Logic (Immediate Mode Lerp)
            if (card.x === 0 && card.y === 0) {
                // Initialize off-screen (Deck position assumption: Top Right)
                card.x = this.width - 50;
                card.y = -100;
            }

            // Lerp towards target
            // Speed 0.15 is snappy but smooth
            const speed = 0.15;
            const dist = Math.abs(targetX - card.x) + Math.abs(targetY - card.y);

            if (dist < 1) {
                card.x = targetX;
                card.y = targetY;
            } else {
                card.x += (targetX - card.x) * speed;
                card.y += (targetY - card.y) * speed;
            }

            this.drawCard(card, card.x, card.y);
        }
    }

    drawCard(card, x, y) {
        const w = this.layout.cardWidth;
        const h = this.layout.cardHeight;
        const r = 6;

        this.ctx.save();

        // Shadow
        this.ctx.shadowColor = 'rgba(0,0,0,0.3)';
        this.ctx.shadowBlur = 4;
        this.ctx.shadowOffsetY = 2;

        if (!card.faceUp) {
            // Back
            this.ctx.fillStyle = '#b71c1c';
            this.ctx.beginPath();
            this.ctx.roundRect(x, y, w, h, r);
            this.ctx.fill();
            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = '#fff';
            this.ctx.stroke();
            // Pattern center
            this.ctx.fillStyle = '#d32f2f';
            this.ctx.beginPath();
            this.ctx.arc(x+w/2, y+h/2, 12, 0, Math.PI*2);
            this.ctx.fill();
        } else {
            // Face
            this.ctx.fillStyle = '#f5f5f5';
            this.ctx.beginPath();
            this.ctx.roundRect(x, y, w, h, r);
            this.ctx.fill();
            this.ctx.lineWidth = 1;
            this.ctx.strokeStyle = '#999';
            this.ctx.stroke();

            this.ctx.shadowColor = 'transparent';

            const isRed = ['hearts', 'diamonds'].includes(card.suit);
            this.ctx.fillStyle = isRed ? '#d32f2f' : '#212121';

            // Rank
            this.ctx.font = 'bold 18px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(card.rank, x + 15, y + 20);

            // Suit Center
            let suitChar = '';
            if (card.suit === 'hearts') suitChar = '♥';
            else if (card.suit === 'diamonds') suitChar = '♦';
            else if (card.suit === 'clubs') suitChar = '♣';
            else if (card.suit === 'spades') suitChar = '♠';

            this.ctx.font = '32px serif';
            this.ctx.fillText(suitChar, x + w/2, y + h/2 + 5);
        }
        this.ctx.restore();
    }

    drawBettingControls(chipValues, userChips, currentBet) {
        const y = this.layout.chipY;
        const r = this.layout.chipRadius;
        const gap = 15;
        const totalW = chipValues.length * (r*2) + (chipValues.length-1)*gap;
        let startX = (this.width - totalW) / 2 + r;

        // Draw Chips
        chipValues.forEach((val, i) => {
            const cx = startX + i * (r*2 + gap);
            const color = val === 10 ? '#42a5f5' : val === 50 ? '#ef5350' : val === 100 ? '#66bb6a' : '#263238';

            // Draw Chip Circle
            this.ctx.beginPath();
            this.ctx.arc(cx, y, r, 0, Math.PI*2);
            this.ctx.fillStyle = color;
            this.ctx.fill();
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            this.ctx.lineWidth = 1;
            this.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            this.ctx.beginPath();
            this.ctx.arc(cx, y, r-5, 0, Math.PI*2);
            this.ctx.stroke();

            // Text
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 14px sans-serif';
            this.ctx.fillText(val, cx, y);

            // Hit Region
            this.buttons.push({
                name: 'chip',
                value: val,
                x: cx - r, y: y - r, w: r*2, h: r*2,
                type: 'circle', r: r, cx: cx, cy: y
            });
        });

        // Action Buttons (Clear, Deal)
        const btnY = this.layout.uiY;
        const btnW = 100;
        const btnH = 45;

        // Clear
        if (currentBet > 0) {
            this.drawButton('CLEAR', this.width/2 - btnW - 10, btnY, btnW, btnH, '#ff9800');
            this.buttons.push({ name: 'clear', x: this.width/2 - btnW - 10, y: btnY, w: btnW, h: btnH });

            this.drawButton('DEAL', this.width/2 + 10, btnY, btnW, btnH, '#4caf50');
            this.buttons.push({ name: 'deal', x: this.width/2 + 10, y: btnY, w: btnW, h: btnH });
        } else {
             this.ctx.fillStyle = '#aaa';
             this.ctx.font = '16px sans-serif';
             this.ctx.fillText("Select chips to bet", this.width/2, btnY + 20);
        }
    }

    drawControls(state, actions) {
        const y = this.layout.uiY;
        const btnW = 90;
        const btnH = 40;
        const gap = 10;

        let activeButtons = [];

        if (state === 'PLAYER_TURN') {
            if (actions.canHit) activeButtons.push({ text: 'HIT', color: '#2196f3' });
            if (actions.canStand) activeButtons.push({ text: 'STAND', color: '#f44336' });
            if (actions.canDouble) activeButtons.push({ text: 'DOUBLE', color: '#ff9800' });
            if (actions.canSplit) activeButtons.push({ text: 'SPLIT', color: '#9c27b0' });
        } else if (state === 'INSURANCE') {
            activeButtons.push({ text: 'YES', color: '#4caf50' });
            activeButtons.push({ text: 'NO', color: '#f44336' });
        } else if (state === 'RESOLVE' || state === 'GAME_OVER') {
            activeButtons.push({ text: 'NEXT', color: '#4caf50' });
        }

        const totalW = activeButtons.length * btnW + (activeButtons.length - 1) * gap;
        let x = (this.width - totalW) / 2;

        activeButtons.forEach(btn => {
            this.drawButton(btn.text, x, y, btnW, btnH, btn.color);
            this.buttons.push({ name: btn.text, x, y, w: btnW, h: btnH });
            x += btnW + gap;
        });
    }

    drawButton(text, x, y, w, h, color) {
        this.ctx.fillStyle = color;
        this.ctx.shadowColor = 'rgba(0,0,0,0.2)';
        this.ctx.shadowBlur = 4;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, w, h, 8);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 16px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, x + w/2, y + h/2);
    }

    // Hit Testing
    hitTestChips(pos, chipValues) {
        for (const btn of this.buttons) {
            if (btn.type === 'circle') {
                const dx = pos.x - btn.cx;
                const dy = pos.y - btn.cy;
                if (dx*dx + dy*dy <= btn.r * btn.r) return btn.value;
            } else {
                if (pos.x >= btn.x && pos.x <= btn.x + btn.w &&
                    pos.y >= btn.y && pos.y <= btn.y + btn.h) {
                    if (btn.name === 'clear') return 'clear';
                    if (btn.name === 'deal') return 'deal';
                }
            }
        }
        return null;
    }

    hitTestControls(pos) {
        for (const btn of this.buttons) {
            if (btn.name === 'chip' || btn.name === 'clear' || btn.name === 'deal') continue;
            if (pos.x >= btn.x && pos.x <= btn.x + btn.w &&
                pos.y >= btn.y && pos.y <= btn.y + btn.h) {
                return btn.name;
            }
        }
        return null;
    }
}
