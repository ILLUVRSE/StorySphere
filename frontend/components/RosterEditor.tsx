"use client";
import { useState, useEffect } from 'react';

interface RosterEditorProps {
    teamId: string;
    roster: any[];
    skillPool: number;
    onUpdate: () => void; // Refresh parent
}

export default function RosterEditor({ teamId, roster, skillPool, onUpdate }: RosterEditorProps) {
    // For MVP, simple table with "Add Player" if < 13

    const [token, setToken] = useState('');
    useEffect(() => { setToken(localStorage.getItem('token') || ''); }, []);

    const train = async (playerId: string, stat: string) => {
        try {
             const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/teams/${teamId}/skill-allocation`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ playerId, stat, amount: 1 })
            });
            if (res.ok) onUpdate();
        } catch(e) { console.error(e); }
    };

    const addPlayer = async () => {
        if (roster.length >= 13) return;

        const names = ["Rusty", "Bubba", "Hank", "Chip", "Salty", "Doc", "Moose", "Lefty"];
        const randomName = names[Math.floor(Math.random()*names.length)] + " " + Math.floor(Math.random()*100);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/teams/${teamId}/players`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    name: randomName,
                    position: 'bench',
                    archetype: 'Average Joe',
                    stats: { power: 5, speed: 5, fielding: 5, arm: 5, stamina: 5, knees: 5 } // Base stats
                })
            });
            if (res.ok) onUpdate();
        } catch (e) { console.error(e); }
    };

    return (
        <div className="bg-white p-6 rounded shadow mt-6">
            <h2 className="text-xl font-bold mb-4">Roster ({roster.length}/13)</h2>
            <div className="flex justify-between items-center mb-4">
                 <div className="text-emerald-800 font-bold">Available Skill Points: {skillPool}</div>
                 <button
                    onClick={addPlayer}
                    disabled={roster.length >= 13}
                    className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
                 >
                    + Recruit Player
                 </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roster.map(p => (
                    <div key={p.id} className="border p-3 rounded flex flex-col gap-2">
                        <div className="font-bold">{p.name}</div>
                        <div className="text-xs text-gray-500">{p.archetype}</div>
                        <div className="grid grid-cols-2 text-sm gap-1">
                             <div>POW: {p.stats.power} <button onClick={() => train(p.id, 'power')} className="text-blue-600 font-bold ml-1 hover:bg-blue-100 px-1 rounded">+</button></div>
                             <div>SPD: {p.stats.speed} <button onClick={() => train(p.id, 'speed')} className="text-blue-600 font-bold ml-1 hover:bg-blue-100 px-1 rounded">+</button></div>
                             <div>FLD: {p.stats.fielding} <button onClick={() => train(p.id, 'fielding')} className="text-blue-600 font-bold ml-1 hover:bg-blue-100 px-1 rounded">+</button></div>
                             <div>ARM: {p.stats.arm} <button onClick={() => train(p.id, 'arm')} className="text-blue-600 font-bold ml-1 hover:bg-blue-100 px-1 rounded">+</button></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
