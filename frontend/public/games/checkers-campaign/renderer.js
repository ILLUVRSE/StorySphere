import { CONFIG } from './config.js';

export class CheckersRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.theme = CONFIG.THEMES[CONFIG.THEME] || CONFIG.THEMES.TEAL;
        this.tileSize = 0;
        this.pieces = []; // For animation if needed
        this.animations = [];

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    setTheme(themeName) {
        this.theme = CONFIG.THEMES[themeName] || CONFIG.THEMES.TEAL;
        this.draw(null, [], null); // Redraw immediately
    }

    resize() {
        const parent = this.canvas.parentElement;
        if (parent) {
            const size = Math.min(parent.clientWidth, parent.clientHeight);
            this.canvas.width = size;
            this.canvas.height = size;
            this.tileSize = size / 8;
            // Trigger redraw if needed, but usually game loop handles it
        }
    }

    draw(board, validMoves = [], selectedPos = null, lastMove = null) {
        if (!board) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawBoard(lastMove);
        this.drawHighlights(validMoves, selectedPos);
        this.drawPieces(board);
    }

    drawBoard(lastMove) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const isDark = (r + c) % 2 === 1;
                this.ctx.fillStyle = isDark ? this.theme.boardDark : this.theme.boardLight;
                this.ctx.fillRect(c * this.tileSize, r * this.tileSize, this.tileSize, this.tileSize);

                // Highlight last move
                if (lastMove && isDark) {
                    // Highlight 'from' and 'to'
                    if ((lastMove.from.r === r && lastMove.from.c === c) ||
                        (lastMove.to.r === r && lastMove.to.c === c)) {
                        this.ctx.fillStyle = this.theme.lastMove;
                        this.ctx.fillRect(c * this.tileSize, r * this.tileSize, this.tileSize, this.tileSize);
                    }
                }
            }
        }
    }

    drawHighlights(validMoves, selectedPos) {
        // Highlight selected piece
        if (selectedPos) {
            this.ctx.fillStyle = this.theme.highlight;
            this.ctx.fillRect(selectedPos.c * this.tileSize, selectedPos.r * this.tileSize, this.tileSize, this.tileSize);
        }

        // Highlight valid destinations
        this.ctx.fillStyle = this.theme.validMove;
        for (const move of validMoves) {
            const cx = move.to.c * this.tileSize + this.tileSize / 2;
            const cy = move.to.r * this.tileSize + this.tileSize / 2;

            this.ctx.beginPath();
            this.ctx.arc(cx, cy, this.tileSize * 0.15, 0, Math.PI * 2);
            this.ctx.fill();

            // Optional: Draw path for multi-jumps
            if (move.jumps && move.jumps.length > 0) {
                 this.ctx.strokeStyle = this.theme.validMove;
                 this.ctx.lineWidth = 4;
                 this.ctx.beginPath();
                 let currR = selectedPos.r;
                 let currC = selectedPos.c;

                 // Trace path
                 // Note: move.jumps contains intermediate landing spots.
                 // We need to trace from start -> jump1 -> jump2 -> ... -> final
                 // Actually move.jumps is JUST intermediate steps.
                 // Wait, engine logic: jumps: nextPath.map(p => p.to)
                 // So it includes ALL landing spots in sequence.

                 this.ctx.moveTo(currC * this.tileSize + this.tileSize/2, currR * this.tileSize + this.tileSize/2);

                 move.jumps.forEach(pos => {
                     this.ctx.lineTo(pos.c * this.tileSize + this.tileSize/2, pos.r * this.tileSize + this.tileSize/2);
                 });
                 // Finally to destination
                 this.ctx.lineTo(move.to.c * this.tileSize + this.tileSize/2, move.to.r * this.tileSize + this.tileSize/2);
                 this.ctx.stroke();
            }
        }
    }

    drawPieces(board) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (piece !== 0) {
                    this.drawPiece(r, c, piece);
                }
            }
        }
    }

    drawPiece(r, c, piece) {
        const x = c * this.tileSize + this.tileSize / 2;
        const y = r * this.tileSize + this.tileSize / 2;
        const radius = this.tileSize * 0.35;

        const isP1 = piece > 0;
        const isKing = Math.abs(piece) === 2;

        this.ctx.fillStyle = isP1 ? this.theme.p1 : this.theme.p2;

        // Shadow
        this.ctx.beginPath();
        this.ctx.arc(x, y + 2, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this.ctx.fill();

        // Main Body
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = isP1 ? this.theme.p1 : this.theme.p2;
        this.ctx.fill();

        // Inner detail
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // King Crown
        if (isKing) {
            this.ctx.fillStyle = '#FFD700'; // Gold
            this.ctx.font = `${this.tileSize * 0.4}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('👑', x, y + 2);
            // Or simple circle if emoji not supported well in canvas
            // this.ctx.beginPath();
            // this.ctx.arc(x, y, radius * 0.3, 0, Math.PI*2);
            // this.ctx.fill();
        }
    }
}
