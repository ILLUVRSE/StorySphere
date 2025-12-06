import { CONFIG } from './config.js';

export const PIECE = {
    EMPTY: 0,
    P1: 1,
    P1_KING: 2,
    P2: -1,
    P2_KING: -2
};

export class CheckersEngine {
    constructor() {
        this.board = this.createBoard();
        this.turn = PIECE.P1; // P1 starts (Red/Teal - usually plays first in some variants, or White. We'll say P1 is "Bottom" player)
        this.winner = null;
        this.movesWithoutCapture = 0;
        this.history = [];
        this.mandatoryCaptures = CONFIG.MANDATORY_CAPTURES;
    }

    createBoard() {
        const board = Array(8).fill(0).map(() => Array(8).fill(0));
        // Setup initial pieces
        // P2 (Top) = Negative
        // P1 (Bottom) = Positive
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if ((r + c) % 2 === 1) { // Dark squares only
                    if (r < 3) board[r][c] = PIECE.P2;
                    else if (r > 4) board[r][c] = PIECE.P1;
                }
            }
        }
        return board;
    }

    // Deep copy of the board
    cloneBoard(board) {
        return board.map(row => [...row]);
    }

    reset() {
        this.board = this.createBoard();
        this.turn = PIECE.P1;
        this.winner = null;
        this.movesWithoutCapture = 0;
        this.history = [];
    }

    switchTurn() {
        this.turn = this.turn > 0 ? PIECE.P2 : PIECE.P1;
    }

    // Check bounds
    isValidPos(r, c) {
        return r >= 0 && r < 8 && c >= 0 && c < 8;
    }

    getPiece(board, r, c) {
        if (!this.isValidPos(r, c)) return null;
        return board[r][c];
    }

    isPlayerPiece(piece, player) {
        if (piece === 0) return false;
        return (player > 0 && piece > 0) || (player < 0 && piece < 0);
    }

    isKing(piece) {
        return Math.abs(piece) === 2;
    }

    // Move Generator
    // Returns: Array of { from: {r,c}, to: {r,c}, jumps: [{r,c}], captured: [{r,c}] }
    getLegalMoves(board, player) {
        let moves = [];
        let captureMoves = [];

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (this.isPlayerPiece(piece, player)) {
                    // Check jumps (captures)
                    const jumps = this.findJumps(board, r, c, piece, []);
                    if (jumps.length > 0) {
                        captureMoves.push(...jumps);
                    }

                    // Check simple moves (only if no captures found yet OR we want to collect all to filter later)
                    // Optimization: If mandatory captures, we don't strictly need simple moves if captures exist.
                    // But we'll collect separately first.
                }
            }
        }

        // If captures exist and are mandatory
        if (this.mandatoryCaptures && captureMoves.length > 0) {
            // Optional: Filter for longest chain here if that rule was enabled (User said MVP just mandatory)
            return captureMoves;
        }

        // If no captures (or not mandatory), find simple moves
        if (!this.mandatoryCaptures || captureMoves.length === 0) {
             for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const piece = board[r][c];
                    if (this.isPlayerPiece(piece, player)) {
                        const simple = this.findSimpleMoves(board, r, c, piece);
                        moves.push(...simple);
                    }
                }
            }
            return [...captureMoves, ...moves];
        }

        return captureMoves;
    }

    findSimpleMoves(board, r, c, piece) {
        const moves = [];
        const isKing = this.isKing(piece);
        const player = piece > 0 ? 1 : -1;

        // Directions: P1 moves UP (-1), P2 moves DOWN (+1). Kings move both.
        const dirs = [];
        if (player === 1 || isKing) dirs.push([-1, -1], [-1, 1]); // Up-Left, Up-Right
        if (player === -1 || isKing) dirs.push([1, -1], [1, 1]);   // Down-Left, Down-Right

        for (const [dr, dc] of dirs) {
            const nr = r + dr;
            const nc = c + dc;
            if (this.isValidPos(nr, nc) && board[nr][nc] === PIECE.EMPTY) {
                moves.push({
                    from: { r, c },
                    to: { r: nr, c: nc },
                    jumps: [],
                    captured: []
                });
            }
        }
        return moves;
    }

    findJumps(board, r, c, piece, currentPath) {
        const jumps = [];
        const isKing = this.isKing(piece);
        const player = piece > 0 ? 1 : -1;

        const dirs = [];
        if (player === 1 || isKing) dirs.push([-1, -1], [-1, 1]);
        if (player === -1 || isKing) dirs.push([1, -1], [1, 1]);

        let foundJump = false;

        for (const [dr, dc] of dirs) {
            const midR = r + dr;
            const midC = c + dc;
            const destR = r + dr * 2;
            const destC = c + dc * 2;

            if (this.isValidPos(destR, destC)) {
                const midPiece = board[midR][midC];
                const destPiece = board[destR][destC];

                // Check if we are jumping an enemy
                if (midPiece !== PIECE.EMPTY && !this.isPlayerPiece(midPiece, player) && destPiece === PIECE.EMPTY) {
                     // Check if this enemy has already been captured in this sequence (prevent loops/backtracking over same piece)
                     const alreadyCaptured = currentPath.some(step => step.captured && step.captured.r === midR && step.captured.c === midC);
                     if (!alreadyCaptured) {
                         foundJump = true;

                         // Speculative move
                         const nextPath = [
                             ...currentPath,
                             { to: {r: destR, c: destC}, captured: {r: midR, c: midC} }
                         ];

                         // Recurse for multi-jumps
                         // Note: We simulate the board state for recursion?
                         // Actually, standard checkers allows jumping from the new position.
                         // But we must remove the piece temporarily to avoid re-jumping it, or just track it?
                         // "The captured piece is removed only at the end of the turn" - Official rules vary.
                         // Standard rule: Piece remains until turn ends, but cannot be jumped again.

                         // Deep recursion requires a modified board or careful tracking.
                         // Let's use a temporary board modification for the recursion scope.
                         const tempBoard = this.cloneBoard(board);
                         tempBoard[r][c] = PIECE.EMPTY; // Moved from here
                         tempBoard[destR][destC] = piece; // Landed here
                         // We do NOT remove the captured piece yet for obstruction purposes?
                         // Actually in most checkers, you cannot jump the same piece twice, but it is effectively "gone".
                         // However, if we don't remove it, we can't jump OVER it again (which is true).
                         // But we definitely can't land on it.
                         // To simplify: Mark captured piece as empty in temp board for pathfinding?
                         // No, usually it stays but is marked 'captured'.
                         // Let's just track captured coordinates.

                         const subJumps = this.findJumps(tempBoard, destR, destC, piece, nextPath);

                         if (subJumps.length > 0) {
                             jumps.push(...subJumps);
                         } else {
                             // No more jumps, this is a terminal node of the chain
                             jumps.push({
                                 from: currentPath.length === 0 ? {r,c} : currentPath[0].from, // Keep original origin
                                 to: {r: destR, c: destC},
                                 jumps: nextPath.map(p => p.to), // All landing spots
                                 captured: nextPath.map(p => p.captured) // All captured pieces
                             });
                         }
                     }
                }
            }
        }

        return jumps;
    }

    applyMove(board, move) {
        const newBoard = this.cloneBoard(board);
        const { from, to, captured } = move;
        const piece = newBoard[from.r][from.c];

        newBoard[from.r][from.c] = PIECE.EMPTY;
        newBoard[to.r][to.c] = piece;

        // Remove captured
        if (captured && captured.length > 0) {
            captured.forEach(pos => {
                newBoard[pos.r][pos.c] = PIECE.EMPTY;
            });
            this.movesWithoutCapture = 0;
        } else {
            this.movesWithoutCapture++;
        }

        // Promotion
        // P1 promotes at row 0, P2 promotes at row 7
        if (piece === PIECE.P1 && to.r === 0) {
            newBoard[to.r][to.c] = PIECE.P1_KING;
        } else if (piece === PIECE.P2 && to.r === 7) {
            newBoard[to.r][to.c] = PIECE.P2_KING;
        }

        return newBoard;
    }

    checkWin(board, player) {
        // Opponent
        const opponent = player > 0 ? -1 : 1;

        // 1. Check if opponent has pieces
        let hasPieces = false;
        for(let r=0; r<8; r++) {
            for(let c=0; c<8; c++) {
                if (this.isPlayerPiece(board[r][c], opponent)) {
                    hasPieces = true;
                    break;
                }
            }
            if(hasPieces) break;
        }
        if (!hasPieces) return player; // Player wins

        // 2. Check if opponent has moves
        const opponentMoves = this.getLegalMoves(board, opponent);
        if (opponentMoves.length === 0) return player; // Player wins

        // 3. Draw conditions (simple for MVP)
        if (this.movesWithoutCapture >= 40) return 0; // Draw

        return null; // No winner yet
    }

    // Main interaction method
    makeMove(move) {
        this.board = this.applyMove(this.board, move);

        // Check result
        const result = this.checkWin(this.board, this.turn);
        if (result !== null) {
            this.winner = result;
            return { gameOver: true, winner: this.winner };
        }

        this.switchTurn();
        return { gameOver: false };
    }
}
