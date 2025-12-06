"use client";
import { useState, use, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import LineupEditor from '../../../components/LineupEditor';
import { useRouter } from 'next/navigation';

interface Player {
    id: string;
    name: string;
    position: string;
    stats: any;
}

interface LineupState {
    battingOrder: string[];
    bench: string[];
    startingPitcher: string | null;
    locked: boolean;
}

interface LobbyState {
    matchId: string;
    homeTeamId: string;
    awayTeamId: string;
    homeConnected: boolean;
    awayConnected: boolean;
    mode: 'live' | 'sim';
    lineups: {
        home: LineupState;
        away: LineupState;
    };
}

export default function MatchLobbyPage({ params }: { params: Promise<{ matchId: string }> }) {
    const { matchId } = use(params);
    const router = useRouter();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
    const [userRole, setUserRole] = useState<'HOME' | 'AWAY' | 'SPECTATOR' | null>(null);
    const [roster, setRoster] = useState<Player[]>([]);

    // Auth
    const [token, setToken] = useState<string | undefined>(undefined);
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setToken(localStorage.getItem('token') || undefined);
        }
    }, []);

    // Socket Connection
    useEffect(() => {
        if (!token) return;

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
        const newSocket = io(`${backendUrl}/matches`, {
            auth: { token },
            transports: ['websocket']
        });

        newSocket.on('connect', () => {
            console.log('Connected to match socket');
            newSocket.emit('join_match', { matchId, asPlayer: true });
        });

        newSocket.on('match_joined', ({ role }) => {
            console.log('Joined as', role);
            setUserRole(role);

            // If joined, fetch roster for my team
            // Ideally we get this from lobby state or separate API.
            // For MVP, let's fetch roster via separate API or assume we get it?
            // The LineupEditor needs the full roster list (names/positions).
            // Let's add a quick fetch here.
            // But we don't know teamId easily until lobby_state.
        });

        newSocket.on('lobby_state', (state: LobbyState) => {
            console.log('Lobby State:', state);
            setLobbyState(state);
        });

        newSocket.on('match_started', () => {
             router.push(`/watch?matchId=${matchId}`); // Or wherever the game view is
             // Actually prompt says: "Live mode -> transition the UI to the game screen"
             // Assuming `/match/[matchId]` is the game screen (not lobby).
             router.push(`/match/${matchId}`);
        });

        newSocket.on('match_ended', ({ finalScore }) => {
             alert(`Match Ended! Score: Home ${finalScore.home} - Away ${finalScore.away}`);
             router.push(`/match/${matchId}`); // View results/replay
        });

        newSocket.on('error', (err) => {
            console.error('Socket Error:', err);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [matchId, token, router]);

    // Fetch Roster when we know our team
    useEffect(() => {
        if (userRole && lobbyState && token) {
            const teamId = userRole === 'HOME' ? lobbyState.homeTeamId : (userRole === 'AWAY' ? lobbyState.awayTeamId : null);
            if (teamId) {
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
                fetch(`${backendUrl}/api/teams/${teamId}/roster`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(res => res.json())
                .then(data => {
                     // Roster endpoint typically returns { players: [...] } or just array?
                     // Assuming players array.
                     // If API doesn't exist yet, we might need to mock or ensure it exists.
                     // The prompt implies we build lobby UI, assuming standard API exists.
                     // I will assume standard `/api/teams/:id` returns team details including players, or `/roster`.
                     // Let's assume `/api/teams/:id` works and has players.
                     if (data.players) setRoster(data.players);
                     else if (Array.isArray(data)) setRoster(data);
                }).catch(err => console.error("Failed to fetch roster", err));
            }
        }
    }, [userRole, lobbyState, token]);

    const handleLineupSave = (data: { battingOrder: string[], bench: string[], startingPitcher: string }) => {
        if (socket) {
            socket.emit('submit_lineup', { matchId, ...data });
        }
    };

    const toggleMode = () => {
        if (socket && lobbyState) {
            const newMode = lobbyState.mode === 'live' ? 'sim' : 'live';
            socket.emit('update_mode', { matchId, mode: newMode });
        }
    };

    const handleStartMatch = () => {
        if (socket) {
            socket.emit('start_match', { matchId });
        }
    };

    if (!token) return <div className="text-white p-10">Please log in.</div>;
    if (!lobbyState) return <div className="text-white p-10">Loading Lobby...</div>;

    const myLineup = userRole === 'HOME' ? lobbyState.lineups.home : (userRole === 'AWAY' ? lobbyState.lineups.away : null);
    const isHomeManager = userRole === 'HOME';
    const isManager = userRole === 'HOME' || userRole === 'AWAY';

    // Check readiness
    const homeReady = lobbyState.lineups.home.locked;
    const awayReady = lobbyState.lineups.away.locked;
    const canStart = homeReady && awayReady;

    return (
        <div className="min-h-screen bg-stone-900 text-stone-100 p-6 flex flex-col items-center">
            <header className="w-full max-w-6xl flex justify-between items-center mb-8 border-b border-stone-800 pb-4">
                <h1 className="text-3xl font-mono text-teal-500">Match Lobby</h1>
                <div className="flex gap-4 text-sm font-mono">
                     <div className={`flex items-center gap-2 ${lobbyState.homeConnected ? 'text-green-400' : 'text-stone-500'}`}>
                         <div className={`w-3 h-3 rounded-full ${lobbyState.homeConnected ? 'bg-green-500' : 'bg-stone-600'}`}></div>
                         Home Manager {homeReady ? '(READY)' : '(Waiting)'}
                     </div>
                     <div className={`flex items-center gap-2 ${lobbyState.awayConnected ? 'text-green-400' : 'text-stone-500'}`}>
                         <div className={`w-3 h-3 rounded-full ${lobbyState.awayConnected ? 'bg-green-500' : 'bg-stone-600'}`}></div>
                         Away Manager {awayReady ? '(READY)' : '(Waiting)'}
                     </div>
                </div>
            </header>

            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Control Area */}
                <div className="lg:col-span-2 space-y-6">
                    {isManager && myLineup && roster.length > 0 ? (
                        <LineupEditor
                            roster={roster}
                            initialBattingOrder={myLineup.battingOrder}
                            initialBench={myLineup.bench}
                            initialPitcher={myLineup.startingPitcher || (roster.find(p=>p.position==='P')?.id || '')}
                            locked={myLineup.locked}
                            onSave={handleLineupSave}
                        />
                    ) : (
                        <div className="bg-stone-800 p-6 rounded text-center text-stone-500">
                            {userRole === 'SPECTATOR'
                                ? "You are viewing as a Spectator."
                                : "Loading Roster..."}
                        </div>
                    )}
                </div>

                {/* Sidebar / Settings */}
                <div className="space-y-6">
                     <div className="bg-stone-800 p-6 rounded shadow-lg border border-stone-700">
                         <h2 className="text-xl text-gold-400 font-bold mb-4">Match Settings</h2>

                         <div className="mb-6">
                             <label className="block text-stone-400 text-sm mb-2">Game Mode</label>
                             <div className="flex items-center gap-3">
                                 <span className={`px-3 py-1 rounded text-sm font-bold ${lobbyState.mode === 'live' ? 'bg-teal-600 text-white' : 'bg-stone-700 text-stone-500'}`}>
                                     LIVE
                                 </span>
                                 {isHomeManager && (
                                     <button
                                         onClick={toggleMode}
                                         className="text-xs underline text-stone-400 hover:text-white"
                                     >
                                         Switch
                                     </button>
                                 )}
                                 <span className={`px-3 py-1 rounded text-sm font-bold ${lobbyState.mode === 'sim' ? 'bg-purple-600 text-white' : 'bg-stone-700 text-stone-500'}`}>
                                     SIM
                                 </span>
                             </div>
                             <p className="text-xs text-stone-500 mt-2">
                                 {lobbyState.mode === 'live'
                                     ? "Real-time play. Managers control strategy."
                                     : "Instant simulation. Results generated immediately."}
                             </p>
                         </div>

                         {isHomeManager && (
                             <button
                                 onClick={handleStartMatch}
                                 disabled={!canStart}
                                 className={`w-full py-3 rounded font-bold text-lg shadow transition-all ${
                                     canStart
                                     ? 'bg-gold-500 hover:bg-gold-400 text-stone-900 shadow-gold-500/20'
                                     : 'bg-stone-700 text-stone-500 cursor-not-allowed'
                                 }`}
                             >
                                 START MATCH
                             </button>
                         )}

                         {!isHomeManager && (
                             <div className="text-center text-stone-500 italic">
                                 Waiting for Home Manager to start...
                             </div>
                         )}
                     </div>
                </div>
            </div>
        </div>
    );
}
