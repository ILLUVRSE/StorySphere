import { Request, Response } from 'express';
import { MatchManager } from '../matches/MatchManager';

// We need access to the singleton MatchManager instance.
// See `seasons.ts` note about DI.
// Assuming `leagueService` or `matchManager` is exported from index.

import { leagueService } from '../index'; // accessing matchManager via leagueService.matchManager

export const getMatchEvents = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const events = await leagueService.matchManager.getMatchEvents(id);
        res.json(events);
    } catch (error) {
        console.error("Get Events Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
