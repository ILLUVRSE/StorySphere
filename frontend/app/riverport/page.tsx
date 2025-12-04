'use client';

import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { GameEngine, GameState, GameInput, FIELD, GAME_WIDTH, GAME_HEIGHT, PlayerStats } from '@riverport/engine';

// Renderer Implementation (Ported from index.html)
const RENDER_CONSTANTS = {
    C_GRASS: '#4a8c4a',
    C_DIRT: '#c2b280',
    C_BASE: '#ffffff',
    C_BALL: '#ffffff',
    C_BALL_SEAM: '#ff0000',
    TEAM_HOME: { primary: '#004d40', skin: '#ffdbac' },
    TEAM_AWAY: { primary: '#800000', skin: '#e0ac69' }
};

class Renderer {
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;

    constructor(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
        this.ctx = ctx;
        this.canvas = canvas;
    }

    draw(state: GameState, isHomeTeam: boolean) {
        const { ctx } = this;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear
        ctx.fillStyle = RENDER_CONSTANTS.C_GRASS;
        ctx.fillRect(0, 0, width, height);

        // Scale context to match game resolution
        ctx.save();
        const scale = Math.min(width / GAME_WIDTH, height / GAME_HEIGHT);
        ctx.translate((width - GAME_WIDTH * scale) / 2, (height - GAME_HEIGHT * scale) / 2);
        ctx.scale(scale, scale);

        this.drawField();
        this.drawBases(state);
        this.drawPlayers(state);
        this.drawBall(state);
        this.drawUI(state, isHomeTeam);

        ctx.restore();
    }

