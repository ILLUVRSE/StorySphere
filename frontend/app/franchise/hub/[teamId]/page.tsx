"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BACKEND_URL } from '@/lib/config';
import RosterEditor from '@/components/RosterEditor';

export default function FranchiseHubPage() {
    const params = useParams(); // Should be awaited in Next 15+ but checking implementation details
    // Memory says "Next.js dynamic page components ... must treat params as a Promise and await it".
    // But `useParams` hook handles unwrapping in client components.

    const teamId = params.teamId as string;
    const [team, setTeam] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchTeam = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const res = await fetch(`${BACKEND_URL}/api/teams/${teamId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to load team");
            const data = await res.json();
            setTeam(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (teamId) fetchTeam();
    }, [teamId]);

    if (loading) return <div className="p-8 text-white">Loading Franchise...</div>;
    if (error) return <div className="p-8 text-red-400">Error: {error}</div>;
    if (!team) return <div className="p-8 text-white">Team not found</div>;

    return (
        <div className="min-h-screen bg-neutral-900 text-white">
            {/* Header */}
            <div className="bg-neutral-800 border-b border-neutral-700 p-6">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-emerald-400">{team.name}</h1>
                        <div className="text-neutral-400 text-sm">Season 1 • 0-0 Record</div>
                    </div>
                    <div className="bg-neutral-900 px-4 py-2 rounded border border-neutral-700">
                        <span className="text-neutral-400 text-sm uppercase tracking-wider">Skill Pool Cap</span>
                        <div className="text-2xl font-mono text-emerald-400 text-right">{team.skill_pool}</div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto p-6">
                <RosterEditor
                    teamId={teamId}
                    roster={team.roster || []}
                    skillPool={team.skill_pool}
                    onUpdate={fetchTeam}
                />
            </div>
        </div>
    );
}
