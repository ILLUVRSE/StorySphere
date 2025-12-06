import { RiverportEngine } from '../../shared/riverport-engine/engine';
import { MatchEvent, TeamRoster, GameEvent } from '../../shared/riverport-engine/types';
import { db } from '../db';
import { Server } from 'socket.io';

interface LineupState {
    battingOrder: string[];
    bench: string[];
    startingPitcher: string | null;
    locked: boolean;
}

interface ActiveMatch {
    engine: RiverportEngine;
    matchId: string;
    homeTeamId: string;
    awayTeamId: string;
    homeOwnerId: string;
    awayOwnerId: string;
    // Map socketId -> userId (or role)
    connectedUsers: Map<string, { userId: string, role: 'HOME' | 'AWAY' | 'SPECTATOR' }>;

    // New fields
    mode: 'live' | 'sim';
    lineups: {
        home: LineupState;
        away: LineupState;
    };
    rosters: {
        home: TeamRoster;
        away: TeamRoster;
    };
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
            lineup: players.slice(0, 9).map((p: any) => p.id), // Default from DB? Or handled by lineup editor
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

        // 2. Parse stored lineups or init default
        let lineups = match.lineups || {};
        if (!lineups.home) {
            lineups.home = { battingOrder: [], bench: [], startingPitcher: null, locked: false };
        }
        if (!lineups.away) {
            lineups.away = { battingOrder: [], bench: [], startingPitcher: null, locked: false };
        }

        const mode = match.mode || 'live';

        // 3. Init Engine
        const engine = new RiverportEngine(match.seed || matchId, homeRoster, awayRoster);

        // 4. Store
        const activeMatch: ActiveMatch = {
            engine,
            matchId,
            homeTeamId: match.home_team,
            awayTeamId: match.away_team,
            homeOwnerId,
            awayOwnerId,
            connectedUsers: new Map(),
            mode,
            lineups,
            rosters: { home: homeRoster, away: awayRoster }
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

        if (userId) {
            if (userId === match.homeOwnerId) role = 'HOME';
            else if (userId === match.awayOwnerId) role = 'AWAY';
        }

        // As player check?
        if (asPlayer && role === 'SPECTATOR') {
             return null;
        }

        if (userId) {
            match.connectedUsers.set(socketId, { userId, role });
        }

        // Broadcast updated lobby presence?
        this.broadcastLobbyState(matchId);

        return role;
    }

    public leaveMatch(socketId: string, matchId: string) {
        const match = this.activeMatches.get(matchId);
        if (match) {
            match.connectedUsers.delete(socketId);
            this.broadcastLobbyState(matchId);
        }
    }

    public async handleLineupSubmission(matchId: string, userId: string, payload: { battingOrder: string[], bench: string[], startingPitcher: string }) {
        const match = this.activeMatches.get(matchId);
        if (!match) return;

        let teamKey: 'home' | 'away';
        if (userId === match.homeOwnerId) teamKey = 'home';
        else if (userId === match.awayOwnerId) teamKey = 'away';
        else return; // Unauthorized

        // Validation
        const roster = match.rosters[teamKey];
        const allProvidedIds = [...payload.battingOrder, ...payload.bench];

        // Check 1: Batting order size
        if (payload.battingOrder.length !== 9) {
            // Error handling? For now just return or log.
            // Ideally emit 'error' back to socket.
            console.warn("Invalid lineup size");
            return;
        }

        // Check 2: Membership
        const rosterIds = new Set(roster.players.map(p => p.id));
        for (const id of allProvidedIds) {
            if (!rosterIds.has(id)) {
                console.warn(`Player ${id} not in roster`);
                return;
            }
        }
        if (!rosterIds.has(payload.startingPitcher)) {
            console.warn(`Pitcher ${payload.startingPitcher} not in roster`);
            return;
        }

        // Update State
        match.lineups[teamKey] = {
            battingOrder: payload.battingOrder,
            bench: payload.bench,
            startingPitcher: payload.startingPitcher,
            locked: true
        };

        // Persist
        if (db.isReady()) {
            await db.query('UPDATE matches SET lineups = $1 WHERE id = $2', [JSON.stringify(match.lineups), matchId]);
        }

        this.broadcastLobbyState(matchId);
    }

