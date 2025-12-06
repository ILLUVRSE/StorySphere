// AI Worker for Checkers
// Implements Minimax with Alpha-Beta Pruning and Iterative Deepening

// Helper to communicate
function post(type, data) {
    self.postMessage({ type, ...data });
}

// Config constants (will be received or defaults)
let MAX_TIME = 800; // ms
const INF = 1000000;

// Board Constants (must match engine)
const PIECE = {
    EMPTY: 0,
    P1: 1,       // Minimizer
    P1_KING: 2,
    P2: -1,      // Maximizer (AI)
    P2_KING: -2
};

// Utils (Duplicated from engine logic for performance in worker)
function isKing(piece) { return Math.abs(piece) === 2; }
function isPlayerPiece(piece, player) { return (player > 0 && piece > 0) || (player < 0 && piece < 0); }
function isValidPos(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function cloneBoard(board) { return board.map(row => [...row]); }

// Move Generator (Simplified/Copied from Engine)
// Note: We need the full logic including mandatory captures
function getLegalMoves(board, player) {
    // 1. Check captures
    const captureMoves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (isPlayerPiece(piece, player)) {
                captureMoves.push(...findJumps(board, r, c, piece, []));
            }
        }
    }

    if (captureMoves.length > 0) return captureMoves;

    // 2. Simple moves
    const simpleMoves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (isPlayerPiece(piece, player)) {
                simpleMoves.push(...findSimpleMoves(board, r, c, piece));
            }
        }
    }
    return simpleMoves;
}

function findSimpleMoves(board, r, c, piece) {
    const moves = [];
    const _isKing = isKing(piece);
    const player = piece > 0 ? 1 : -1;
    const dirs = [];
    if (player === 1 || _isKing) dirs.push([-1, -1], [-1, 1]);
    if (player === -1 || _isKing) dirs.push([1, -1], [1, 1]);

    for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (isValidPos(nr, nc) && board[nr][nc] === PIECE.EMPTY) {
            moves.push({ from: {r,c}, to: {r:nr, c:nc}, jumps:[], captured:[] });
        }
    }
    return moves;
}

function findJumps(board, r, c, piece, currentPath) {
    const jumps = [];
    const _isKing = isKing(piece);
    const player = piece > 0 ? 1 : -1;
    const dirs = [];
    if (player === 1 || _isKing) dirs.push([-1, -1], [-1, 1]);
    if (player === -1 || _isKing) dirs.push([1, -1], [1, 1]);

    for (const [dr, dc] of dirs) {
        const destR = r + dr * 2;
        const destC = c + dc * 2;
        if (isValidPos(destR, destC)) {
            const midR = r + dr;
            const midC = c + dc;
            const midPiece = board[midR][midC];
            const destPiece = board[destR][destC];

            if (midPiece !== PIECE.EMPTY && !isPlayerPiece(midPiece, player) && destPiece === PIECE.EMPTY) {
                 const alreadyCaptured = currentPath.some(step => step.captured && step.captured.r === midR && step.captured.c === midC);
                 if (!alreadyCaptured) {
                     const nextPath = [...currentPath, { to: {r: destR, c: destC}, captured: {r: midR, c: midC} }];

                     // Temp board logic for recursion
                     const tempBoard = cloneBoard(board);
                     tempBoard[r][c] = PIECE.EMPTY;
                     tempBoard[destR][destC] = piece;
                     // No need to remove captured for pathfinding logic as long as we don't re-jump same coord

                     const subJumps = findJumps(tempBoard, destR, destC, piece, nextPath);
                     if (subJumps.length > 0) jumps.push(...subJumps);
                     else jumps.push({
                         from: currentPath.length === 0 ? {r,c} : currentPath[0].from,
                         to: {r: destR, c: destC},
                         jumps: nextPath.map(p => p.to),
                         captured: nextPath.map(p => p.captured)
                     });
                 }
            }
        }
    }
    return jumps;
}

function applyMove(board, move) {
    const nb = cloneBoard(board);
    const { from, to, captured } = move;
    const piece = nb[from.r][from.c];
    nb[from.r][from.c] = PIECE.EMPTY;
    nb[to.r][to.c] = piece;

    if (captured) {
        captured.forEach(p => nb[p.r][p.c] = PIECE.EMPTY);
    }

    // Promotion
    if (piece === PIECE.P1 && to.r === 0) nb[to.r][to.c] = PIECE.P1_KING;
    else if (piece === PIECE.P2 && to.r === 7) nb[to.r][to.c] = PIECE.P2_KING;

    return nb;
}

