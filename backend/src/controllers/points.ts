import { Request, Response } from 'express';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

export const completeMatch = async (req: Request, res: Response) => {
    try {
        const { matchId } = req.params;
        const { winnerId, loserId, scoreDelta } = req.body; // In real flow, derived from Engine state

        // Award Points
        // Win = +2
        // Loss < 2 runs = +1 ("Narrow Loss")
        // Loss >= 2 runs = +0

        const winnerPoints = 2;
        let loserPoints = 0;
        if (scoreDelta && scoreDelta <= 2) loserPoints = 1;

        if (db.isReady()) {
            // Transaction ideally
            const client = await db.getClient();
            try {
                await client.query('BEGIN');

                // Update Team Pools
                await client.query(`UPDATE teams SET skill_pool = skill_pool + $1 WHERE id = $2`, [winnerPoints, winnerId]);
                if (loserPoints > 0) {
                    await client.query(`UPDATE teams SET skill_pool = skill_pool + $1 WHERE id = $2`, [loserPoints, loserId]);
                }

                // Ledger
                await client.query(`INSERT INTO team_skill_points (team_id, amount, reason, match_id) VALUES ($1, $2, 'match_win', $3)`, [winnerPoints, winnerId, matchId]);
                if (loserPoints > 0) {
                     await client.query(`INSERT INTO team_skill_points (team_id, amount, reason, match_id) VALUES ($1, $2, 'narrow_loss', $3)`, [loserPoints, loserId, matchId]);
                }

                await client.query(`UPDATE matches SET status = 'completed' WHERE id = $1`, [matchId]);

                await client.query('COMMIT');
            } catch (e) {
                await client.query('ROLLBACK');
                throw e;
            } finally {
                client.release();
            }
        }

        res.json({ success: true, awarded: { [winnerId]: winnerPoints, [loserId]: loserPoints } });

    } catch (error) {
        console.error("Complete Match Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
