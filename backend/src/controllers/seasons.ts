import { Request, Response } from 'express';
import { SchedulerService } from '../services/scheduler';
import { db } from '../db';

const scheduler = new SchedulerService();

export const createSeason = async (req: Request, res: Response) => {
    try {
        const { name, year, teamIds } = req.body;
        if (!name || !year || !teamIds || !Array.isArray(teamIds)) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        const result = await scheduler.createSeason(name, year, teamIds);
        res.status(201).json(result);
    } catch (error: any) {
        console.error("Create Season Error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};

export const getSchedule = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (db.isReady()) {
            const matchesRes = await db.query(
                `SELECT * FROM matches WHERE season_id = $1 ORDER BY week ASC, id ASC`,
                [id]
            );
            res.json(matchesRes.rows);
        } else {
            res.json([]); // Mock empty
        }
    } catch (error: any) {
        console.error("Get Schedule Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
