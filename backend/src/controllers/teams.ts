import { Request, Response } from 'express';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

// Ramped Cost Schedule
// 0-5: 1 point per level
// 6-8: 2 points per level
// 9-10: 3 points per level
const MIN_STAT = 0;
const MAX_STAT = 10;
const DEFAULT_BASE_STAT = 1;

// Define Base Stats per Archetype (if any)
// For now, we assume all archetypes start with base 1s unless specified.
// You can expand this map later.
const ARCHETYPE_BASES: Record<string, Record<string, number>> = {
    // Example: 'PowerHitter': { power: 3, contact: 1, speed: 1, defense: 1 }
};

function getBaseStat(archetype: string | null | undefined, statName: string): number {
    if (archetype && ARCHETYPE_BASES[archetype] && ARCHETYPE_BASES[archetype][statName] !== undefined) {
        return ARCHETYPE_BASES[archetype][statName];
    }
    return DEFAULT_BASE_STAT;
}

function calculateCostToReach(baseLevel: number, targetLevel: number): number {
    if (targetLevel <= baseLevel) return 0;

    let cost = 0;
    // Iterate from (Base + 1) up to Target
    for (let lvl = baseLevel + 1; lvl <= targetLevel; lvl++) {
        if (lvl <= 5) cost += 1;
        else if (lvl <= 8) cost += 2;
        else cost += 3; // 9-10
    }
    return cost;
}

export const createTeam = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const ownerId = req.user.id;
        const { name, cosmetics } = req.body;

        if (!name) return res.status(400).json({ error: 'Team name required' });

        const id = uuidv4();
        if (db.isReady()) {
            // Check if user already owns a team in active season?
            // For MVP, just create.
            // Ensure season exists or link to active one.
            // We'll leave season_id null or fetch active.
            // The prompt says "create team", usually implies active season.
            // I'll leave season_id NULL for now as I don't have logic to find "current" season.

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
    // Option B: Full Replacement of Roster Stats
    const { id: teamId } = req.params;
    const { roster } = req.body; // Expects: [{ playerId: string, stats: { power: 5, ... } }]

    if (!roster || !Array.isArray(roster)) {
        return res.status(400).json({ error: 'Invalid payload: roster array required' });
    }

    if (!db.isReady()) {
        return res.status(503).json({ error: 'Database unavailable' });
    }

    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        // 1. Fetch Team Limits
        const teamRes = await client.query('SELECT skill_pool FROM teams WHERE id = $1 FOR UPDATE', [teamId]);
        if (teamRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Team not found' });
        }
        const skillPoolCap = teamRes.rows[0].skill_pool; // e.g. 30

        // 2. Fetch Current Players (to verify ownership & ARCHETYPE)
        // We need the archetype to calculate base cost.
        const currentPlayersRes = await client.query('SELECT id, archetype FROM players WHERE team_id = $1', [teamId]);
        const playerMap = new Map();
        currentPlayersRes.rows.forEach((p: any) => playerMap.set(p.id, p));

        // 3. Calculate Total Cost
        let totalInvested = 0;

        for (const playerUpdate of roster) {
            const { playerId, stats } = playerUpdate;

            const currentPlayer = playerMap.get(playerId);
            if (!currentPlayer) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Player ${playerId} does not belong to this team` });
            }

            // Iterate over stats (power, contact, speed, defense)
            for (const [key, val] of Object.entries(stats)) {
                const value = val as number;

                // Bounds Check
                if (value < MIN_STAT || value > MAX_STAT) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: `Stat ${key} must be between ${MIN_STAT} and ${MAX_STAT}` });
                }

                // Determine base stat for this archetype/key
                const base = getBaseStat(currentPlayer.archetype, key);

                // Calculate cost FROM BASE
                const cost = calculateCostToReach(base, value);
                totalInvested += cost;
            }
        }

        // 4. Validate Budget
        if (totalInvested > skillPoolCap) {
            await client.query('ROLLBACK');
            return res.status(422).json({
                error: `Insufficient skill points. Required: ${totalInvested}, Available: ${skillPoolCap}`
            });
        }

        // 5. Apply Updates
        for (const playerUpdate of roster) {
            const { playerId, stats } = playerUpdate;
            const currentPlayer = playerMap.get(playerId);

            // Calculate individual invested amount for record-keeping
            let playerInvested = 0;
            for (const [key, val] of Object.entries(stats)) {
                const base = getBaseStat(currentPlayer.archetype, key);
                playerInvested += calculateCostToReach(base, val as number);
            }

            await client.query(
                `UPDATE players SET stats = $1, skill_points_invested = $2 WHERE id = $3`,
                [stats, playerInvested, playerId]
            );
        }

        await client.query('COMMIT');

        // Return updated state
        res.json({
            success: true,
            invested: totalInvested,
            remaining: skillPoolCap - totalInvested
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Update Allocation Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        client.release();
    }
};
