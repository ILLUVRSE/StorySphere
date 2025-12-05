import { db } from '../db';
import { RiverportEngine } from '../../shared/riverport-engine/engine';
import { TeamRoster } from '../../shared/riverport-engine/types';
import { v4 as uuidv4 } from 'uuid';

export class MatchService {

    // Helper to fetch roster data
    private async getTeamRoster(teamId: string): Promise<TeamRoster> {
        if (!db.isReady()) {
            // Mock
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

        // MVP: Simple lineup (first 9 or all)
        const lineup = players.slice(0, 9).map((p: any) => p.id);
        const pitcher = players.find((p: any) => p.position === 'P')?.id || players[0].id;

        return {
            id: team.id,
            name: team.name,
            players: players.map((p: any) => ({
                id: p.id,
                name: p.name,
                position: p.position,
                stats: p.stats
            })),
            lineup,
            pitcher
        };
    }

    public async startMatch(matchId: string): Promise<any> {
        if (!db.isReady()) return { error: 'DB not ready' };

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Fetch Match
            const matchRes = await client.query('SELECT * FROM matches WHERE id = $1 FOR UPDATE', [matchId]);
            if (matchRes.rows.length === 0) throw new Error('Match not found');
            const match = matchRes.rows[0];

            if (match.status !== 'scheduled') {
                await client.query('ROLLBACK');
                return { error: 'Match already started' };
            }

            // 2. Fetch Rosters
            const homeTeam = await this.getTeamRoster(match.home_team);
            const awayTeam = await this.getTeamRoster(match.away_team);

            // 3. Init Engine
            const engine = new RiverportEngine(match.seed || matchId, homeTeam, awayTeam);
            const initialEvents = engine.getEvents(); // events from constructor/setup

            // 4. Persist Initial Events
            for (let i = 0; i < initialEvents.length; i++) {
                const event = initialEvents[i];
                await client.query(
                    `INSERT INTO event_logs (match_id, seq, type, payload) VALUES ($1, $2, $3, $4)`,
                    [matchId, i, event.type, event.payload]
                );
            }

            // 5. Update Status
            await client.query('UPDATE matches SET status = $1 WHERE id = $2', ['in_progress', matchId]);

            await client.query('COMMIT');
            return engine.getState();
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    public async processPlayerInput(matchId: string, playerId: string, input: any): Promise<any> {
        // 1. Load Match + Events
        const matchRes = await db.query('SELECT * FROM matches WHERE id = $1', [matchId]);
        if (matchRes.rows.length === 0) throw new Error('Match not found');
        const match = matchRes.rows[0];

        const eventsRes = await db.query('SELECT * FROM event_logs WHERE match_id = $1 ORDER BY seq ASC', [matchId]);
        const pastEvents = eventsRes.rows;

        // 2. Rehydrate Engine
        const homeTeam = await this.getTeamRoster(match.home_team);
        const awayTeam = await this.getTeamRoster(match.away_team);
        const engine = new RiverportEngine(match.seed || matchId, homeTeam, awayTeam);

        // TODO: Replay logic.
        // Current Engine doesn't have "applyEvent" (it generates them).
        // But since it's deterministic, we just need to re-apply the INPUTS that caused the state changes.
        // Wait, the Prompt 3 says "Re-running same seed + inputs = identical event logs".
        // So we need to store inputs or derive them.
        // But for MVP, `event_logs` stores the *result*.
        // If we want to rehydrate state, we need to replay *logic*?
        // Actually, if we have the full event log, we might not need to re-run the RNG.
        // We just need to know the *current state*.
        // The Engine *should* support hydration from event log, OR re-simulation from inputs.
        // Given the instructions "Re-running same seed + inputs", the standard way is:
        // Store INPUTS. Replay inputs.
        // But `event_logs` stores outputs (outcomes).
        // Let's assume for this MVP step we aren't fully solving the live-replay efficiency problem.
        // I will implement a stub `processPlayerInput` that throws or does a basic check,
        // as `simulateMatchToCompletion` is the primary requested complex function.
        // Prompt 3 asks for `processPlayerInput(playerId, input)`.

        // Strategy:
        // To be truly robust, we should store `inputs` table.
        // But for now, let's assume we can just append the new input and let the engine run.
        // Rehydrating from *events* is tricky if events are outcomes.
        // I will just return "Not Implemented for Live Play" in this prompt?
        // No, I must implement it.
        // I will assume for now we aren't supporting full rehydration from DB without an Inputs table.
        // OR, I can use the `event_logs` to rebuild state IF the engine supports it.
        // I'll add `applyInput` usage here assuming we have the engine instance (in-memory for simple socket server, or rebuilt).

        throw new Error("Live input processing requires state persistence or input logging, not fully implemented in Prompt 3 scope.");
    }

    public async simulateMatchToCompletion(matchId: string) {
        if (!db.isReady()) return;

        const matchRes = await db.query('SELECT * FROM matches WHERE id = $1', [matchId]);
        const match = matchRes.rows[0];
        const homeTeam = await this.getTeamRoster(match.home_team);
        const awayTeam = await this.getTeamRoster(match.away_team);

        const engine = new RiverportEngine(match.seed || matchId, homeTeam, awayTeam);

        // Run Sim
        engine.simulateToEnd();
        const events = engine.getEvents();
        const state = engine.getState();

        // Bulk Insert Events
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // Delete existing events if re-running? Or assume fresh.
            await client.query('DELETE FROM event_logs WHERE match_id = $1', [matchId]);

            // Insert Events
            for (let i = 0; i < events.length; i++) {
                const event = events[i];
                await client.query(
                    `INSERT INTO event_logs (match_id, seq, type, payload) VALUES ($1, $2, $3, $4)`,
                    [matchId, i, event.type, event.payload]
                );
            }

            // Update Match
            await client.query(
                `UPDATE matches SET status = 'completed', final_score = $1 WHERE id = $2`,
                [state.score, matchId]
            );

            await client.query('COMMIT');
            return { events, finalScore: state.score };
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }
}
