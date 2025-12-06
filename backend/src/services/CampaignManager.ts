import { db } from '../db';
import { SkirmishEngine } from '../skirmish-engine/engine';
import { SkirmishState, SkirmishConfig } from '../skirmish-engine/types';
import { Server } from 'socket.io';

interface CampaignMatch {
    id: string;
    players: { id: string, house: string, role: 'ATTACKER' | 'DEFENDER' }[];
    map: any; // Simplified for MVP
    skirmish: {
        engine: SkirmishEngine;
        state: SkirmishState;
    } | null;
}

export class CampaignManager {
    private activeMatches: Map<string, CampaignMatch> = new Map();
    private io: Server | null = null;

    constructor() {}

    public setIo(io: Server) {
        this.io = io;
    }

    public async createMatch(p1Id: string, p2Id: string): Promise<string> {
        if (!db.isReady()) throw new Error("DB not ready");

        // Create generic match row
        const res = await db.query(
            `INSERT INTO matches (type, players, status, campaign_state)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [
                'campaign',
                JSON.stringify([
                    { id: p1Id, house: 'Stag', role: 'ATTACKER' },
                    { id: p2Id, house: 'Raven', role: 'DEFENDER' }
                ]),
                'in_progress',
                JSON.stringify({ territories: { 'Central': { owner: null } } }) // Dummy Map
            ]
        );
        const matchId = res.rows[0].id;

        // Load into memory
        await this.loadMatch(matchId);

        return matchId;
    }

    public async loadMatch(matchId: string): Promise<CampaignMatch> {
        if (this.activeMatches.has(matchId)) return this.activeMatches.get(matchId)!;

        const res = await db.query('SELECT * FROM matches WHERE id = $1', [matchId]);
        if (res.rows.length === 0) throw new Error("Match not found");
        const row = res.rows[0];

        const match: CampaignMatch = {
            id: matchId,
            players: row.players || [],
            map: row.campaign_state || {},
            skirmish: null
        };

        this.activeMatches.set(matchId, match);
        return match;
    }

    public async joinMatch(socketId: string, matchId: string, userId: string): Promise<any> {
        let match = this.activeMatches.get(matchId);
        if (!match) {
            try {
                match = await this.loadMatch(matchId);
            } catch (e) {
                return null;
            }
        }

        const player = match.players.find(p => p.id === userId);
        if (!player) return null; // Spectator or Unauthorized

        // Broadcast current state
        if (this.io) {
            this.io.to(socketId).emit('campaign_state', {
                map: match.map,
                skirmish: match.skirmish ? match.skirmish.state : null
            });
        }

        return player.role;
    }

    // Actions

    public async startSkirmish(matchId: string, userId: string, territoryId: string) {
        const match = this.activeMatches.get(matchId);
        if (!match) return;

        // Init Engine (Siege Scenario)
        const engine = new SkirmishEngine({
            scenario: 'SIEGE',
            mandatoryCaptures: true,
            turnTimeLimitMs: 60000
        });

        match.skirmish = {
            engine,
            state: engine.state
        };

        this.broadcast(matchId, 'skirmish_started', {
            territoryId,
            state: engine.state
        });
    }

    public async handleMove(matchId: string, userId: string, move: { from: any, to: any }) {
        const match = this.activeMatches.get(matchId);
        if (!match || !match.skirmish) return;

        // Validate Turn
        const player = match.players.find(p => p.id === userId);
        if (!player) return;

        const engineOwner = player.role === 'ATTACKER' ? 1 : -1;

        if (match.skirmish.state.turn !== engineOwner) {
            console.warn(`Not ${userId}'s turn`);
            return;
        }

        // Process
        const result = match.skirmish.engine.processMove(move.from, move.to);

        if (result.valid) {
            this.broadcast(matchId, 'skirmish_update', {
                move: result.move,
                state: result.state
            });

            if (result.state.winner) {
                await this.endSkirmish(matchId, result.state.winner);
            }
        }
    }

    private async endSkirmish(matchId: string, winner: number) {
        const match = this.activeMatches.get(matchId);
        if (!match) return;

        const winnerRole = winner === 1 ? 'ATTACKER' : 'DEFENDER';

        this.broadcast(matchId, 'skirmish_ended', { winner: winnerRole });
        match.skirmish = null;
    }

    private broadcast(matchId: string, event: string, payload: any) {
        if (this.io) {
            this.io.to(`match:${matchId}`).emit(event, payload);
        }
    }
}
