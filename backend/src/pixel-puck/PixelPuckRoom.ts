import { Server, Socket } from 'socket.io';
import { PixelPuckEngine, GameState, InputState, MapData } from '@pixel-puck/engine/PixelPuckEngine';

interface Player {
    socketId: string;
    side: 1 | 2; // 1 = Left (Red), 2 = Right (Blue)
    name?: string;
    connected: boolean;
}

export class PixelPuckRoom {
    id: string;
    engine: PixelPuckEngine;
    p1: Player | null = null;
    p2: Player | null = null;
    io: Server;
    interval: NodeJS.Timeout | null = null;

    // Inputs buffer
    currentInputs: { p1: InputState, p2: InputState } = {
        p1: { dash: false, device: 'keyboard' },
        p2: { dash: false, device: 'keyboard' }
    };

    constructor(id: string, io: Server) {
        this.id = id;
        this.io = io;

        // Standard Map
        const map: MapData = {
            gridW: 12,
            gridH: 8,
            spawns: {
                p1: { x: 2, y: 4 },
                p2: { x: 10, y: 4 },
                puck: { x: 6, y: 4 }
            },
            goals: [
                { owner: 1, y: 2.5, h: 3 }, // Left Goal
                { owner: 2, y: 2.5, h: 3 }  // Right Goal
            ],
            // Add bumpers/tiles later
             bumpers: [
                { x: 6, y: 2, radius: 0.5 },
                { x: 6, y: 6, radius: 0.5 }
            ]
        };

        this.engine = new PixelPuckEngine(map, id); // Use room ID as seed
    }

    addPlayer(socketId: string, name?: string): Player | null {
        if (!this.p1) {
            this.p1 = { socketId, side: 1, name, connected: true };
            return this.p1;
        } else if (!this.p2) {
            this.p2 = { socketId, side: 2, name, connected: true };
            return this.p2;
        }
        return null;
    }

    removePlayer(socketId: string) {
        if (this.p1 && this.p1.socketId === socketId) {
            this.p1.connected = false;
            // For now, if a player leaves, game over or pause?
            // Let's just pause or stop.
            this.stopGame();
            this.broadcast('pp:error', 'Player 1 disconnected');
        } else if (this.p2 && this.p2.socketId === socketId) {
            this.p2.connected = false;
            this.stopGame();
            this.broadcast('pp:error', 'Player 2 disconnected');
        }
    }

    handleInput(socketId: string, input: InputState) {
        if (this.p1 && this.p1.socketId === socketId) {
            this.currentInputs.p1 = input;
        } else if (this.p2 && this.p2.socketId === socketId) {
            this.currentInputs.p2 = input;
        }
    }

    startGame() {
        if (this.interval) clearInterval(this.interval);

        this.broadcast('pp:start', {
            map: this.engine.map,
            p1Name: this.p1?.name,
            p2Name: this.p2?.name
        });

        // Game Loop 60Hz
        this.interval = setInterval(() => {
            this.tick();
        }, 1000 / 60);
    }

    stopGame() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    tick() {
        this.engine.update(this.currentInputs.p1, this.currentInputs.p2);

        // Broadcast State (Snapshot)
        // Optimization: Only send deltas or send every X frames?
        // For local network/good internet, sending every frame (60hz) is fine for 2 players.
        // It's small data.
        this.broadcast('pp:state', this.engine.state);

        if (this.engine.state.gameOver) {
            this.stopGame();
            this.broadcast('pp:game_over', { winner: this.engine.state.winner });
        }
    }

    broadcast(event: string, data: any) {
        this.io.to(this.id).emit(event, data);
    }
}
