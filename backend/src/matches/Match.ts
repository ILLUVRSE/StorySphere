import { GameEngine, GameInput, GameState } from '../../../shared/riverport-engine/src';

export class Match {
    id: string;
    engine: GameEngine;
    clients: Map<string, string>; // socketId -> playerId
    lastSnapshot: GameState;

    constructor(id: string) {
        this.id = id;
        this.engine = new GameEngine(Date.now()); // Deterministic seed per match
        this.clients = new Map();
        this.lastSnapshot = this.engine.getSnapshot();
    }

    addPlayer(socketId: string, playerId: string) {
        this.clients.set(socketId, playerId);
    }

    removePlayer(socketId: string) {
        this.clients.delete(socketId);
    }

    applyInput(input: GameInput) {
        // In the future, validate input.clientId matches player
        this.engine.applyInput(input);
    }

    tick() {
        this.engine.tick();
        this.lastSnapshot = this.engine.getSnapshot();
        return this.lastSnapshot;
    }
}
