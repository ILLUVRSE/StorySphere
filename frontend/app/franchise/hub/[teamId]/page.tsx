"use client";
import { useState, useEffect, use } from 'react';
import RosterEditor from '../../../components/RosterEditor';

export default function FranchiseHubPage({ params }: { params: Promise<{ teamId: string }> }) {
    const { teamId } = use(params);
    const [team, setTeam] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchTeam = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/teams/${teamId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setTeam(await res.json());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeam();
    }, [teamId]);

    if (loading) return <div className="p-8">Loading Franchise...</div>;
    if (!team) return <div className="p-8">Team not found or access denied.</div>;

    return (
        <div className="min-h-screen bg-stone-100 p-8">
            <h1 className="text-4xl font-black text-stone-800 mb-2 uppercase tracking-wide">{team.name}</h1>
            <div className="text-stone-600 mb-8">Season 1 • Wins: {team.wins} • Losses: {team.losses}</div>

            <RosterEditor
                teamId={teamId}
                roster={team.roster || []}
                skillPool={team.skill_pool}
                onUpdate={fetchTeam}
            />
        </div>
    );
}
