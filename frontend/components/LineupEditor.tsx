"use client";
import { useState, useEffect } from 'react';

interface Player {
    id: string;
    name: string;
    position: string;
    stats: any;
}

interface LineupEditorProps {
    roster: Player[];
    onSave: (lineup: any) => void;
    isLocked: boolean;
}

export default function LineupEditor({ roster, onSave, isLocked }: LineupEditorProps) {
    const [lineup, setLineup] = useState<Player[]>([]);
    const [bench, setBench] = useState<Player[]>([]);
    const [pitcherId, setPitcherId] = useState('');
    const [pitchers, setPitchers] = useState<Player[]>([]);

    useEffect(() => {
        // Init: Move first 9 to lineup, rest to bench
        // Only if empty (first load)
        if (lineup.length === 0 && bench.length === 0 && roster.length > 0) {
            setLineup(roster.slice(0, 9));
            setBench(roster.slice(9));

            const ps = roster.filter(p => p.position === 'P');
            setPitchers(ps);
            if (ps.length > 0) setPitcherId(ps[0].id);
            else setPitcherId(roster[0].id); // Fallback
        }
    }, [roster]);

    const handleDragStart = (e: React.DragEvent, playerId: string, source: 'lineup' | 'bench') => {
        e.dataTransfer.setData('playerId', playerId);
        e.dataTransfer.setData('source', source);
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number, targetZone: 'lineup' | 'bench') => {
        e.preventDefault();
        const playerId = e.dataTransfer.getData('playerId');
        const source = e.dataTransfer.getData('source');

        if (source === 'bench' && targetZone === 'lineup') {
            // Move Bench -> Lineup (Swap if full?)
            const player = bench.find(p => p.id === playerId);
            if (!player) return;

            if (lineup.length < 9) {
                // Insert
                const newLineup = [...lineup];
                newLineup.splice(targetIndex, 0, player);
                setLineup(newLineup);
                setBench(bench.filter(p => p.id !== playerId));
            } else {
                // Swap with player at targetIndex
                const targetPlayer = lineup[targetIndex];
                const newLineup = [...lineup];
                newLineup[targetIndex] = player;
                setLineup(newLineup);
                setBench([...bench.filter(p => p.id !== playerId), targetPlayer]);
            }
        } else if (source === 'lineup' && targetZone === 'lineup') {
            // Reorder
            const oldIndex = lineup.findIndex(p => p.id === playerId);
            if (oldIndex === -1) return;
            const newLineup = [...lineup];
            const [moved] = newLineup.splice(oldIndex, 1);
            newLineup.splice(targetIndex, 0, moved);
            setLineup(newLineup);
        } else if (source === 'lineup' && targetZone === 'bench') {
             // Remove
             const player = lineup.find(p => p.id === playerId);
             if (!player) return;
             setLineup(lineup.filter(p => p.id !== playerId));
             setBench([...bench, player]);
        }
    };

    const handleSave = () => {
        if (lineup.length !== 9) {
            alert("Lineup must have exactly 9 players.");
            return;
        }
        onSave({
            battingOrder: lineup.map(p => p.id),
            bench: bench.map(p => p.id),
            startingPitcherId: pitcherId
        });
    };

    if (isLocked) {
        return (
            <div className="bg-neutral-800 p-4 rounded text-center text-emerald-400 font-bold border border-emerald-900">
                Lineup Locked
            </div>
        );
    }

    return (
        <div className="bg-neutral-800 p-6 rounded shadow-lg text-white">
            <h2 className="text-xl font-bold mb-4">Set Lineup</h2>

            <div className="mb-6">
                <label className="block text-sm text-neutral-400 mb-1">Starting Pitcher</label>
                <select
                    value={pitcherId}
                    onChange={e => setPitcherId(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 p-2 rounded"
                >
                    {pitchers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>

            <div className="flex gap-4">
                {/* Batting Order */}
                <div className="flex-1">
                    <h3 className="text-sm font-bold text-neutral-400 mb-2">Batting Order (1-9)</h3>
                    <div className="space-y-2 min-h-[400px] border border-neutral-700 p-2 rounded bg-neutral-900/50">
                        {lineup.map((p, index) => (
                            <div
                                key={p.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, p.id, 'lineup')}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDrop(e, index, 'lineup')}
                                className="bg-neutral-700 p-2 rounded flex justify-between items-center cursor-move hover:bg-neutral-600"
                            >
                                <span className="font-mono text-emerald-400 w-6">{index + 1}.</span>
                                <span>{p.name}</span>
                                <span className="text-xs text-neutral-400">{p.position}</span>
                            </div>
                        ))}
                        {lineup.length < 9 && (
                            <div
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDrop(e, lineup.length, 'lineup')}
                                className="border-2 border-dashed border-neutral-700 p-4 text-center text-neutral-500 rounded"
                            >
                                Drag player here
                            </div>
                        )}
                    </div>
                </div>

                {/* Bench */}
                <div className="w-1/3">
                    <h3 className="text-sm font-bold text-neutral-400 mb-2">Bench</h3>
                    <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, 0, 'bench')}
                        className="space-y-2 min-h-[400px] border border-neutral-700 p-2 rounded bg-neutral-900/50"
                    >
                        {bench.map(p => (
                            <div
                                key={p.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, p.id, 'bench')}
                                className="bg-neutral-800 p-2 rounded flex justify-between items-center cursor-move border border-neutral-700 hover:border-neutral-500"
                            >
                                <span>{p.name}</span>
                                <span className="text-xs text-neutral-400">{p.position}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <button
                onClick={handleSave}
                className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded"
            >
                Lock Lineup
            </button>
        </div>
    );
}
