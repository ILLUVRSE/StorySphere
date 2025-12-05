import { Request, Response } from 'express';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

export const createPlayer = async (req: Request, res: Response) => {
    try {
        const { teamId } = req.params;
        const { name, position, archetype, stats } = req.body;

        // Basic validation
        if (!name || !position || !stats) return res.status(400).json({ error: 'Missing fields' });

        const id = uuidv4();
        if (db.isReady()) {
            await db.query(
                `INSERT INTO players (id, team_id, name, position, archetype, stats) VALUES ($1, $2, $3, $4, $5, $6)`,
                [id, teamId, name, position, archetype, stats]
            );
        }

        res.status(201).json({ id, teamId, name, position, archetype, stats });
    } catch (error) {
        console.error("Create Player Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getPlayer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (db.isReady()) {
            const result = await db.query(`SELECT * FROM players WHERE id = $1`, [id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
            res.json(result.rows[0]);
        } else {
            res.json({ id, name: 'Mock Player' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
