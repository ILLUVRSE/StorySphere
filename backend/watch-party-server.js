#!/usr/bin/env node
// Simple WebSocket watch-party signaling server for dev use (no auth).

const { WebSocketServer } = require("ws");

const PORT = process.env.WATCH_PARTY_PORT || 8080;

const wss = new WebSocketServer({ port: Number(PORT) });

const rooms = new Map(); // roomId -> { clients: Set<ws>, host: ws | null }

function createRoom(ws) {
  const roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
  rooms.set(roomId, { clients: new Set([ws]), host: ws });
  ws.roomId = roomId;
  ws.isHost = true;
  ws.send(JSON.stringify({ type: "roomCreated", roomId }));
  console.log(`[watch-party] room ${roomId} created`);
}

function joinRoom(ws, roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    ws.send(JSON.stringify({ type: "error", message: "room_not_found" }));
    return;
  }
  room.clients.add(ws);
  ws.roomId = roomId;
  ws.isHost = false;
  ws.send(JSON.stringify({ type: "joined", roomId, host: Boolean(room.host) }));
  console.log(`[watch-party] client joined room ${roomId}`);
}

function broadcast(roomId, message, sender) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const client of room.clients) {
    if (client !== sender && client.readyState === client.OPEN) {
      client.send(message);
    }
  }
}

wss.on("connection", (ws) => {
  ws.isHost = false;
  ws.roomId = null;

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "invalid_json" }));
      return;
    }

    switch (msg.type) {
      case "createRoom":
        createRoom(ws);
        break;
      case "joinRoom":
        if (typeof msg.roomId === "string") {
          joinRoom(ws, msg.roomId);
        }
        break;
      case "sync":
        if (!ws.roomId || !ws.isHost) return;
        broadcast(ws.roomId, JSON.stringify({
          type: "sync",
          playing: !!msg.playing,
          position: Number(msg.position) || 0,
          timestamp: Date.now(),
        }), ws);
        break;
      case "ping":
        ws.send(JSON.stringify({ type: "pong", t: Date.now() }));
        break;
      default:
        break;
    }
  });

  ws.on("close", () => {
    const roomId = ws.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.clients.delete(ws);
    if (room.clients.size === 0) {
      rooms.delete(roomId);
      console.log(`[watch-party] room ${roomId} removed (empty)`);
    } else if (ws.isHost) {
      // promote first remaining client to host for simplicity
      const [newHost] = room.clients;
      room.host = newHost || null;
      if (newHost) {
        newHost.isHost = true;
        newHost.send(JSON.stringify({ type: "hostPromoted" }));
      }
    }
  });
});

wss.on("listening", () => {
  console.log(`[watch-party] server listening on ws://localhost:${PORT}`);
});
