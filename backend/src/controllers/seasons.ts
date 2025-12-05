import { Request, Response } from 'express';
import { SchedulerService } from '../services/scheduler';

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
