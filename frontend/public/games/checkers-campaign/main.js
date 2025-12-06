import { CheckersEngine, PIECE } from './engine.js';
import { CheckersRenderer } from './renderer.js';
import { InputHandler } from './input.js';
import { Bridge } from './bridge.js';
import { CONFIG } from './config.js';

class Game {
    constructor() {
        this.engine = new CheckersEngine();
        this.renderer = new CheckersRenderer(document.getElementById('game-canvas'));
        this.bridge = new Bridge();
        this.input = new InputHandler(document.getElementById('game-canvas'), this);

        this.aiWorker = new Worker('ai.js');
        this.aiWorker.onmessage = (e) => this.onAiMessage(e);

        this.gameState = 'MENU'; // MENU, PLAYING, GAMEOVER
        this.selectedPos = null;
        this.validMoves = [];
        this.lastMove = null;

        this.startTime = 0;
        this.timerInterval = null;

        this.difficulty = CONFIG.AI_DEPTH_MEDIUM;
        this.gameMode = 'AI'; // 'AI' or 'LOCAL'

        this.initUI();

        // Loop
        requestAnimationFrame(() => this.loop());

        // Check for saved theme
        const savedTheme = localStorage.getItem('checkers-theme');
        if(savedTheme && CONFIG.THEMES[savedTheme]) {
            CONFIG.THEME = savedTheme;
            this.renderer.setTheme(savedTheme);
            document.getElementById('theme-toggle').checked = (savedTheme === 'CLASSIC');
        }

        this.bridge.notifyReady();
        this.showMenu();
    }

    initUI() {
        document.getElementById('start-easy-btn').onclick = () => this.startGame('AI', CONFIG.AI_DEPTH_EASY);
        document.getElementById('start-medium-btn').onclick = () => this.startGame('AI', CONFIG.AI_DEPTH_MEDIUM);
        document.getElementById('start-hard-btn').onclick = () => this.startGame('AI', CONFIG.AI_DEPTH_HARD);
        document.getElementById('local-pvp-btn').onclick = () => this.startGame('LOCAL', 0);

        document.getElementById('menu-btn').onclick = () => this.showMenu();
        document.getElementById('undo-btn').onclick = () => this.undo(); // MVP optional, implemented simply?

        document.getElementById('theme-toggle').onchange = (e) => {
            const theme = e.target.checked ? 'CLASSIC' : 'TEAL';
            CONFIG.THEME = theme;
            this.renderer.setTheme(theme);
            localStorage.setItem('checkers-theme', theme);
        };
    }

    showMenu() {
        this.gameState = 'MENU';
        document.getElementById('message-overlay').classList.remove('hidden');
        document.getElementById('message-overlay').style.display = 'block';
        document.getElementById('message-title').innerText = "CHECKERS";
        document.getElementById('message-text').innerText = "Select a mode";
        clearInterval(this.timerInterval);
    }

    startGame(mode, difficulty) {
        this.gameMode = mode;
        this.difficulty = difficulty;
        this.engine.reset();
        this.gameState = 'PLAYING';
        this.selectedPos = null;
        this.validMoves = [];
        this.lastMove = null;

        this.startTime = Date.now();

        document.getElementById('message-overlay').classList.add('hidden');
        document.getElementById('message-overlay').style.display = 'none';

        // Undo support (simple history)
        this.historyStack = [];

        this.updateHUD();
        this.startTimer();

        // If AI is P1 (never happens in this setup, Player is P1), but if we swapped sides...
        // Currently P1 is Player (Bottom).
    }

