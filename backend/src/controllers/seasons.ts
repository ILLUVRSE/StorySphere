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

import { leagueService } from '../index'; // Circular dep risk?
// Ideally we structure DI better, but for MVP:
// We can move instantiation of services to a separate container file or index export.
// Let's assume index.ts exports `leagueService` but we might need to lazy load or structure differently.
// To avoid circular dependency issues, we can import `leagueService` inside the handler or move routes.
// OR: `backend/src/services` index.

export const advanceWeek = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const result = await leagueService.advanceWeek(id);
        res.json(result);
    } catch (error: any) {
        console.error("Advance Week Error:", error);
        res.status(500).json({ error: error.message });
    }
};
