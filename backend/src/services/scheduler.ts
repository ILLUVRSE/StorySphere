import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

interface Matchup {
    week: number;
    home: string;
    away: string;
}

export class SchedulerService {
    async createSeason(name: string, year: number, teamIds: string[]) {
        const allowedSizes = [6, 10, 12];
        if (!allowedSizes.includes(teamIds.length)) {
            throw new Error(`Invalid league size. Must be 6, 10, or 12. Got ${teamIds.length}`);
        }

        const seasonId = uuidv4();

        // Persist Season
        if (db.isReady()) {
            await db.query(
                `INSERT INTO seasons (id, name, year, status) VALUES ($1, $2, $3, 'setup')`,
                [seasonId, name, year]
            );
        }

        // Generate 12-Week Schedule
        const schedule = this.generate12WeekSchedule(teamIds);

        // Persist Matches
        if (db.isReady()) {
            const client = await db.pool.connect();
            try {
                await client.query('BEGIN');
                for (const match of schedule) {
                    const matchId = uuidv4();
                    // Deterministic seed based on Match ID + Week (simple concat)
                    const seed = `${matchId}-wk${match.week}`;

                    await client.query(
                        `INSERT INTO matches (id, season_id, week, home_team, away_team, seed, status)
                         VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')`,
                        [matchId, seasonId, match.week, match.home, match.away, seed]
                    );
                }
                await client.query('COMMIT');
            } catch (e) {
                await client.query('ROLLBACK');
                throw e;
            } finally {
                client.release();
            }
        }

        return { seasonId, schedule };
    }

    private generate12WeekSchedule(teams: string[]): Matchup[] {
        const n = teams.length;
        const baseSchedule = this.generateRoundRobin(teams); // Returns N-1 weeks

        let fullSchedule: Matchup[] = [];
        let currentWeek = 1;

        // Loop until we have filled 12 weeks
        // We might need multiple cycles
        let cycle = 0;

        while (currentWeek <= 12) {
            // For each week in base schedule
            for (const baseMatch of baseSchedule) {
                // If we've reached week 13, stop adding
                // Note: baseSchedule contains multiple matches per week.
                // We process "weeks" of base schedule.

                // Let's restructure: generateRoundRobin returns array of matches with relative week.
                // We need to group them by week to process week-by-week.
            }

            // Simpler: Just iterate cycles
            const isSwap = cycle % 2 !== 0; // Swap home/away every other cycle

            // Max relative week in base
            const rounds = n - 1;

            for (let r = 1; r <= rounds; r++) {
                if (currentWeek > 12) break;

                const weeklyMatches = baseSchedule.filter(m => m.week === r);

                for (const m of weeklyMatches) {
                    fullSchedule.push({
                        week: currentWeek,
                        home: isSwap ? m.away : m.home,
                        away: isSwap ? m.home : m.away
                    });
                }
                currentWeek++;
            }
            cycle++;
        }

        return fullSchedule;
    }

    private generateRoundRobin(teams: string[]): Matchup[] {
        const schedule: Matchup[] = [];
        const n = teams.length;
        // Copy array to rotate
        const rotation = [...teams];

        // Number of rounds = n - 1
        for (let round = 0; round < n - 1; round++) {
            const week = round + 1;
            for (let i = 0; i < n / 2; i++) {
                const home = rotation[i];
                const away = rotation[n - 1 - i];

                // Flip home/away every other round for fairness within the single RR block
                if (round % 2 === 0) {
                     schedule.push({ week, home, away });
                } else {
                     schedule.push({ week, home: away, away: home });
                }
            }

            // Rotate: Keep index 0 fixed, move last to 1
            const last = rotation.pop()!;
            rotation.splice(1, 0, last);
        }

        return schedule;
    }
}
