"use client";
import { useState, use } from 'react';

export default function SeasonDashboardPage({ params }: { params: Promise<{ seasonId: string }> }) {
    const { seasonId } = use(params);
    const [status, setStatus] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const advanceWeek = async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/seasons/${seasonId}/advance`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setStatus(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-stone-100 p-8">
            <h1 className="text-3xl font-bold mb-6">Commissioner Dashboard (Season {seasonId})</h1>

            <div className="bg-white p-6 rounded shadow">
                <h2 className="font-bold text-lg mb-4">League Actions</h2>
                <button
                    onClick={advanceWeek}
                    disabled={loading}
                    className="bg-indigo-700 text-white px-4 py-2 rounded hover:bg-indigo-800 disabled:opacity-50"
                >
                    {loading ? 'Simulating...' : 'Simulate Week'}
                </button>

                {status && (
                    <div className="mt-4 p-4 bg-gray-100 rounded">
                        <h3 className="font-bold">Result (Week {status.week})</h3>
                        <p>Simulated {status.simulated} matches.</p>
                        <div className="text-xs font-mono mt-2">
                            {status.results.map((r: any) => (
                                <div key={r.matchId}>{r.matchId.substring(0,8)}: {r.score.home}-{r.score.away}</div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
