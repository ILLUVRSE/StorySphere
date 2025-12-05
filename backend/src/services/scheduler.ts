import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

export class SchedulerService {
    async createSeason(name: string, year: number, teamIds: string[]) {
        if (teamIds.length < 2) throw new Error("Need at least 2 teams");
        if (teamIds.length % 2 !== 0) {
            // Add 'BYE' team or handle externally. For MVP, throw.
            throw new Error("Even number of teams required for round-robin");
        }

        const seasonId = uuidv4();

        // Persist Season
        if (db.isReady()) {
            await db.query(
                `INSERT INTO seasons (id, name, year, status) VALUES ($1, $2, $3, 'setup')`,
                [seasonId, name, year]
            );
        }

        // Generate Round Robin
        const schedule = this.generateRoundRobin(teamIds);

        // Persist Matches
        if (db.isReady()) {
            for (const match of schedule) {
                const matchId = uuidv4();
                // Deterministic seed based on Match ID + Week
                const seed = `${matchId}-${match.week}`;

                await db.query(
                    `INSERT INTO matches (id, season_id, week, home_team, away_team, seed, status)
                     VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')`,
                    [matchId, seasonId, match.week, match.home, match.away, seed]
                );
            }
        }

        return { seasonId, schedule };
    }

    private generateRoundRobin(teams: string[]) {
        const schedule = [];
        const n = teams.length;
        // Copy array to rotate
        const rotation = [...teams];

        // Number of rounds = n - 1
        for (let round = 0; round < n - 1; round++) {
            const week = round + 1;
            for (let i = 0; i < n / 2; i++) {
                const home = rotation[i];
                const away = rotation[n - 1 - i];
                // Flip home/away every other round for fairness (simplified)
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
