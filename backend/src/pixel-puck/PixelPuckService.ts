import { Server, Socket } from 'socket.io';
import { PixelPuckRoom } from './PixelPuckRoom';
import { v4 as uuidv4 } from 'uuid';

export class PixelPuckService {
    io: Server;
    rooms: Map<string, PixelPuckRoom> = new Map();
    queue: { socketId: string, name: string }[] = [];
    playerRoomMap: Map<string, string> = new Map(); // socketId -> roomId

    constructor(io: Server) {
        this.io = io;
    }

    handleConnection(socket: Socket) {
        console.log(`[PixelPuck] User connected: ${socket.id}`);

        socket.on('pp:join_queue', (data: { name: string }) => {
            this.addToQueue(socket, data.name || 'Player');
        });

        socket.on('pp:input', (data) => {
            const roomId = this.playerRoomMap.get(socket.id);
            if (roomId) {
                const room = this.rooms.get(roomId);
                if (room) {
                    room.handleInput(socket.id, data);
                }
            }
        });

        socket.on('disconnect', () => {
            this.handleDisconnect(socket);
        });
    }

    addToQueue(socket: Socket, name: string) {
        // Check if already in a room
        if (this.playerRoomMap.has(socket.id)) return;

        console.log(`[PixelPuck] User ${name} (${socket.id}) joined queue`);

        // Add to queue
        this.queue.push({ socketId: socket.id, name });

        // Try to match
        this.matchmake();
    }

    matchmake() {
        if (this.queue.length >= 2) {
            const p1 = this.queue.shift();
            const p2 = this.queue.shift();

            if (p1 && p2) {
                this.createMatch(p1, p2);
            }
        }
    }

    createMatch(p1: { socketId: string, name: string }, p2: { socketId: string, name: string }) {
        const roomId = `pp_match_${uuidv4()}`;
        console.log(`[PixelPuck] Creating match ${roomId} for ${p1.name} vs ${p2.name}`);

        const room = new PixelPuckRoom(roomId, this.io);
        this.rooms.set(roomId, room);

        // Join sockets to room
        const s1 = this.io.sockets.sockets.get(p1.socketId);
        const s2 = this.io.sockets.sockets.get(p2.socketId);

        if (s1) {
            s1.join(roomId);
            this.playerRoomMap.set(s1.id, roomId);
            const player1 = room.addPlayer(s1.id, p1.name);
            s1.emit('pp:matched', { roomId, side: player1?.side, opponent: p2.name });
        }

        if (s2) {
            s2.join(roomId);
            this.playerRoomMap.set(s2.id, roomId);
            const player2 = room.addPlayer(s2.id, p2.name);
            s2.emit('pp:matched', { roomId, side: player2?.side, opponent: p1.name });
        }

        // Start immediately
        room.startGame();
    }

    handleDisconnect(socket: Socket) {
        // Remove from queue
        this.queue = this.queue.filter(p => p.socketId !== socket.id);

        // Remove from room
        const roomId = this.playerRoomMap.get(socket.id);
        if (roomId) {
            const room = this.rooms.get(roomId);
            if (room) {
                room.removePlayer(socket.id);
                // Cleanup room if empty?
                // For now, PixelPuckRoom handles stopGame on disconnect
                if (!room.p1?.connected && !room.p2?.connected) {
                    this.rooms.delete(roomId);
                }
            }
            this.playerRoomMap.delete(socket.id);
        }
    }
}