    startTimer() {
        clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (this.gameState !== 'PLAYING') return;
            this.updateHUD();
        }, 1000);
    }

    updateHUD() {
        const elapsed = Date.now() - this.startTime;
        const remaining = Math.max(0, CONFIG.PAR_TIME_MS - elapsed);

        const min = Math.floor(remaining / 60000);
        const sec = Math.floor((remaining % 60000) / 1000);
        document.getElementById('timer-display').innerText = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;

        // Score preview?
        // document.getElementById('score-display').innerText = ...
    }

    loop() {
        this.renderer.draw(this.engine.board, this.validMoves, this.selectedPos, this.lastMove);
        requestAnimationFrame(() => this.loop());
    }

    // Input Hooks
    onInteractStart(pos) {
        if (this.gameState !== 'PLAYING') return;

        // If it's AI turn, ignore input
        if (this.gameMode === 'AI' && this.engine.turn === PIECE.P2) return;

        const piece = this.engine.getPiece(this.engine.board, pos.r, pos.c);

        // Select piece if it belongs to current player
        if (this.engine.isPlayerPiece(piece, this.engine.turn)) {
            this.selectedPos = pos;

            // Generate legal moves for this piece
            const allMoves = this.engine.getLegalMoves(this.engine.board, this.engine.turn);
            // Filter moves starting from this position
            this.validMoves = allMoves.filter(m => m.from.r === pos.r && m.from.c === pos.c);
        } else if (this.selectedPos) {
            // If clicking empty square while having selection -> attempt move
             const move = this.validMoves.find(m => m.to.r === pos.r && m.to.c === pos.c);
             if (move) {
                 this.executeMove(move);
             } else {
                 // Deselect if invalid click
                 this.selectedPos = null;
                 this.validMoves = [];
             }
        }
    }

    onInteractEnd(pos) {
        // Handle Drop
        if (this.gameState !== 'PLAYING') return;
        if (this.selectedPos && (pos.r !== this.selectedPos.r || pos.c !== this.selectedPos.c)) {
             const move = this.validMoves.find(m => m.to.r === pos.r && m.to.c === pos.c);
             if (move) {
                 this.executeMove(move);
             }
             // Don't deselect automatically if invalid drop?
             // Usually better to let user correct or click elsewhere.
        }
    }

    executeMove(move) {
        // Save state for undo
        this.historyStack.push(this.engine.cloneBoard(this.engine.board));

        const result = this.engine.makeMove(move);
        this.lastMove = move;
        this.selectedPos = null;
        this.validMoves = [];

        if (result.gameOver) {
            this.endGame(result.winner);
        } else {
            // Next Turn
            if (this.gameMode === 'AI' && this.engine.turn === PIECE.P2) {
                // Trigger AI
                setTimeout(() => this.triggerAi(), 500);
            }
        }
    }

    triggerAi() {
        this.aiWorker.postMessage({
            type: 'compute',
            board: this.engine.board,
            player: this.engine.turn,
            maxTimeMs: CONFIG.MOVE_TIME_LIMIT_MS,
            depthHint: this.difficulty
        });
    }

    onAiMessage(e) {
        const { type, move } = e.data;
        if (type === 'done' && move) {
            this.executeMove(move);
        } else if (type === 'done' && !move) {
            // AI has no moves? Should be caught by engine checkWin but double check
            const res = this.engine.checkWin(this.engine.board, this.engine.turn);
            if (res !== null) this.endGame(res);
        }
    }

    undo() {
        if (this.gameState !== 'PLAYING') return;
        if (this.historyStack.length > 0) {
            // If vs AI, undo 2 steps (AI + Player)
            if (this.gameMode === 'AI') {
                if (this.historyStack.length >= 2) {
                    this.historyStack.pop(); // AI move
                    this.engine.board = this.historyStack.pop(); // Player move
                    this.engine.turn = PIECE.P1; // Reset to player
                }
            } else {
                this.engine.board = this.historyStack.pop();
                this.engine.switchTurn(); // Revert turn
            }
            this.selectedPos = null;
            this.validMoves = [];
            this.lastMove = null;
        }
    }

    endGame(winner) {
        this.gameState = 'GAMEOVER';
        clearInterval(this.timerInterval);

        let score = 0;
        const elapsed = Date.now() - this.startTime;
        const remaining = Math.max(0, CONFIG.PAR_TIME_MS - elapsed);

        // Calculate Material
        let materialAdvantage = 0;
        // P1 is positive
        let p1Score = 0;
        let p2Score = 0;

        for(let r=0; r<8; r++) {
            for(let c=0; c<8; c++) {
                const p = this.engine.board[r][c];
                if(p > 0) p1Score += (p === 2 ? 3 : 1);
                if(p < 0) p2Score += (p === -2 ? 3 : 1);
            }
        }

        if (winner === PIECE.P1) {
            materialAdvantage = p1Score - p2Score; // Should be positive
            score = CONFIG.SCORE_WIN_BASE + (remaining * CONFIG.SCORE_TIME_FACTOR) + (materialAdvantage * CONFIG.SCORE_MATERIAL_FACTOR);
        } else if (winner === 0) {
            // Draw
            materialAdvantage = p1Score - p2Score;
            score = materialAdvantage * CONFIG.SCORE_DRAW_FACTOR; // Can be negative
        } else {
            // Loss
            materialAdvantage = p1Score - p2Score; // Likely negative
            score = materialAdvantage * CONFIG.SCORE_DRAW_FACTOR; // Punishment
        }

        score = Math.floor(score);

        const msg = winner === PIECE.P1 ? "YOU WIN!" : (winner === 0 ? "DRAW" : "GAME OVER");

        document.getElementById('message-overlay').style.display = 'block';
        document.getElementById('message-overlay').classList.remove('hidden');
        document.getElementById('message-title').innerText = msg;
        document.getElementById('message-text').innerText = `Score: ${score}`;

        this.bridge.submitScore(score, {
            movesMade: this.engine.movesWithoutCapture, // TODO: track total moves?
            difficulty: this.difficulty,
            variant: 'standard',
            winner: winner
        });
    }
}

// Start
new Game();
