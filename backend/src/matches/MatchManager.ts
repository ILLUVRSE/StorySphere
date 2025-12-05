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

    async createMatch(userId?: string, seed?: string): Promise<string> {
        const id = uuidv4();
        const matchSeed = seed || id; // Default to ID if no seed provided

        // Mock Rosters for MVP / Testing
        const mockPlayer = (id: string, name: string): any => ({
            id, teamId: 'mock-team', stats: { name, power: 5, speed: 5, fielding: 5, arm: 5, knees: 0, stamina: 1, skinColor: '#fff', shirtColor: '#fff', hatColor: '#000' },
            fatigue: 0, injury: null
        });

        const homeRoster = Array.from({length: 9}, (_, i) => mockPlayer(`h${i}`, `Home Player ${i}`));
        const awayRoster = Array.from({length: 9}, (_, i) => mockPlayer(`a${i}`, `Away Player ${i}`));

        const match = new Match(id, matchSeed, homeRoster, awayRoster);
        this.matches.set(id, match);

        // Persist to DB
        if (db.isReady()) {
            try {
                await db.query(
                    `INSERT INTO matches (id, status, created_by, seed, created_at) VALUES ($1, $2, $3, $4, NOW())`,
                    [id, 'running', userId || null, matchSeed]
                );
            } catch (err) {
                console.error("Failed to persist match creation:", err);
            }
        }

        return id;
    }

    simulateMatchToCompletion(matchId: string) {
        const match = this.matches.get(matchId);
        if (!match) return;

        let safety = 0;
        // Increase safety limit for longer games if needed, but 10000 should cover 3 innings.
        // User suggested 10000 for 7 innings.
        while (match.engine.state.phase !== 'GAME_OVER' && safety < 10000) {
            match.tick();
            safety++;
        }

        if (safety >= 10000) {
            console.warn(`Simulation timed out for match ${matchId} at tick ${match.engine.state.tick}. Phase: ${match.engine.state.phase}, Outs: ${match.engine.state.outs}, Inning: ${match.engine.state.inning}`);
        }

        console.log(`Simulation finished. Log length: ${match.engine.state.eventLog.length}`);
        return match.engine.state.eventLog;
    }

    joinMatch(socket: Socket, matchId: string, playerId: string) {
        const match = this.matches.get(matchId);
        // In future: load from Redis if not in memory but exists
        if (!match) return false;

        match.addPlayer(socket.id, playerId);
        socket.join(`match:${matchId}`);
        return true;
    }

    async loadMatchForSimulation(matchId: string, seed: string, homeTeamId: string, awayTeamId: string) {
        if (this.matches.has(matchId)) return; // Already loaded

        let homeRoster = [];
        let awayRoster = [];

        if (db.isReady()) {
             // Fetch Real Rosters
             const hRes = await db.query('SELECT * FROM players WHERE team_id = $1', [homeTeamId]);
             const aRes = await db.query('SELECT * FROM players WHERE team_id = $1', [awayTeamId]);

             // Fetch Team Cosmetics
             const hTeam = await db.query('SELECT cosmetics FROM teams WHERE id = $1', [homeTeamId]);
             const aTeam = await db.query('SELECT cosmetics FROM teams WHERE id = $1', [awayTeamId]);
             const hCosmetics = hTeam.rows[0]?.cosmetics || {};
             const aCosmetics = aTeam.rows[0]?.cosmetics || {};

             homeRoster = hRes.rows.map(row => this.mapPlayerRow(row, hCosmetics));
             awayRoster = aRes.rows.map(row => this.mapPlayerRow(row, aCosmetics));
        }

        // Fallback if DB query returned empty or DB not ready (e.g. testing)
        if (homeRoster.length < 9) {
             homeRoster = Array.from({length: 9}, (_, i) => this.mockPlayer(`h${i}`, homeTeamId, `Home ${i}`));
        }
        if (awayRoster.length < 9) {
             awayRoster = Array.from({length: 9}, (_, i) => this.mockPlayer(`a${i}`, awayTeamId, `Away ${i}`));
        }

        const match = new Match(matchId, seed, homeRoster, awayRoster);
        this.matches.set(matchId, match);
    }

    private mapPlayerRow(row: any, teamCosmetics: any): any {
        // Map DB row to Engine Player
        // row.stats is JSONB.
        // We merge team cosmetics if player doesn't have override (though logic usually on frontend)
        // Engine expects specific fields.

        const stats = { ...row.stats };
        // Ensure defaults
        if (!stats.hatColor) stats.hatColor = teamCosmetics.hatColor || '#000000';
        if (!stats.shirtColor) stats.shirtColor = teamCosmetics.shirtColor || '#ffffff';
        if (!stats.skinColor) stats.skinColor = '#ffdbac';

        return {
            id: row.id,
            teamId: row.team_id,
            stats: stats,
            fatigue: 0,
            injury: row.injury
        };
    }

    private mockPlayer(id: string, teamId: string, name: string): any {
        return {
            id, teamId,
            stats: { name, power: 5, speed: 5, fielding: 5, arm: 5, knees: 0, stamina: 1, skinColor: '#ffdbac', shirtColor: '#fff', hatColor: '#000' },
            fatigue: 0,
            injury: null
        };
    }

    handleInput(matchId: string, input: GameInput) {
        const match = this.matches.get(matchId);
        if (match) {
            match.applyInput(input);
        }
    }

    async getMatchEvents(matchId: string) {
        const match = this.matches.get(matchId);
        if (match) return match.engine.state.eventLog;

        // If not in memory, fetch from DB
        if (db.isReady()) {
             const res = await db.query('SELECT event_log FROM matches WHERE id = $1', [matchId]);
             // Note: event_log is separate table in schema (event_logs) not column on matches?
             // Checking schema: createTable('event_logs', { match_id ... })
             // Ah, so we need to query event_logs table.

             const logsRes = await db.query('SELECT type, payload, seq, ts FROM event_logs WHERE match_id = $1 ORDER BY seq ASC', [matchId]);
             return logsRes.rows;
        }
        return [];
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
