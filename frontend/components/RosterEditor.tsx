"use client";
import { useState, useEffect, useMemo } from 'react';
import { BACKEND_URL } from '@/lib/config';

interface RosterEditorProps {
    teamId: string;
    roster: any[];
    skillPool: number;
    onUpdate: () => void;
}

const STAT_NAMES = ['power', 'contact', 'speed', 'defense'];
const VALID_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'Bench'];
const MAX_ROSTER = 13;
const BASE_STAT_VAL = 1;

// Ramped Cost Logic
// 0-5: 1pt, 6-8: 2pts, 9-10: 3pts
function calculateCostToReach(targetLevel: number): number {
    if (targetLevel <= BASE_STAT_VAL) return 0;
    let cost = 0;
    for (let lvl = BASE_STAT_VAL + 1; lvl <= targetLevel; lvl++) {
        if (lvl <= 5) cost += 1;
        else if (lvl <= 8) cost += 2;
        else cost += 3;
    }
    return cost;
}

export default function RosterEditor({ teamId, roster, skillPool, onUpdate }: RosterEditorProps) {
    const [localRoster, setLocalRoster] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Add Player Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [newPlayerName, setNewPlayerName] = useState('');
    const [newPlayerPos, setNewPlayerPos] = useState('Bench');

    // Sync prop roster to local state on load
    useEffect(() => {
        // Deep copy to allow local mutations
        setLocalRoster(JSON.parse(JSON.stringify(roster)));
    }, [roster]);

    // Calculate Invested Points
    const { totalInvested, remainingPoints, isValid } = useMemo(() => {
        let total = 0;
        localRoster.forEach(p => {
            STAT_NAMES.forEach(stat => {
                total += calculateCostToReach(p.stats[stat]);
            });
        });
        return {
            totalInvested: total,
            remainingPoints: skillPool - total,
            isValid: total <= skillPool
        };
    }, [localRoster, skillPool]);

    const handleStatChange = (playerId: string, stat: string, val: number) => {
        const newValue = Math.max(0, Math.min(10, val));
        setLocalRoster(prev => prev.map(p => {
            if (p.id === playerId) {
                return { ...p, stats: { ...p.stats, [stat]: newValue } };
            }
            return p;
        }));
    };

    const saveChanges = async () => {
        if (!isValid) return;
        setSaving(true);
        setError('');
        const token = localStorage.getItem('token');

        try {
            // Transform localRoster to payload expected by Option B (full replacement)
            // Payload: { roster: [ { playerId, stats: {...} } ] }
            const payload = {
                roster: localRoster.map(p => ({
                    playerId: p.id,
                    stats: p.stats
                }))
            };

            const res = await fetch(`${BACKEND_URL}/api/teams/${teamId}/skill-allocation`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to save');
            }

            // Refresh parent
            onUpdate();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const addPlayer = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${BACKEND_URL}/api/teams/${teamId}/players`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: newPlayerName,
                    position: newPlayerPos,
                    archetype: 'Standard', // Default for now
                    stats: { power: 1, contact: 1, speed: 1, defense: 1 } // Defaults
                })
            });

            if (res.ok) {
                setShowAddModal(false);
                setNewPlayerName('');
                onUpdate();
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="bg-neutral-800 p-4 rounded flex justify-between items-center sticky top-0 z-10 border-b border-neutral-700 shadow-md">
                <div className="flex items-center gap-4">
                    <div className="text-sm text-neutral-400">Roster Size: <span className={localRoster.length >= MAX_ROSTER ? 'text-red-400' : 'text-emerald-400'}>{localRoster.length}/{MAX_ROSTER}</span></div>
                    <div className="text-sm text-neutral-400">
                        Remaining Points: <span className={remainingPoints < 0 ? 'text-red-500 font-bold' : 'text-emerald-400 font-bold'}>{remainingPoints}</span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setShowAddModal(true)}
                        disabled={localRoster.length >= MAX_ROSTER}
                        className="bg-neutral-700 hover:bg-neutral-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
                    >
                        + Recruit
                    </button>
                    <button
                        onClick={saveChanges}
                        disabled={!isValid || saving || remainingPoints < 0}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-sm disabled:opacity-50 font-bold"
                    >
                        {saving ? 'Saving...' : 'Save Roster'}
                    </button>
                </div>
            </div>

            {error && <div className="bg-red-900/50 text-red-200 p-3 rounded">{error}</div>}

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {localRoster.map(p => (
                    <div key={p.id} className="bg-neutral-800 border border-neutral-700 p-4 rounded shadow-sm hover:border-neutral-600 transition">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className="font-bold text-lg text-emerald-100">{p.name}</div>
                                <div className="text-xs text-emerald-500 font-mono uppercase bg-emerald-900/30 inline-block px-1 rounded">{p.position}</div>
                            </div>
                        </div>

                        <div className="space-y-3 mt-4">
                            {STAT_NAMES.map(stat => {
                                const val = p.stats[stat] || 1;
                                const cost = calculateCostToReach(val);
                                return (
                                    <div key={stat} className="flex items-center justify-between text-sm">
                                        <span className="text-neutral-400 w-16 capitalize">{stat}</span>
                                        <input
                                            type="range"
                                            min="0" max="10"
                                            value={val}
                                            onChange={(e) => handleStatChange(p.id, stat, parseInt(e.target.value))}
                                            className="mx-2 flex-1 accent-emerald-500 cursor-pointer"
                                        />
                                        <span className="w-6 text-right font-mono text-white">{val}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Player Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-neutral-800 p-6 rounded-lg w-full max-w-sm border border-neutral-700">
                        <h3 className="text-xl font-bold mb-4 text-emerald-400">Recruit Player</h3>
                        <form onSubmit={addPlayer} className="space-y-4">
                            <div>
                                <label className="block text-sm mb-1 text-neutral-300">Name</label>
                                <input
                                    className="w-full bg-neutral-900 border border-neutral-700 p-2 rounded text-white"
                                    value={newPlayerName}
                                    onChange={e => setNewPlayerName(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1 text-neutral-300">Position</label>
                                <select
                                    className="w-full bg-neutral-900 border border-neutral-700 p-2 rounded text-white"
                                    value={newPlayerPos}
                                    onChange={e => setNewPlayerPos(e.target.value)}
                                >
                                    {VALID_POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button type="button" onClick={() => setShowAddModal(false)} className="text-neutral-400 hover:text-white px-3 py-2">Cancel</button>
                                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded">Sign Contract</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