// Evaluation Function
// P2 (AI) wants positive score. P1 (Player) wants negative.
// Wait, typically Max is AI.
// P2 pieces are Negative in board representation (-1, -2).
// So: Evaluation = (AI Score) - (Player Score)
function evaluate(board) {
    let score = 0;
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            const p = board[r][c];
            if (p === 0) continue;

            // Base value
            let val = 10;
            if (isKing(p)) val = 30;

            // Positioning (Central control + Advancement)
            // AI (P2, moves Down) -> advancement is r
            // Player (P1, moves Up) -> advancement is (7-r)
            if (p === PIECE.P2) val += r;
            else if (p === PIECE.P1) val += (7 - r);
            else if (p === PIECE.P2_KING) val += 5; // Slight bonus for king existence
            else if (p === PIECE.P1_KING) val += 5;

            // Add/Sub based on owner
            if (p < 0) score += val; // AI (P2)
            else score -= val;       // Player (P1)
        }
    }
    return score;
}

// Search
let startTime = 0;
let timeOut = false;

function minimax(board, depth, alpha, beta, maximizingPlayer) {
    if (performance.now() - startTime > MAX_TIME) {
        timeOut = true;
        return evaluate(board);
    }

    if (depth === 0) {
        return evaluate(board);
    }

    const player = maximizingPlayer ? PIECE.P2 : PIECE.P1;
    const moves = getLegalMoves(board, player);

    if (moves.length === 0) {
        // Game Over state
        // If maximizing player has no moves, they lose -> -Infinity
        return maximizingPlayer ? -INF : INF;
    }

    // Move Ordering: Prioritize captures
    moves.sort((a, b) => (b.captured ? b.captured.length : 0) - (a.captured ? a.captured.length : 0));

    if (maximizingPlayer) {
        let maxEval = -INF;
        for (const move of moves) {
            const nextBoard = applyMove(board, move);
            const ev = minimax(nextBoard, depth - 1, alpha, beta, false);
            maxEval = Math.max(maxEval, ev);
            alpha = Math.max(alpha, ev);
            if (beta <= alpha) break;
            if (timeOut) break;
        }
        return maxEval;
    } else {
        let minEval = INF;
        for (const move of moves) {
            const nextBoard = applyMove(board, move);
            const ev = minimax(nextBoard, depth - 1, alpha, beta, true);
            minEval = Math.min(minEval, ev);
            beta = Math.min(beta, ev);
            if (beta <= alpha) break;
            if (timeOut) break;
        }
        return minEval;
    }
}

// Main handler
self.onmessage = function(e) {
    const { type, board, player, maxTimeMs, depthHint } = e.data;
    if (type === 'compute') {
        MAX_TIME = maxTimeMs || 800;
        startTime = performance.now();
        timeOut = false;

        const startDepth = 1;
        const maxDepth = depthHint || 6;
        let bestMove = null;
        let bestScore = -INF;

        // Iterative Deepening
        for (let d = startDepth; d <= maxDepth; d++) {
            let currentBestMove = null;
            let currentBestScore = -INF;

            const moves = getLegalMoves(board, player); // Player should be P2 (-1) typically
            if (moves.length === 0) {
                break; // No moves
            }

            // Root level maximization
            let alpha = -INF;
            let beta = INF;

            // Move ordering at root
            moves.sort((a, b) => (b.captured ? b.captured.length : 0) - (a.captured ? a.captured.length : 0));

            for (const move of moves) {
                const nextBoard = applyMove(board, move);
                // Next is minimizer
                const score = minimax(nextBoard, d - 1, alpha, beta, false);

                if (score > currentBestScore) {
                    currentBestScore = score;
                    currentBestMove = move;
                }
                alpha = Math.max(alpha, score);

                if (timeOut) break;
            }

            if (!timeOut) {
                bestMove = currentBestMove;
                bestScore = currentBestScore;
                post('best', { move: bestMove, score: bestScore, depth: d });
            } else {
                break;
            }
        }

        post('done', { move: bestMove });
    }
};
