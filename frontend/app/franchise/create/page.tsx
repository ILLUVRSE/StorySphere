"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BACKEND_URL } from '@/lib/config';

export default function CreateFranchisePage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [primaryColor, setPrimaryColor] = useState('#004d40');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const token = localStorage.getItem('token');
        if (!token) {
            setError("Authentication required");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${BACKEND_URL}/api/teams`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name,
                    cosmetics: { primaryColor }
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create team');
            }

            const team = await res.json();
            router.push(`/franchise/hub/${team.id}`);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-900 text-white p-8 flex flex-col items-center justify-center">
            <div className="max-w-md w-full bg-neutral-800 p-8 rounded-lg shadow-lg">
                <h1 className="text-3xl font-bold mb-6 text-center text-emerald-400">Establish Franchise</h1>

                {error && <div className="bg-red-900/50 text-red-200 p-3 rounded mb-4">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium mb-1">Team Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full bg-neutral-700 border border-neutral-600 rounded p-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                            placeholder="Riverport Raccoons"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Team Color</label>
                        <div className="flex gap-4 items-center">
                            <input
                                type="color"
                                value={primaryColor}
                                onChange={e => setPrimaryColor(e.target.value)}
                                className="h-10 w-20 cursor-pointer bg-transparent border-0"
                            />
                            <span className="text-neutral-400 font-mono">{primaryColor}</span>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded transition disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : 'Create Franchise'}
                    </button>
                </form>
            </div>
        </div>
    );
}
