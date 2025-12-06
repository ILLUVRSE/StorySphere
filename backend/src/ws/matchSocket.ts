import { Server, Socket } from 'socket.io';
import { MatchManager } from '../matches/MatchManager';
import { CampaignManager } from '../services/CampaignManager';
import jwt from 'jsonwebtoken';
import { db } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

interface AuthSocket extends Socket {
    user?: any;
}

export function setupMatchSocket(io: Server, matchManager: MatchManager, campaignManager: CampaignManager) {
    const matchNamespace = io.of('/matches');

    // Inject IO into managers
    matchManager.setIo(io);
    campaignManager.setIo(io);

    matchNamespace.use((socket: AuthSocket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            // Allow anon
            return next();
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (err) {
            return next(new Error("Invalid Token"));
        }
    });

    matchNamespace.on('connection', (socket: AuthSocket) => {
        console.log(`Socket connected to /matches: ${socket.id}, User: ${socket.user?.id || 'Anon'}`);

        socket.on('join_match', async ({ matchId, asPlayer }) => {
            // Join Room
            socket.join(`match:${matchId}`);

            const userId = socket.user?.id || null;

            // Determine type (Optimization: Cache this or let managers try)
            // For now, try MatchManager first (Baseball), then Campaign
            let role = await matchManager.joinMatch(socket.id, matchId, userId, asPlayer);
            let type = 'baseball';

            if (!role) {
                // Try Campaign
                role = await campaignManager.joinMatch(socket.id, matchId, userId);
                type = 'campaign';
            }

            if (asPlayer && !role) {
                socket.emit('error', { message: "Unauthorized to join as player or match load failed" });
                return;
            }

            socket.emit('match_joined', { matchId, role: role || 'SPECTATOR', type });

            if (type === 'baseball') {
                const lobbyState = matchManager.getLobbyState(matchId);
                if (lobbyState) socket.emit('lobby_state', lobbyState);
            }

            // Replay logic handles both if event_logs used
            if (db.isReady()) {
                const logs = await db.query('SELECT * FROM event_logs WHERE match_id = $1 ORDER BY seq ASC', [matchId]);
                if (logs.rows.length > 0) {
                     socket.emit('replay', logs.rows);
                }
            }
        });

        // --- Baseball Events ---
        socket.on('submit_lineup', ({ matchId, battingOrder, bench, startingPitcher }) => {
            if (!socket.user) return;
            matchManager.handleLineupSubmission(matchId, socket.user.id, { battingOrder, bench, startingPitcher });
        });

        socket.on('update_mode', ({ matchId, mode }) => {
            if (!socket.user) return;
            matchManager.handleModeUpdate(matchId, socket.user.id, mode);
        });

        socket.on('start_match', ({ matchId }) => {
             if (!socket.user) return;
             matchManager.startMatch(matchId, socket.user.id);
        });

        socket.on('submit_input', ({ matchId, action }) => {
            if (!socket.user) return;
            // Baseball Input
            matchManager.handleInput(matchId, socket.user.id, action);
        });

        // --- Campaign Events ---
        socket.on('start_skirmish', ({ matchId, territoryId }) => {
            if (!socket.user) return;
            campaignManager.startSkirmish(matchId, socket.user.id, territoryId);
        });

        socket.on('submit_move', ({ matchId, from, to }) => {
            if (!socket.user) return;
            campaignManager.handleMove(matchId, socket.user.id, { from, to });
        });

        socket.on('disconnect', () => {
             // Handle disconnect? MatchManager has leaveMatch but we don't track socketId->matchId strictly here without a map.
             // We can let the connection map in MatchManager linger or clean up if we tracked it.
             // For MVP, memory leak is minor if server restarts daily.
             // Ideally we should track which match the socket was in.
        });
    });
}
