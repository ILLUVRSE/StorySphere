import { Server, Socket } from 'socket.io';
import { Match } from './Match';
import { GameInput } from '../../../shared/riverport-engine/src';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from 'redis';
import { config } from '../config';
import { db } from '../db';

export class MatchManager {
    io: Server;
    matches: Map<string, Match>;
    matchLoopInterval: NodeJS.Timeout | null = null;
    TICK_RATE = 30; // 30Hz
    redis: ReturnType<typeof createClient>;

    constructor(io: Server) {
        this.io = io;
        this.matches = new Map();

        this.redis = createClient({
            socket: { host: config.redis.host, port: config.redis.port }
        });
        this.redis.connect().catch(err => console.error("MatchManager Redis Error:", err));
    }

    start() {
        if (this.matchLoopInterval) return;

        const tickMs = 1000 / this.TICK_RATE;
        this.matchLoopInterval = setInterval(() => {
            this.tick();
        }, tickMs);
    }

    stop() {
        if (this.matchLoopInterval) {
            clearInterval(this.matchLoopInterval);
            this.matchLoopInterval = null;
        }
    }

    async createMatch(userId?: string): Promise<string> {
        const id = uuidv4();
        const match = new Match(id);
        this.matches.set(id, match);

        // Persist to DB
        if (db.isReady()) {
            try {
                await db.query(
                    `INSERT INTO matches (id, status, created_by, created_at) VALUES ($1, $2, $3, NOW())`,
                    [id, 'running', userId || null]
                );
            } catch (err) {
                console.error("Failed to persist match creation:", err);
            }
        }

        return id;
    }

    joinMatch(socket: Socket, matchId: string, playerId: string) {
        const match = this.matches.get(matchId);
        // In future: load from Redis if not in memory but exists
        if (!match) return false;

        match.addPlayer(socket.id, playerId);
        socket.join(`match:${matchId}`);
        return true;
    }

    handleInput(matchId: string, input: GameInput) {
        const match = this.matches.get(matchId);
        if (match) {
            match.applyInput(input);
        }
    }

    private tick() {
        this.matches.forEach((match) => {
            // Note: We might want to keep ticking even if empty if we want the world to progress,
            // but for efficiency we pause empty matches or unload them.
            // For MVP, we tick if it exists.

            const snapshot = match.tick();

            // Broadcast snapshot
            this.io.to(`match:${match.id}`).emit('SNAPSHOT', {
                tick: snapshot.tick,
                state: snapshot
            });

            // Persist to Redis (Throttle to every 1 sec to save bandwidth for MVP, or every tick if critical)
            // For real-time resumption, every few ticks is better.
            if (snapshot.tick % 30 === 0) {
                 this.redis.set(`match:${match.id}:state`, JSON.stringify(snapshot));
                 this.redis.expire(`match:${match.id}:state`, 3600); // 1 hour TTL
            }
        });
    }
}
