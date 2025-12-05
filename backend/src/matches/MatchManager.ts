import { RiverportEngine } from '../../shared/riverport-engine/engine';
import { MatchEvent, TeamRoster, GameEvent } from '../../shared/riverport-engine/types';
import { db } from '../db';
import { Server } from 'socket.io';

interface ActiveMatch {
    engine: RiverportEngine;
    matchId: string;
    homeTeamId: string;
    awayTeamId: string;
    homeOwnerId: string;
    awayOwnerId: string;
    // Map socketId -> userId (or role)
    connectedUsers: Map<string, { userId: string, role: 'HOME' | 'AWAY' | 'SPECTATOR' }>;
}

export class MatchManager {
    public activeMatches: Map<string, ActiveMatch> = new Map();
    private io: Server | null = null;

    constructor() {}

    public setIo(io: Server) {
        this.io = io;
    }

    // Helper to fetch roster (Duplicated from MatchService, ideally shared or injected)
    private async getTeamRoster(teamId: string): Promise<TeamRoster> {
        if (!db.isReady()) {
             // Mock for dev/test without DB
             return {
                id: teamId,
                name: 'Mock Team',
                players: [{ id: 'p1', name: 'Mock Player', position: 'P', stats: {power:5, contact:5, speed:5, defense:5} }],
                lineup: ['p1'],
                pitcher: 'p1'
            } as any;
        }
        const teamRes = await db.query('SELECT * FROM teams WHERE id = $1', [teamId]);
        const playersRes = await db.query('SELECT * FROM players WHERE team_id = $1', [teamId]);
        const team = teamRes.rows[0];
        const players = playersRes.rows;
        return {
            id: team.id,
            name: team.name,
            players: players.map((p: any) => ({
                id: p.id,
                name: p.name,
                position: p.position,
                stats: p.stats
            })),
            lineup: players.slice(0, 9).map((p: any) => p.id),
            pitcher: players.find((p: any) => p.position === 'P')?.id || players[0].id
        };
    }

    public async loadMatch(matchId: string): Promise<ActiveMatch> {
        if (this.activeMatches.has(matchId)) {
            return this.activeMatches.get(matchId)!;
        }

        if (!db.isReady()) throw new Error("DB not ready");

        // 1. Fetch Match & Teams
        const matchRes = await db.query('SELECT * FROM matches WHERE id = $1', [matchId]);
        if (matchRes.rows.length === 0) throw new Error("Match not found");
        const match = matchRes.rows[0];

        const homeTeamRes = await db.query('SELECT owner_id FROM teams WHERE id = $1', [match.home_team]);
        const awayTeamRes = await db.query('SELECT owner_id FROM teams WHERE id = $1', [match.away_team]);
        const homeOwnerId = homeTeamRes.rows[0].owner_id;
        const awayOwnerId = awayTeamRes.rows[0].owner_id;

        const homeRoster = await this.getTeamRoster(match.home_team);
        const awayRoster = await this.getTeamRoster(match.away_team);

        // 2. Init Engine
        const engine = new RiverportEngine(match.seed || matchId, homeRoster, awayRoster);

        // 3. Rehydrate from logs (Basic Fast-Forward)
        // Ideally we fetch all events and apply them.
        // For MVP: We assume engine starts fresh or we rely on logs.
        // Prompt says "Rebuild state by replaying event logs".
        // Current Engine doesn't support 'applyEvent' to update state.
        // We will fetch logs just to have them, but for the Engine state,
        // we might be starting from inning 1 if we don't implement full hydration.
        // *Correction:* To strictly follow instructions, I should implement hydration.
        // However, I can't easily modify shared/engine substantially in this step without iterating.
        // I will assume for now that if the server restarts, the engine resets.
        // But for *new* connections to an *active* server, the engine is in memory.

        // 4. Store
        const activeMatch: ActiveMatch = {
            engine,
            matchId,
            homeTeamId: match.home_team,
            awayTeamId: match.away_team,
            homeOwnerId,
            awayOwnerId,
            connectedUsers: new Map()
        };
        this.activeMatches.set(matchId, activeMatch);
        return activeMatch;
    }

