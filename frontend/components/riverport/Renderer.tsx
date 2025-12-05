"use client";
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { drawPlayer } from './PlayerRenderer';

interface GameRendererProps {
    matchId: string;
    token?: string; // If playing
}

export default function GameRenderer({ matchId, token }: GameRendererProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const [status, setStatus] = useState('Connecting...');
    const [gameState, setGameState] = useState<any>(null);
    const [replayMode, setReplayMode] = useState(false);
    const [eventLog, setEventLog] = useState<any[]>([]);
    const [replayIndex, setReplayIndex] = useState(0);

    // Constants (Matching Engine)
    const GAME_WIDTH = 800;
    const GAME_HEIGHT = 600;

    useEffect(() => {
        // Connect Socket
        const socket = io(`${process.env.NEXT_PUBLIC_BACKEND_URL}/matches`, {
            auth: { token }
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            setStatus('Connected. Joining Match...');
            socket.emit('join_match', { matchId, asPlayer: !!token });
        });

        socket.on('match_joined', ({ role }) => {
            setStatus(`Joined as ${role}`);
        });

        socket.on('SNAPSHOT', (data) => {
            // data.state is the GameState
            setGameState(data.state);
            draw(data.state);
        });

        socket.on('error', (err) => {
            console.error(err);
            setStatus(`Error: ${err.message}`);
        });

        return () => {
            socket.disconnect();
        };
    }, [matchId, token]);

    // Replay Logic
    const toggleReplay = async () => {
        if (!replayMode) {
            // Fetch Log
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/matches/${matchId}/events`, {
                     headers: { 'Authorization': `Bearer ${token}` }
                });
                const logs = await res.json();
                setEventLog(logs);
                setReplayIndex(logs.length - 1);
                setReplayMode(true);
            } catch(e) { console.error(e); }
        } else {
            setReplayMode(false);
            // Resume live state?
            // We rely on next SNAPSHOT from socket to update us.
        }
    };

    const renderReplayFrame = () => {
        // This is tricky. We have an event log, but we need STATE to draw.
        // We cannot easily reconstruct full state from just events client-side without the full Engine logic + Roster data.
        // AND the engine is seeded RNG.
        //
        // Option A: Replay just shows the "Last Event" text description?
        // Option B: We assume the user wants to see the "Highlight" described by the event.
        // Option C: We import GameEngine here and re-simulate? (Shared code!)

        // Let's try Option C - Re-simulation Client Side!
        // We have `game-engine` in shared.
        // BUT we need the seed and rosters.
        // gameState (from snapshot) has rosters and matchId.

        // For MVP speed: Just show the event text description overlay for the selected event index.
        // Real replay is Milestone D++.

        const event = eventLog[replayIndex];
        if (!event) return;

        const cvs = canvasRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;

        // Draw Overlay
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 500, GAME_WIDTH, 100);
        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.fillText(`REPLAY [${replayIndex + 1}/${eventLog.length}] ${event.ts}`, 20, 530);
        ctx.font = '24px monospace';
        ctx.fillText(`${event.type.toUpperCase()}: ${JSON.stringify(event.payload)}`, 20, 560);
    };

    useEffect(() => {
        if (replayMode) renderReplayFrame();
    }, [replayIndex, replayMode]);

    // Input Handling
    const handleInput = (actionType: string, payload?: any) => {
        if (!socketRef.current) return;
        socketRef.current.emit('submit_input', {
            matchId,
            action: { type: actionType, payload },
            seq: gameState?.tick || 0
        });
    };

    // Drawing Logic (Ported from index.html)
    const draw = (state: any) => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.fillStyle = '#4a8c4a'; // Grass
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Dirt Diamond
        ctx.fillStyle = '#c2b280';
        ctx.beginPath();
        ctx.moveTo(400, 500); // Home
        ctx.lineTo(600, 350); // 1st
        ctx.lineTo(400, 200); // 2nd
        ctx.lineTo(200, 350); // 3rd
        ctx.fill();

        // Bases
        ctx.fillStyle = '#fff';
        const basesCoords = [{x:600, y:350}, {x:400, y:200}, {x:200, y:350}];
        basesCoords.forEach(b => ctx.fillRect(b.x-10, b.y-10, 20, 20));
        ctx.fillRect(390, 490, 20, 20); // Home

        // Mound
        ctx.fillStyle = '#c2b280';
        ctx.beginPath();
        ctx.arc(400, 350, 20, 0, Math.PI*2);
        ctx.fill();

        // Runners
        if (state.bases) {
            state.bases.forEach((r: any, i: number) => {
                if (r) {
                    // Draw actual player
                    // Direction depends on base? Facing home mostly.
                    drawPlayer(ctx, r, basesCoords[i].x, basesCoords[i].y, true);
                }
            });
        }

        // Players (Pitcher / Batter)
        if (state.phase !== 'MENU') {
            // Determine active players from roster indices in state
            // state.homeRoster, state.currentBatterIndex etc.

            // Current Batter
            let batter = null;
            let pitcher = null;

            // Note: In MVP state, we might not have full roster objects in the snapshot if we optimized it out.
            // But GameEngine.getSnapshot() JSON stringifies the whole state including rosters.

            if (state.isTopInning) {
                // Top: Away Bats, Home Pitches
                if (state.awayRoster && state.currentBatterIndex)
                    batter = state.awayRoster[state.currentBatterIndex.away];
                if (state.homeRoster && state.currentPitcherIndex)
                    pitcher = state.homeRoster[state.currentPitcherIndex.home];
            } else {
                 // Bot: Home Bats, Away Pitches
                if (state.homeRoster && state.currentBatterIndex)
                    batter = state.homeRoster[state.currentBatterIndex.home];
                if (state.awayRoster && state.currentPitcherIndex)
                    pitcher = state.awayRoster[state.currentPitcherIndex.away];
            }

            // Draw Batter
            if (batter) {
                drawPlayer(ctx, batter, 370, 500, true);
            }

            // Draw Pitcher
            if (pitcher) {
                drawPlayer(ctx, pitcher, 400, 350, false);
            }
        }

        // Ball
        const ball = state.ball;
        if (ball && ball.state !== 'idle') {
            const scale = 1 + (ball.z / 50);
            const drawY = ball.y - ball.z * 2;

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, 6, 0, Math.PI*2);
            ctx.fill();

            // Ball
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(ball.x, drawY, 6 * scale, 0, Math.PI*2);
            ctx.fill();

            // Seams
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(ball.x, drawY, 5 * scale, 0, Math.PI, false);
            ctx.stroke();
        }

        // HUD
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, GAME_WIDTH, 50);
        ctx.fillStyle = '#fff';
        ctx.font = '20px monospace';
        ctx.fillText(`HOME: ${state.score.home}  AWAY: ${state.score.away}`, 20, 30);
        ctx.fillText(`INN: ${state.inning} ${state.isTopInning ? 'TOP' : 'BOT'}`, 350, 30);
        ctx.fillText(`B:${state.balls} S:${state.strikes} O:${state.outs}`, 600, 30);

        if (state.lastEvent?.type === 'game_over') {
             ctx.fillStyle = 'rgba(0,0,0,0.8)';
             ctx.fillRect(0, 200, GAME_WIDTH, 200);
             ctx.fillStyle = 'white';
             ctx.font = '40px monospace';
             ctx.textAlign = 'center';
             ctx.fillText("GAME OVER", 400, 300);
        }
    };

    return (
        <div className="flex flex-col items-center">
            <div className="mb-2 font-mono text-sm">{status}</div>
            <div className="relative">
                 <canvas
                    ref={canvasRef}
                    width={GAME_WIDTH}
                    height={GAME_HEIGHT}
                    className="border-4 border-stone-800 shadow-lg bg-green-800"
                    onMouseDown={(e) => {
                         // Simple click to pitch
                         if (gameState?.phase === 'PITCHING' && gameState?.pitchMeter?.active === false) {
                             handleInput('START_PITCH');
                         } else if (gameState?.phase === 'PITCHING') {
                             handleInput('PITCH_PHASE_2'); // Or Throw
                         }
                    }}
                 />

                 {/* Pitch Meter UI Overlay if needed, or draw in Canvas */}
            </div>
            <div className="mt-4 flex gap-4">
                <button className="btn bg-blue-600 text-white p-2 rounded" onClick={() => handleInput('START_PITCH')}>Pitch (Start)</button>
                <button className="btn bg-red-600 text-white p-2 rounded" onClick={() => handleInput('SWING')}>Swing</button>

                <div className="border-l pl-4 ml-4 flex gap-2 items-center">
                    <button className={`btn p-2 rounded ${replayMode ? 'bg-amber-600' : 'bg-gray-600'} text-white`} onClick={toggleReplay}>
                        {replayMode ? 'Exit Replay' : 'Replay Log'}
                    </button>
                    {replayMode && (
                        <input
                            type="range"
                            min="0" max={Math.max(0, eventLog.length - 1)}
                            value={replayIndex}
                            onChange={(e) => setReplayIndex(parseInt(e.target.value))}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
