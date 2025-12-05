
import { db } from '../db';
import { MatchManager } from '../matches/MatchManager';
import { completeMatch } from '../controllers/points'; // We'll need to refactor completeMatch or call internal logic

export class LeagueService {
    matchManager: MatchManager;

    constructor(matchManager: MatchManager) {
        this.matchManager = matchManager;
    }

    async advanceWeek(seasonId: string) {
        if (!db.isReady()) throw new Error("DB Required");

        // 1. Find Current Week
        // Simplest: Find lowest week number that has 'scheduled' matches
        const r1 = await db.query(`SELECT MIN(week) as w FROM matches WHERE season_id = $1 AND status = 'scheduled'`, [seasonId]);
        const currentWeek = r1.rows[0]?.w;

        if (!currentWeek) return { message: "Season completed or no scheduled matches." };

        // 2. Find matches
        const matchesRes = await db.query(`SELECT * FROM matches WHERE season_id = $1 AND week = $2 AND status = 'scheduled'`, [seasonId, currentWeek]);
        const matches = matchesRes.rows;

        const results = [];

        // 3. Simulate Each
        for (const m of matches) {
            // Check if match already running in memory?
            let matchId = m.id;

            // If match not in memory, we must hydrate it (or create it for sim)
            // For MVP, we treat 'scheduled' as not-yet-started.
            // We load rosters...
            // Mocking rosters for Sim if not fully hydrated from DB

            // We reuse matchManager.createMatch but with specific ID
            // BUT createMatch inserts into DB. We already have the match.
            // We need a helper: loadMatchOrSimulate(matchId, seed)

            // Hack for MVP: We use the existing createMatch logic but bypass the INSERT if it exists?
            // Or better: Add simulateMatchById(matchId, seed) to MatchManager that doesn't insert.

            // Let's rely on MatchManager having a method to load/init engine without DB insert
            // Refactor MatchManager?
            // Or just instantiate Match manually here.

            // Better: use MatchManager to ensure consistency
            const seed = m.seed || m.id;

            // Note: In real app, we fetch rosters from DB for home_team and away_team
            // For MVP, we use the mocks inside MatchManager (or we should pass them)

            // Let's add a method to MatchManager: `loadMatchForSimulation(id, seed, homeId, awayId)`
            // We will modify MatchManager in next step.

            await this.matchManager.loadMatchForSimulation(m.id, seed, m.home_team, m.away_team);

            // Simulate
            const log = this.matchManager.simulateMatchToCompletion(m.id);

            // Determine Winner
            const lastEvent = log ? log[log.length - 1] : null;
            let finalScore = { home: 0, away: 0 };

            // We need to extract score from log or engine state.
            // simulateMatchToCompletion returns log. Match object has state.
            const matchObj = this.matchManager.matches.get(m.id);
            if (matchObj) {
                finalScore = matchObj.engine.state.score;
            }

            const winnerId = finalScore.home > finalScore.away ? m.home_team : m.away_team;
            const loserId = finalScore.home > finalScore.away ? m.away_team : m.home_team;
            const delta = Math.abs(finalScore.home - finalScore.away);

            // Award Points (Reuse logic from Points controller or duplicate)
            // Ideally extract logic. I will duplicate lightly for speed or call internal helper.

            await this.awardPointsInternal(m.id, winnerId, loserId, delta);

            results.push({ matchId: m.id, score: finalScore });

            // Cleanup
            this.matchManager.matches.delete(m.id);
        }

        return { week: currentWeek, simulated: results.length, results };
    }

    private async awardPointsInternal(matchId: string, winnerId: string, loserId: string, delta: number) {
        const winnerPoints = 2;
        let loserPoints = 0;
        if (delta <= 2) loserPoints = 1;

        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            await client.query(`UPDATE teams SET skill_pool = skill_pool + $1, wins = wins + 1 WHERE id = $2`, [winnerPoints, winnerId]);
            if (loserPoints > 0) {
                await client.query(`UPDATE teams SET skill_pool = skill_pool + $1, losses = losses + 1 WHERE id = $2`, [loserPoints, loserId]);
            } else {
                 await client.query(`UPDATE teams SET losses = losses + 1 WHERE id = $1`, [loserId]);
            }

            await client.query(`INSERT INTO team_skill_points (team_id, amount, reason, match_id) VALUES ($1, $2, 'match_win', $3)`, [winnerPoints, winnerId, matchId]);

            await client.query(`UPDATE matches SET status = 'completed' WHERE id = $1`, [matchId]);
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            console.error("Failed to award points", e);
        } finally {
            client.release();
        }
    }
}
