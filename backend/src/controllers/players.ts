import { Request, Response } from 'express';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

export const VALID_POSITIONS = [
    'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'Bench'
];

const DEFAULT_STATS = { power: 1, contact: 1, speed: 1, defense: 1 };

export const createPlayer = async (req: Request, res: Response) => {
    try {
        const { teamId } = req.params;
        const { name, position, archetype, stats } = req.body;

        // 1. Basic Validation
        if (!name || !position) return res.status(400).json({ error: 'Missing name or position' });

        if (!VALID_POSITIONS.includes(position)) {
            return res.status(400).json({
                error: `Invalid position. Must be one of: ${VALID_POSITIONS.join(', ')}`
            });
        }

        // 2. Mock Mode Check (if DB not ready)
        if (!db.isReady()) {
            return res.status(201).json({
                id: uuidv4(), teamId, name, position, archetype,
                stats: stats || DEFAULT_STATS
            });
        }

        // 3. Enforce Max 13 Players per Team
        const rosterCountRes = await db.query(
            'SELECT COUNT(*) as count FROM players WHERE team_id = $1',
            [teamId]
        );
        const currentCount = parseInt(rosterCountRes.rows[0].count, 10);

        if (currentCount >= 13) {
            return res.status(409).json({ error: 'Team roster is full (max 13 players)' });
        }

        // 4. Create Player
        // Base stats (stats provided at creation) do not cost skill points.
        // If no stats provided, use defaults (1s).
        const initialStats = stats || DEFAULT_STATS;
        const id = uuidv4();

        await db.query(
            `INSERT INTO players (id, team_id, name, position, archetype, stats, skill_points_invested)
             VALUES ($1, $2, $3, $4, $5, $6, 0)`,
            [id, teamId, name, position, archetype, initialStats]
        );

        res.status(201).json({ id, teamId, name, position, archetype, stats: initialStats });
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
