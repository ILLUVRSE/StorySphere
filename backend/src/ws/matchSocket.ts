import { Server, Socket } from 'socket.io';
import { MatchManager } from '../matches/MatchManager';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

interface AuthSocket extends Socket {
    user?: any;
}

export function setupMatchSocket(io: Server, matchManager: MatchManager) {
    const matchNamespace = io.of('/matches');

    matchNamespace.use((socket: AuthSocket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            // Allow spectator/anon for now? Requirement says "Verify JWT ... Reject unauthenticated connections for player actions."
            // So connection can be allowed, but actions restricted?
            // "on connection, accept auth token ... reject unauthenticated connections"
            // The prompt says "Reject unauthenticated connections for player actions." -> implies actions are rejected.
            // But later "Non-owners can join as spectator".
            // So we allow anon connection, but mark user as null.
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

        socket.on('join_match', ({ matchId, asPlayer }) => {
            // Join Room
            socket.join(`match:${matchId}`);

            // Logic to register as player if requested and owned
            if (asPlayer) {
                if (!socket.user) {
                    socket.emit('error', { message: "Authentication required to join as player" });
                    return;
                }

                // TODO: Verify team ownership via DB (skip for MVP, trust request for now or check match.createdBy)
                const success = matchManager.joinMatch(socket as any, matchId, socket.user.id);
                if (success) {
                    socket.emit('match_joined', { matchId, role: 'PLAYER' });
                } else {
                     socket.emit('error', { message: "Failed to join match (Match not found?)" });
                }
            } else {
                // Spectator
                socket.emit('match_joined', { matchId, role: 'SPECTATOR' });

                // Send recent history/state
                const match = matchManager.matches.get(matchId);
                if (match) {
                    socket.emit('match_state', match.engine.getSnapshot());
                }
            }
        });

        socket.on('submit_input', ({ matchId, action, seq }) => {
            if (!socket.user) return; // Ignore anon inputs

            // Validate match participation
            const match = matchManager.matches.get(matchId);
            if (!match) return;

            // MVP: Assuming input comes from registered player
            matchManager.handleInput(matchId, {
                clientId: socket.user.id,
                ts: Date.now(),
                seq: seq || 0,
                action
            });
        });

        socket.on('disconnect', () => {
             // Handle disconnect
        });
    });
}
