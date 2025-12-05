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
    // This is a simplified version. A real implementation would need complex validation
    // against the "Ramped Cost" rules and ensure atomic updates.
    // For MVP task 2 compliance, we'll validate basic pool limits.

    // NOTE: This endpoint assumes receiving the FULL new stat block for a player,
    // or a list of players to update.
    // Ideally, we transactionally process a "spend" request.

    // Let's implement a "Spend Points" action instead of full replacement.
    // req.body: { playerId, stat: 'power', amount: 1 }

    res.status(501).json({ error: 'Not implemented yet (Waiting for Task 9 logic)' });
};
