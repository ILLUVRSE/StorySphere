import { Server, Socket } from 'socket.io';
import { MatchManager } from '../matches/MatchManager';
import jwt from 'jsonwebtoken';
import { db } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

interface AuthSocket extends Socket {
    user?: any;
}

export function setupMatchSocket(io: Server, matchManager: MatchManager) {
    const matchNamespace = io.of('/matches');

    matchNamespace.use((socket: AuthSocket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next();
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (err) {
            return next(new Error("Invalid Token"));
        }
    });

    matchNamespace.on('connection', (socket: AuthSocket) => {
        socket.on('join_match', async ({ matchId, asPlayer }) => {
            socket.join(`match:${matchId}`);
            const userId = socket.user?.id || null;
            const result = await matchManager.joinMatch(socket.id, matchId, userId, asPlayer);

            // Result is { role, teamId } or null (if casted) or string (old)
            // Fix type handling
            const role = (typeof result === 'string') ? result : result?.role;
            const teamId = (typeof result === 'object') ? result?.teamId : null;

            if (asPlayer && !role) {
                socket.emit('error', { message: "Unauthorized" });
                return;
            }

            socket.emit('match_joined', { matchId, role: role || 'SPECTATOR', teamId });

            // Send Logs if in progress
            const match = matchManager.activeMatches.get(matchId);
            if (match && match.status !== 'lobby') {
                 if (db.isReady()) {
                    const logs = await db.query('SELECT * FROM event_logs WHERE match_id = $1 ORDER BY seq ASC', [matchId]);
                    socket.emit('replay', logs.rows);
                }
            } else {
                // If in lobby, send lobby state
                matchManager.broadcastLobbyState(matchId);
            }
        });

        socket.on('submit_lineup', ({ matchId, lineup }) => {
            if (!socket.user) return;
            matchManager.handleLineupSubmission(matchId, socket.user.id, lineup);
        });

        socket.on('start_match', ({ matchId }) => {
            if (!socket.user) return;
            matchManager.startMatch(matchId, socket.user.id);
        });

        socket.on('submit_input', ({ matchId, action }) => {
            if (!socket.user) return;
            matchManager.handleInput(matchId, socket.user.id, action);
        });

        socket.on('disconnect', () => {
             // Handle cleanup if needed
        });
    });
}
