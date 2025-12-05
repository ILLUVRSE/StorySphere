"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateFranchisePage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    const createTeam = async () => {
        // Need auth token here. For MVP assume localStorage or context.
        // I will implement a quick mock/hook for auth in next steps or just assume token presence.
        const token = localStorage.getItem('token');
        if (!token) {
            setError("You must be logged in.");
            return;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/teams`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, cosmetics: { hatColor: '#004d40' } })
            });
            const data = await res.json();
            if (res.ok) {
                // Pre-populate players? The prompt says "Franchise creation/roster editor".
                // We create the team first, then redirect to Hub/Roster editor.
                router.push(`/franchise/hub/${data.id}`);
            } else {
                setError(data.error);
            }
        } catch (e) {
            setError("Failed to connect");
        }
    };

    return (
        <div className="min-h-screen bg-stone-100 p-8">
            <h1 className="text-3xl font-bold text-stone-800 mb-6">Create New Franchise</h1>

            <div className="bg-white p-6 rounded shadow max-w-md">
                {error && <div className="bg-red-100 text-red-800 p-2 mb-4 rounded">{error}</div>}
                <div className="mb-4">
                    <label className="block text-sm font-bold mb-2">Team Name</label>
                    <input
                        className="w-full p-2 border rounded"
                        value={name} onChange={e => setName(e.target.value)}
                        placeholder="e.g. Riverport Scrappers"
                    />
                </div>
                <button
                    className="w-full bg-emerald-700 text-white p-2 rounded font-bold hover:bg-emerald-600"
                    onClick={createTeam}
                >
                    Establish Franchise
                </button>
            </div>
        </div>
    );
}