    private drawField() {
        const { ctx } = this;
        // Dirt Diamond
        ctx.fillStyle = RENDER_CONSTANTS.C_DIRT;
        ctx.beginPath();
        ctx.moveTo(FIELD.homePlate.x, FIELD.homePlate.y);
        ctx.lineTo(FIELD.firstBase.x, FIELD.firstBase.y);
        ctx.lineTo(FIELD.secondBase.x, FIELD.secondBase.y);
        ctx.lineTo(FIELD.thirdBase.x, FIELD.thirdBase.y);
        ctx.fill();

        // Mound
        ctx.beginPath();
        ctx.arc(FIELD.mound.x, FIELD.mound.y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(FIELD.mound.x - 10, FIELD.mound.y - 5, 20, 5); // Rubber
    }

    private drawBases(state: GameState) {
        const { ctx } = this;
        ctx.fillStyle = RENDER_CONSTANTS.C_BASE;
        [FIELD.homePlate, FIELD.firstBase, FIELD.secondBase, FIELD.thirdBase].forEach(pos => {
            ctx.fillRect(pos.x - 10, pos.y - 10, 20, 20);
        });

        // Runners
        state.bases.forEach((runner, i) => {
            if (runner) {
                const pos = [FIELD.firstBase, FIELD.secondBase, FIELD.thirdBase][i];
                // Simple dot for now
                ctx.fillStyle = state.isTopInning ? RENDER_CONSTANTS.TEAM_HOME.primary : RENDER_CONSTANTS.TEAM_AWAY.primary;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y - 10, 10, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    private drawPlayers(state: GameState) {
        const { ctx } = this;

        // Simplified Player Draw for MVP
        const drawPlayer = (x: number, y: number, color: string) => {
             ctx.fillStyle = color;
             ctx.beginPath();
             ctx.arc(x, y - 15, 15, 0, Math.PI * 2); // Body
             ctx.fill();
             ctx.fillStyle = '#ffdbac'; // Skin
             ctx.beginPath();
             ctx.arc(x, y - 30, 8, 0, Math.PI * 2); // Head
             ctx.fill();
        };

        // Pitcher
        const pitcherColor = state.isTopInning ? RENDER_CONSTANTS.TEAM_HOME.primary : RENDER_CONSTANTS.TEAM_AWAY.primary;
        drawPlayer(FIELD.mound.x, FIELD.mound.y, pitcherColor);

        // Batter
        const batterColor = state.isTopInning ? RENDER_CONSTANTS.TEAM_AWAY.primary : RENDER_CONSTANTS.TEAM_HOME.primary;
        drawPlayer(FIELD.homePlate.x - 30, FIELD.homePlate.y, batterColor);
    }

    private drawBall(state: GameState) {
        const { ctx } = this;
        const b = state.ball;

        if (b.state !== 'idle' || state.pitchMeter.active) {
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
            ctx.fill();

            // Ball
            const scale = 1 + (b.z / 50);
            const drawY = b.y - b.z * 2;

            ctx.fillStyle = RENDER_CONSTANTS.C_BALL;
            ctx.beginPath();
            ctx.arc(b.x, drawY, 6 * scale, 0, Math.PI * 2);
            ctx.fill();

            // Seams
            ctx.strokeStyle = RENDER_CONSTANTS.C_BALL_SEAM;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(b.x, drawY, 5 * scale, 0, Math.PI);
            ctx.stroke();
        }
    }

    private drawUI(state: GameState, isHomeTeam: boolean) {
        const { ctx } = this;

        // HUD Background
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, GAME_WIDTH, 60);

        ctx.fillStyle = '#fff';
        ctx.font = "20px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`RIVERPORT: ${state.score.home}`, 20, 35);
        ctx.fillText(`AWAY:      ${state.score.away}`, 600, 35);

        ctx.textAlign = "center";
        ctx.fillText(`INN: ${state.inning} ${state.isTopInning ? 'TOP' : 'BOT'}`, 400, 25);
        ctx.fillText(`B:${state.balls} S:${state.strikes} O:${state.outs}`, 400, 50);

        // Pitch Meter
        if (state.pitchMeter.active) {
            ctx.fillStyle = '#333';
            ctx.fillRect(350, 150, 100, 20);

            // Gradient
            const grad = ctx.createLinearGradient(350, 0, 450, 0);
            grad.addColorStop(0, 'yellow');
            grad.addColorStop(1, 'red');
            ctx.fillStyle = grad;
            ctx.fillRect(350, 150, state.pitchMeter.value, 20);

            ctx.strokeStyle = '#fff';
            ctx.strokeRect(350, 150, 100, 20);
        }

        // Reticle
        if (state.phase === 'BATTING') {
            const r = state.battingReticle;
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(r.x, r.y, 15, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Notifications
        if (state.lastEvent) {
             ctx.fillStyle = "yellow";
             ctx.font = "bold 40px monospace";
             ctx.textAlign = "center";
             ctx.fillText(state.lastEvent, 400, 300);
        }
    }
}

export default function RiverportGame() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [playerId, setPlayerId] = useState<string>("");
    const [matchId, setMatchId] = useState<string>("");
    const [isHome, setIsHome] = useState(true); // Temp toggle

    useEffect(() => {
        setPlayerId(`player-${Math.floor(Math.random() * 1000)}`);
    }, []);

    // Engine & State Ref for loop
    const engineRef = useRef<GameEngine>(new GameEngine(Date.now())); // Local prediction engine
    const rendererRef = useRef<Renderer | null>(null);
    const frameRef = useRef<number>(0);

    // Initial Setup
    useEffect(() => {
        // Connect to backend
        const s = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000');
        setSocket(s);

        s.on('connect', () => {
            console.log("Connected to Game Server");
        });

        s.on('SNAPSHOT', (packet: { tick: number, state: GameState }) => {
            // Basic Reconciliation: Snap to server state for MVP
            // Ideally: apply prediction buffer.
            engineRef.current.state = packet.state;
            setGameState(packet.state);
        });

        // Temp: Auto-create/join match
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
        fetch(backendUrl + '/api/v1/internal/create_match', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                setMatchId(data.matchId);
                s.emit('join_match', { matchId: data.matchId, playerId });
            })
            .catch(err => console.error("Failed to create match", err));

        return () => { s.disconnect(); };
    }, [playerId]);

    // Game Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const renderer = new Renderer(ctx, canvas);
        rendererRef.current = renderer;

        const loop = () => {
            // In a real client, we'd tick() the local engine for prediction here
            // engineRef.current.tick();

            // Draw
            if (engineRef.current.state) {
                renderer.draw(engineRef.current.state, isHome);
            }
            frameRef.current = requestAnimationFrame(loop);
        };

        frameRef.current = requestAnimationFrame(loop);

        return () => cancelAnimationFrame(frameRef.current);
    }, [isHome]);

    // Input Handling
    const handleInput = (inputAction: GameInput['action']) => {
        if (!socket || !matchId) return;

        const input: GameInput = {
            clientId: playerId,
            seq: Date.now(), // Use timestamp as simple seq for now
            ts: Date.now(),
            action: inputAction
        };

        // Predict locally (disabled for pure MVP debugging, enable for feel)
        // engineRef.current.applyInput(input);

        socket.emit('game_input', { matchId, input });
    };

    const handleMouseDown = () => {
        const state = engineRef.current.state;
        if (state.phase === 'PITCHING') {
            if (!state.pitchMeter.active) handleInput({ type: 'START_PITCH' });
            else if (state.pitchMeter.phase === 1) handleInput({ type: 'PITCH_PHASE_2' });
            else if (state.pitchMeter.phase === 2) handleInput({ type: 'THROW_PITCH' });
        } else if (state.phase === 'BATTING') {
            handleInput({ type: 'SWING' });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = GAME_WIDTH / rect.width;
        const scaleY = GAME_HEIGHT / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        handleInput({ type: 'MOVE_RETICLE', payload: { x, y } });
    };

    return (
        <div className="w-full h-screen bg-neutral-900 flex flex-col items-center justify-center p-4">
            <h1 className="text-2xl text-amber-500 mb-2 font-mono">Riverport Baseball (Multiplayer MVP)</h1>
            <div className="text-white text-xs mb-2">
                Match: {matchId || 'Connecting...'} | Player: {playerId}
            </div>
            <canvas
                ref={canvasRef}
                width={800}
                height={600}
                className="bg-green-800 shadow-2xl rounded border-4 border-amber-900 cursor-crosshair max-w-full max-h-[80vh]"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
            />
            <div className="mt-4 flex gap-4">
               <button onClick={() => setIsHome(true)} className={`px-4 py-2 rounded ${isHome ? 'bg-amber-600' : 'bg-gray-700'}`}>Play as Home</button>
               <button onClick={() => setIsHome(false)} className={`px-4 py-2 rounded ${!isHome ? 'bg-amber-600' : 'bg-gray-700'}`}>Play as Away</button>
            </div>
            <div className="mt-2 text-gray-500 text-xs">
                Controls: Click to Pitch (3-click meter) or Swing. Mouse to aim.
            </div>
        </div>
    );
}
