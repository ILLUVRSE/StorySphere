"use client";
import { useState, useEffect, use } from 'react';
import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from '@/lib/config';
import LineupEditor from '../../../components/LineupEditor';
import GameRenderer from '../../../components/riverport/Renderer';

export default function MatchLobbyPage({ params }: { params: Promise<{ matchId: string }> }) {
    const { matchId } = use(params);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [lobbyState, setLobbyState] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<'HOME' | 'AWAY' | 'SPECTATOR'>('SPECTATOR');
    const [myTeamId, setMyTeamId] = useState<string | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const s = io(`${BACKEND_URL}/matches`, {
            auth: { token }
        });

        s.on('connect', () => {
            console.log('Connected to Lobby');
            s.emit('join_match', { matchId, asPlayer: true });
        });

        s.on('match_joined', ({ role, teamId }) => {
            setRole(role);
            if (teamId) setMyTeamId(teamId);
        });

        s.on('lobby_state', (state) => {
            setLobbyState(state);
            setLoading(false);
        });

        s.on('match_started', () => {
            // Reload logic handled by GameRenderer checking status
        });

        s.on('error', (err) => {
            console.error("Socket Error:", err);
        });

        setSocket(s);

        return () => { s.disconnect(); };
    }, [matchId]);

    const handleSaveLineup = (lineup: any) => {
        socket?.emit('submit_lineup', { matchId, lineup });
    };

    const handleStartMatch = () => {
        socket?.emit('start_match', { matchId });
    };

    if (lobbyState?.status === 'in_progress' || lobbyState?.status === 'completed') {
        return <GameRenderer matchId={matchId} token={localStorage.getItem('token') || undefined} />;
    }

    if (loading) return <div className="text-white p-8">Connecting to Stadium...</div>;

    const isHome = role === 'HOME';
    const isAway = role === 'AWAY';
    const myReady = isHome ? lobbyState.home.ready : (isAway ? lobbyState.away.ready : false);

    return (
        <div className="min-h-screen bg-stone-900 p-8 text-white">
            <h1 className="text-3xl font-mono mb-8 text-center border-b border-stone-700 pb-4">Match Lobby</h1>

            <div className="grid grid-cols-3 gap-8 max-w-6xl mx-auto">
                {/* Home */}
                <div className="bg-stone-800 p-6 rounded text-center">
                    <h2 className="text-emerald-400 font-bold text-xl mb-2">Home Team</h2>
                    <div className={`text-sm ${lobbyState.home.connected ? 'text-green-400' : 'text-stone-500'}`}>
                        {lobbyState.home.connected ? 'Manager Connected' : 'Waiting...'}
                    </div>
                    <div className="mt-4">
                        {lobbyState.home.ready ? (
                            <span className="bg-emerald-900 text-emerald-200 px-3 py-1 rounded text-xs font-bold uppercase">Lineup Locked</span>
                        ) : (
                            <span className="bg-yellow-900 text-yellow-200 px-3 py-1 rounded text-xs font-bold uppercase">Preparing...</span>
                        )}
                    </div>
                </div>

                {/* VS / Status */}
                <div className="flex flex-col items-center justify-center">
                    <div className="text-4xl font-bold text-stone-600 mb-6">VS</div>
                    {isHome && lobbyState.home.ready && lobbyState.away.ready && (
                        <button
                            onClick={handleStartMatch}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded shadow-lg animate-pulse"
                        >
                            PLAY BALL!
                        </button>
                    )}
                    {(!isHome || !lobbyState.home.ready || !lobbyState.away.ready) && (
                        <div className="text-stone-500 text-sm">Waiting for lineups...</div>
                    )}
                </div>

                {/* Away */}
                <div className="bg-stone-800 p-6 rounded text-center">
                    <h2 className="text-red-400 font-bold text-xl mb-2">Away Team</h2>
                    <div className={`text-sm ${lobbyState.away.connected ? 'text-green-400' : 'text-stone-500'}`}>
                        {lobbyState.away.connected ? 'Manager Connected' : 'Waiting...'}
                    </div>
                    <div className="mt-4">
                        {lobbyState.away.ready ? (
                            <span className="bg-emerald-900 text-emerald-200 px-3 py-1 rounded text-xs font-bold uppercase">Lineup Locked</span>
                        ) : (
                            <span className="bg-yellow-900 text-yellow-200 px-3 py-1 rounded text-xs font-bold uppercase">Preparing...</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Editor Area */}
            {(isHome || isAway) && myTeamId && (
                <div className="mt-12 max-w-4xl mx-auto">
                    <LineupFetcher
                        teamId={myTeamId}
                        role={role}
                        isLocked={myReady}
                        onSave={handleSaveLineup}
                    />
                </div>
            )}
        </div>
    );
}

// Helper to fetch roster
function LineupFetcher({ teamId, isLocked, onSave }: any) {
    const [roster, setRoster] = useState<any[]>([]);

    useEffect(() => {
        const fetchTeam = async () => {
            const token = localStorage.getItem('token');
            try {
                const res = await fetch(`${BACKEND_URL}/api/teams/${teamId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.roster) setRoster(data.roster);
            } catch(e) {}
        };
        if (teamId) fetchTeam();
    }, [teamId]);

    if (roster.length === 0) return <div className="text-center text-stone-500 mt-8">Loading Roster...</div>;

    return <LineupEditor roster={roster} onSave={onSave} isLocked={isLocked} />;
}
