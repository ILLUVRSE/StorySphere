'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { PixelPuckEngine, GameState, MapData, InputState } from '@pixel-puck/engine/PixelPuckEngine';

export default function PixelPuckOnline() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<'idle' | 'queuing' | 'playing' | 'game_over'>('idle');
  const [matchInfo, setMatchInfo] = useState<{ roomId: string, side: number, opponent: string } | null>(null);
  const [ping, setPing] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PixelPuckEngine | null>(null);
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  const [winner, setWinner] = useState<number | null>(null);

  // Constants
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

  useEffect(() => {
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
      // Ping loop
      setInterval(() => {
          const start = Date.now();
          newSocket.emit('ping', () => {
              setPing(Date.now() - start);
          });
      }, 2000);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      setStatus('idle');
    });

    newSocket.on('pp:matched', (data) => {
      console.log('Matched!', data);
      setMatchInfo(data);
      setStatus('playing');
    });

    newSocket.on('pp:start', (data: { map: MapData }) => {
      console.log('Game Start!', data);
      engineRef.current = new PixelPuckEngine(data.map, 'client');
      if (matchInfo?.roomId) {
          // Re-seed if needed, but for now we trust the state snapshots
      }
    });

    newSocket.on('pp:state', (state: GameState) => {
        if (engineRef.current) {
            // Server reconciliation: Snap to server state for now
            // For smooth prediction, we'd replay inputs on top of this,
            // but for MVP "no lag" usually means input responsiveness.
            // We will run client physics and lerp/snap.
            // For this implementation: Just snap. 60Hz update is fast enough.
            engineRef.current.state = state;
        }
    });

    newSocket.on('pp:game_over', (data) => {
        setStatus('game_over');
        setWinner(data.winner);
    });

    newSocket.on('pp:error', (msg) => {
        alert(msg);
        setStatus('idle');
    });

    return () => {
      newSocket.disconnect();
    };
  }, [BACKEND_URL]);

  // Input Handling
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (status !== 'playing') return;
          const input = getInputState(e.code, true);
          if (input) sendInput(input);
      };

      const handleKeyUp = (e: KeyboardEvent) => {
          if (status !== 'playing') return;
          const input = getInputState(e.code, false);
          if (input) sendInput(input);
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);

      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
      };
  }, [status, socket]);

  // Track key states manually for continuous polling
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
      const down = (e: KeyboardEvent) => { keysPressed.current[e.code] = true; };
      const up = (e: KeyboardEvent) => { keysPressed.current[e.code] = false; };
      window.addEventListener('keydown', down);
      window.addEventListener('keyup', up);
      return () => {
          window.removeEventListener('keydown', down);
          window.removeEventListener('keyup', up);
      };
  }, []);

  const sendInput = (input: InputState) => {
      if (socket && matchInfo) {
          socket.emit('pp:input', input);
      }
  };

  // Game Loop (Rendering & Input Polling)
  useEffect(() => {
      const animate = (time: number) => {
          if (status === 'playing' && engineRef.current && canvasRef.current) {
              const dt = time - lastTimeRef.current;

              // Poll Inputs
              const move = { x: 0, y: 0 };
              if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp']) move.y -= 1;
              if (keysPressed.current['KeyS'] || keysPressed.current['ArrowDown']) move.y += 1;
              if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft']) move.x -= 1;
              if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight']) move.x += 1;

              const dash = keysPressed.current['Space'] || keysPressed.current['Enter'] || false;

              // Normalize
              let moveVector = move;
              const mag = Math.sqrt(move.x*move.x + move.y*move.y);
              if (mag > 0) {
                  moveVector = { x: move.x/mag, y: move.y/mag };
              }

              const input: InputState = {
                  moveVector,
                  dash,
                  device: 'keyboard'
              };

              // Send input every frame? Or only on change?
              // For smoothness, send regularly.
              // Optimization: throttle sending to 30hz or 60hz.
              if (socket) socket.emit('pp:input', input);

              // Client Prediction (Optional for now, relying on server snap)
              // engineRef.current.update(input, otherInput);

              // Render
              render(canvasRef.current, engineRef.current);
          }
          lastTimeRef.current = time;
          requestRef.current = requestAnimationFrame(animate);
      };

      requestRef.current = requestAnimationFrame(animate);
      return () => {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      };
  }, [status, socket, matchInfo]);

  const joinQueue = () => {
      if (!socket) return;
      const name = prompt("Enter your Display Name:", "Player") || "Guest";
      setStatus('queuing');
      socket.emit('pp:join_queue', { name });
  };

  // Rendering Logic (Ported/Simplified)
  const render = (canvas: HTMLCanvasElement, engine: PixelPuckEngine) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { width, height } = canvas;
      const map = engine.map;

      // Scaling
      const scaleX = width / map.gridW;
      const scaleY = height / map.gridH;
      const scale = Math.min(scaleX, scaleY); // Uniform scale

      const offsetX = (width - map.gridW * scale) / 2;
      const offsetY = (height - map.gridH * scale) / 2;

      ctx.save();
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, width, height);

      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      // Draw Floor
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, map.gridW, map.gridH);

      // Draw Midline
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      ctx.moveTo(map.gridW/2, 0);
      ctx.lineTo(map.gridW/2, map.gridH);
      ctx.stroke();

      // Draw Goals
      map.goals.forEach(g => {
          ctx.fillStyle = g.owner === 1 ? '#400' : '#004';
          if (g.owner === 1) ctx.fillRect(0, g.y, 0.5, g.h);
          else ctx.fillRect(map.gridW - 0.5, g.y, 0.5, g.h);
      });

      // Draw Players
      const drawPlayer = (p: any, color: string, isMe: boolean) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          if (isMe) {
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 0.1;
              ctx.stroke();
          }
      };

      drawPlayer(engine.state.p1, '#f44', matchInfo?.side === 1);
      drawPlayer(engine.state.p2, '#44f', matchInfo?.side === 2);

      // Draw Puck
      ctx.beginPath();
      ctx.arc(engine.state.puck.x, engine.state.puck.y, engine.state.puck.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();

      // Draw Score (in world space for simplicity)
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '2px monospace';
      ctx.fillText(engine.state.p1.score.toString(), map.gridW/2 - 2, 2);
      ctx.fillText(engine.state.p2.score.toString(), map.gridW/2 + 1, 2);

      ctx.restore();
  };

  const getInputState = (code: string, down: boolean): InputState | null => {
      // Helper not strictly needed with polling approach
      return null;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">

      <div className="absolute top-4 left-4 flex gap-4">
        <div className={`w-3 h-3 rounded-full mt-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <div>
          <div className="text-xs text-neutral-500">PING</div>
          <div className="font-mono text-green-400">{ping}ms</div>
        </div>
      </div>

      {status === 'idle' && (
        <div className="p-8 bg-neutral-900 border border-neutral-700 text-center rounded-xl">
            <h1 className="text-4xl font-black mb-6 text-cyan-400">PIXEL PUCK ONLINE</h1>
            <p className="mb-8 text-neutral-400">1v1 Competitive League</p>
            <button onClick={joinQueue} className="w-full text-lg py-6 px-8 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded">
                FIND MATCH
            </button>
        </div>
      )}

      {status === 'queuing' && (
        <div className="p-8 bg-neutral-900 border border-neutral-700 text-center animate-pulse rounded-xl">
            <h2 className="text-2xl font-bold mb-4">SEARCHING FOR OPPONENT...</h2>
            <div className="text-neutral-500">Please wait...</div>
        </div>
      )}

      {status === 'game_over' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
             <div className="p-12 bg-neutral-900 border border-neutral-600 text-center rounded-xl">
                <h2 className="text-5xl font-black mb-4">
                    {winner === matchInfo?.side ? <span className="text-green-500">VICTORY</span> : <span className="text-red-500">DEFEAT</span>}
                </h2>
                <button onClick={() => setStatus('idle')} className="mt-8 py-3 px-6 rounded bg-white text-black hover:bg-gray-200 font-bold">
                    RETURN TO LOBBY
                </button>
            </div>
        </div>
      )}

      <div className={`relative ${status === 'playing' ? 'block' : 'hidden'}`}>
        <div className="flex justify-between mb-2 px-4 text-xl font-bold font-mono">
            <span className="text-red-500">{matchInfo?.side === 1 ? 'YOU (RED)' : matchInfo?.opponent}</span>
            <span className="text-blue-500">{matchInfo?.side === 2 ? 'YOU (BLUE)' : matchInfo?.opponent}</span>
        </div>
        <canvas
            ref={canvasRef}
            width={800}
            height={500}
            className="border-4 border-neutral-800 rounded bg-neutral-900 shadow-2xl shadow-cyan-900/20"
        />
        <div className="mt-4 text-center text-sm text-neutral-500">
            Use WASD or ARROWS to Move • SPACE/ENTER to Dash
        </div>
      </div>
    </div>
  );
}
