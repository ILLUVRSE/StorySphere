"use client";
import { useState, use } from 'react';
import GameRenderer from '../../../components/riverport/Renderer';

export default function MatchLobbyPage({ params }: { params: Promise<{ matchId: string }> }) {
    const { matchId } = use(params);
    const [token, setToken] = useState<string | undefined>(undefined);

    // Hydration check for token
    useState(() => {
        if (typeof window !== 'undefined') {
            setToken(localStorage.getItem('token') || undefined);
        }
    });

    return (
        <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center p-4">
            <h1 className="text-white text-2xl mb-4 font-mono">Match: {matchId}</h1>
            <GameRenderer matchId={matchId} token={token} />
        </div>
    );
}