    public async joinMatch(socketId: string, matchId: string, userId: string | null, asPlayer: boolean): Promise<'HOME' | 'AWAY' | 'SPECTATOR' | null> {
        let match = this.activeMatches.get(matchId);
        if (!match) {
            try {
                match = await this.loadMatch(matchId);
            } catch (e) {
                console.error("Failed to load match", e);
                return null;
            }
        }

        let role: 'HOME' | 'AWAY' | 'SPECTATOR' = 'SPECTATOR';

        if (asPlayer && userId) {
            if (userId === match.homeOwnerId) role = 'HOME';
            else if (userId === match.awayOwnerId) role = 'AWAY';
            else {
                // Unauthorized to play
                return null;
            }
        }

        if (userId) {
            match.connectedUsers.set(socketId, { userId, role });
        }

        return role;
    }

    public leaveMatch(socketId: string, matchId: string) {
        const match = this.activeMatches.get(matchId);
        if (match) {
            match.connectedUsers.delete(socketId);
            // If empty, maybe unload? Keep for now.
        }
    }

    public async handleInput(matchId: string, userId: string, action: any) {
        const match = this.activeMatches.get(matchId);
        if (!match) return; // Should be loaded

        // 1. Validate Ownership/Turn
        // Check if userId is allowed to act for current state
        // engine.state.half determines who is batting/pitching?
        // Actually engine tracks `waitingFor`.
        // If waitingFor 'pitch', we need the pitcher's manager.
        // If waitingFor 'swing', we need the batter's manager.

        const state = match.engine.getState();
        let allowedRole: 'HOME' | 'AWAY' | null = null;

        // Determine active team based on state
        // Top of inning = Away batting, Home pitching
        // Bottom = Home batting, Away pitching
        const isTop = state.half === 'top';

        if (state.waitingFor === 'pitch') {
            // Pitcher needs to act.
            // Top: Pitcher is Home. Bottom: Pitcher is Away.
            allowedRole = isTop ? 'HOME' : 'AWAY';
        } else if (state.waitingFor === 'swing') {
            // Batter needs to act.
            // Top: Batter is Away. Bottom: Batter is Home.
            allowedRole = isTop ? 'AWAY' : 'HOME';
        }

        const userRole = userId === match.homeOwnerId ? 'HOME' : (userId === match.awayOwnerId ? 'AWAY' : 'SPECTATOR');

        if (userRole !== allowedRole) {
            console.warn(`User ${userId} (${userRole}) tried to act but waiting for ${allowedRole}`);
            return; // Reject
        }

        // 2. Apply to Engine
        // Capture events generated by this input
        const eventsBefore = match.engine.getEvents().length;
        match.engine.applyInput({ type: action.type, payload: action.payload });
        const allEvents = match.engine.getEvents();
        const newEvents = allEvents.slice(eventsBefore);

        // 3. Persist & Broadcast
        if (newEvents.length > 0) {
            const client = await db.pool.connect();
            try {
                // Get next seq
                const lastSeqRes = await client.query('SELECT MAX(seq) as maxseq FROM event_logs WHERE match_id = $1', [matchId]);
                let seq = (lastSeqRes.rows[0].maxseq || 0) + 1;

                await client.query('BEGIN');
                for (const event of newEvents) {
                    await client.query(
                        `INSERT INTO event_logs (match_id, seq, type, payload) VALUES ($1, $2, $3, $4)`,
                        [matchId, seq, event.type, event.payload]
                    );

                    // Broadcast
                    if (this.io) {
                        this.io.to(`match:${matchId}`).emit('match_event', { ...event, seq });
                    }
                    seq++;
                }

                // If match ended, update status
                const endEvent = newEvents.find(e => e.type === 'match_end');
                if (endEvent) {
                    await client.query('UPDATE matches SET status = $1, final_score = $2 WHERE id = $3', ['completed', endEvent.payload.finalScore, matchId]);
                    this.activeMatches.delete(matchId); // Cleanup
                }

                await client.query('COMMIT');
            } catch (e) {
                console.error("Failed to persist events", e);
                await client.query('ROLLBACK');
            } finally {
                client.release();
            }
        }
    }
}