    public async handleModeUpdate(matchId: string, userId: string, mode: 'live' | 'sim') {
        const match = this.activeMatches.get(matchId);
        if (!match) return;

        // Only Home Manager can change mode
        if (userId !== match.homeOwnerId) return;

        match.mode = mode;

        if (db.isReady()) {
            await db.query('UPDATE matches SET mode = $1 WHERE id = $2', [mode, matchId]);
        }

        this.broadcastLobbyState(matchId);
    }

    public async startMatch(matchId: string, userId: string) {
        const match = this.activeMatches.get(matchId);
        if (!match) return;

        // Only Home Manager can start (prompt implied home owner controls mode/flow)
        if (userId !== match.homeOwnerId) return;

        // Check locks
        if (!match.lineups.home.locked || !match.lineups.away.locked) {
            console.warn("Cannot start match: Lineups not locked");
            return;
        }

        // Update status
        if (db.isReady()) {
            await db.query("UPDATE matches SET status = 'in_progress' WHERE id = $1", [matchId]);
        }

        // Apply lineups to engine (Engine might need a method to set lineups if not done in constructor properly)
        // Current Engine constructor took rosters but didn't know specific 1-9 lineup order if it differs from roster order.
        // For MVP, we assume Engine uses the roster list or we might need to update Engine.
        // Engine.ts uses `team.lineup` which we populated in `getTeamRoster`.
        // We should update the engine's internal team structure with the chosen lineup.
        // Quick fix: Modify engine's team state directly
        (match.engine as any).homeTeam.lineup = match.lineups.home.battingOrder;
        (match.engine as any).homeTeam.pitcher = match.lineups.home.startingPitcher;
        (match.engine as any).awayTeam.lineup = match.lineups.away.battingOrder;
        (match.engine as any).awayTeam.pitcher = match.lineups.away.startingPitcher;


        if (match.mode === 'sim') {
            match.engine.simulateToEnd();
            const events = match.engine.getEvents();

            // Persist all events
            await this.persistEvents(matchId, events);

            // Broadcast End
            if (this.io) {
                this.io.to(`match:${matchId}`).emit('match_ended', { finalScore: match.engine.getState().score });
                // Also send full replay?
                this.io.to(`match:${matchId}`).emit('replay', events);
            }
        } else {
            // Live
            if (this.io) {
                this.io.to(`match:${matchId}`).emit('match_started', { mode: 'live' });
            }
        }
    }

    private async persistEvents(matchId: string, events: any[]) {
         if (!db.isReady()) return;
         const client = await db.pool.connect();
         try {
             await client.query('BEGIN');
             // clear existing?
             await client.query('DELETE FROM event_logs WHERE match_id = $1', [matchId]);

             let seq = 1;
             for (const event of events) {
                 await client.query(
                    `INSERT INTO event_logs (match_id, seq, type, payload) VALUES ($1, $2, $3, $4)`,
                    [matchId, seq, event.type, event.payload]
                );
                seq++;
             }

             // Update match result
             const finalScore = events.find(e => e.type === 'match_end')?.payload?.finalScore;
             if (finalScore) {
                 await client.query('UPDATE matches SET status = $1, final_score = $2 WHERE id = $3', ['completed', finalScore, matchId]);
             }

             await client.query('COMMIT');
         } catch (e) {
             console.error(e);
             await client.query('ROLLBACK');
         } finally {
             client.release();
         }
    }

    public getLobbyState(matchId: string) {
        const match = this.activeMatches.get(matchId);
        if (!match) return null;

        // Count connected
        let homeConnected = false;
        let awayConnected = false;
        for (const [_, user] of match.connectedUsers) {
            if (user.role === 'HOME') homeConnected = true;
            if (user.role === 'AWAY') awayConnected = true;
        }

        return {
            matchId: match.matchId,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            homeConnected,
            awayConnected,
            mode: match.mode,
            lineups: match.lineups
        };
    }

    private broadcastLobbyState(matchId: string) {
        if (this.io) {
            this.io.to(`match:${matchId}`).emit('lobby_state', this.getLobbyState(matchId));
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
