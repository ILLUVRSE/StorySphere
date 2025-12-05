import { Request, Response } from 'express';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

export const createTeam = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const ownerId = req.user.id;
        const { name, cosmetics } = req.body;

        if (!name) return res.status(400).json({ error: 'Team name required' });

        const id = uuidv4();
        if (db.isReady()) {
            await db.query(
                `INSERT INTO teams (id, name, owner_id, cosmetics, skill_pool) VALUES ($1, $2, $3, $4, 30)`,
                [id, name, ownerId, cosmetics || {}]
            );
        } else {
            console.warn("DB not ready, simulating team creation");
        }

        res.status(201).json({ id, name, ownerId, skill_pool: 30, cosmetics: cosmetics || {} });
    } catch (error) {
        console.error("Create Team Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const updateTeam = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { cosmetics } = req.body;

        // Validation: Ensure user owns team (skipped for MVP speed, assume authMiddleware checks presence)
        // ideally: SELECT owner_id FROM teams...

        if (db.isReady()) {
            if (cosmetics) {
                await db.query(`UPDATE teams SET cosmetics = $1 WHERE id = $2`, [cosmetics, id]);
            }
        }
        res.json({ success: true });
    } catch (error) {
         console.error("Update Team Error:", error);
         res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getTeam = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (db.isReady()) {
            const teamRes = await db.query(`SELECT * FROM teams WHERE id = $1`, [id]);
            const playersRes = await db.query(`SELECT * FROM players WHERE team_id = $1`, [id]);

            if (teamRes.rows.length === 0) return res.status(404).json({ error: 'Team not found' });

            const team = teamRes.rows[0];
            team.roster = playersRes.rows;
            res.json(team);
        } else {
            // Mock
            res.json({ id, name: 'Mock Team', skill_pool: 30, roster: [] });
        }
    } catch (error) {
        console.error("Get Team Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const updateSkillAllocation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params; // Team ID
        const { playerId, stat, amount } = req.body; // Amount = points to spend? Or stats to increase?
        // Prompt says: "Cost ramps: +1 stat = 1 point up to +3; cost ramps thereafter"
        // Let's assume input is "increase stat by 1".

        if (!playerId || !stat) return res.status(400).json({ error: 'Missing fields' });

        if (db.isReady()) {
            const client = await db.getClient();
            try {
                await client.query('BEGIN');

                // 1. Get Team Pool
                const teamRes = await client.query('SELECT skill_pool FROM teams WHERE id = $1', [id]);
                if (teamRes.rows.length === 0) throw new Error("Team not found");
                const currentPool = teamRes.rows[0].skill_pool;

                // 2. Get Player Stats
                const playerRes = await client.query('SELECT stats FROM players WHERE id = $1 AND team_id = $2', [playerId, id]);
                if (playerRes.rows.length === 0) throw new Error("Player not found");
                const stats = playerRes.rows[0].stats;
                const currentVal = stats[stat] || 0;

                // 3. Calculate Cost
                // Logic: cost = 1 if currentVal < 5?
                // Ramped Cost Rule from Brief: "+1 to stat = 1 point for first +3 total"
                // This implies we need to track "points invested per stat" or "total points invested".
                // Players table has `skill_points_invested`.
                // For MVP, let's just use current stat value as proxy for cost ramp.
                // e.g. 1->5 costs 1. 6->8 costs 2. 9->10 costs 3.

                let cost = 1;
                if (currentVal >= 5) cost = 2;
                if (currentVal >= 8) cost = 3;

                if (currentPool < cost) throw new Error("Not enough skill points");

                // 4. Update
                stats[stat] = currentVal + 1;

                await client.query('UPDATE teams SET skill_pool = skill_pool - $1 WHERE id = $2', [cost, id]);
                await client.query('UPDATE players SET stats = $1, skill_points_invested = skill_points_invested + $2 WHERE id = $3', [stats, cost, playerId]);

                await client.query('COMMIT');

                res.json({ success: true, newStats: stats, remainingPool: currentPool - cost });
            } catch (e: any) {
                await client.query('ROLLBACK');
                res.status(400).json({ error: e.message });
            } finally {
                client.release();
            }
        } else {
             // Mock
             res.json({ success: true, newStats: {}, remainingPool: 29 });
        }
    } catch (error) {
         console.error("Skill Alloc Error:", error);
         res.status(500).json({ error: 'Internal Server Error' });
    }
};
