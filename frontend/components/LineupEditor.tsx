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
    initialBattingOrder: string[];
    initialBench: string[];
    initialPitcher: string;
    locked: boolean;
    onSave: (data: { battingOrder: string[], bench: string[], startingPitcher: string }) => void;
}

export default function LineupEditor({ roster, initialBattingOrder, initialBench, initialPitcher, locked, onSave }: LineupEditorProps) {
    const [battingOrder, setBattingOrder] = useState<string[]>(initialBattingOrder);
    const [bench, setBench] = useState<string[]>(initialBench);
    const [startingPitcher, setStartingPitcher] = useState<string>(initialPitcher);

    // Sync state if props change (e.g. initial load)
    useEffect(() => {
        setBattingOrder(initialBattingOrder);
        setBench(initialBench);
        setStartingPitcher(initialPitcher);
    }, [initialBattingOrder, initialBench, initialPitcher]);

    const handleDragStart = (e: React.DragEvent, id: string, source: 'bench' | 'lineup', index?: number) => {
        if (locked) return;
        e.dataTransfer.setData('playerId', id);
        e.dataTransfer.setData('source', source);
        if (index !== undefined) e.dataTransfer.setData('index', index.toString());
    };

    const handleDrop = (e: React.DragEvent, target: 'bench' | 'lineup', targetIndex?: number) => {
        if (locked) return;
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('playerId');
        const source = e.dataTransfer.getData('source') as 'bench' | 'lineup';
        const sourceIndex = parseInt(e.dataTransfer.getData('index') || '-1');

        if (!draggedId) return;

        // Clone states
        let newBattingOrder = [...battingOrder];
        let newBench = [...bench];

        // Remove from source
        if (source === 'lineup') {
            if (sourceIndex >= 0) {
                 // Leave empty spot? Or shift? Typically shift or swap.
                 // Prompt said "Drag a player between batting slots to reorder".
                 // "Drag a player from a batting slot -> Bench to remove".
                 // Let's implement swap logic or simple remove/insert.
                 newBattingOrder = newBattingOrder.filter((_, i) => i !== sourceIndex);
            }
        } else {
            newBench = newBench.filter(id => id !== draggedId);
        }

        // Add to target
        if (target === 'lineup') {
            // If targetIndex provided, insert there.
            if (targetIndex !== undefined) {
                 // If dragging from lineup to lineup, we filtered it out above.
                 // If source was lineup, targetIndex might need adjustment if sourceIndex < targetIndex.
                 // But filtering first makes indices shift.
                 // Simpler: Splice it in.
                 // Constraint: Max 9 slots.
                 // Actually prompt says "9 slots: 1..9".
                 // Should we enforce fixed 9 slots with potential empty nulls?
                 // "Each slot either has a player or is empty."
                 // But validation says "Exactly 9 in batting order."
                 // So we probably want a list that MUST be 9 long.
                 // Let's assume the state `battingOrder` can have less than 9 during edit, but validated on save.

                 newBattingOrder.splice(targetIndex, 0, draggedId);
            } else {
                 newBattingOrder.push(draggedId);
            }
        } else {
            newBench.push(draggedId);
        }

        // Ensure max 9 in batting order?
        // If > 9, move excess to bench? Or just let user manage.
        // Prompt: "Drag a player from Bench -> a batting slot".
        // Let's keep it flexible but visualize the 9 slots.

        setBattingOrder(newBattingOrder);
        setBench(newBench);
    };

    // Improved Logic for Fixed 9 Slots
    // Prompt: "A list of 9 slots: 1, 2, ..., 9. Each slot either has a player or is empty."
    // So `battingOrder` should perhaps be array of size 9 with nulls?
    // But persistence uses string[].
    // Let's map visual slots to the array.
    // Actually, dragging *between* slots implies reordering.
    // If I drop on slot 3, it should insert at 3.

    // Let's stick to the list approach but render 9 slots.
    // If list has 5 items, slots 6-9 are empty.

    const handleSave = () => {
        onSave({ battingOrder, bench, startingPitcher });
    };

    const getPlayer = (id: string) => roster.find(p => p.id === id);

    return (
        <div className="bg-stone-800 p-6 rounded-lg shadow-lg w-full max-w-4xl border border-stone-700">
            <h2 className="text-xl text-teal-400 font-bold mb-4">Lineup Editor {locked && "(Locked)"}</h2>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Batting Order */}
                <div className="flex-1">
                    <h3 className="text-stone-300 font-semibold mb-2">Batting Order (1-9)</h3>
                    <div className="space-y-2">
                        {Array.from({ length: 9 }).map((_, i) => {
                            const playerId = battingOrder[i];
                            const player = playerId ? getPlayer(playerId) : null;

                            return (
                                <div
                                    key={i}
                                    className={`flex items-center gap-3 p-2 rounded border ${
                                        player ? 'bg-stone-700 border-stone-600' : 'bg-stone-900 border-stone-700 border-dashed'
                                    }`}
                                    onDragOver={(e) => !locked && e.preventDefault()}
                                    onDrop={(e) => handleDrop(e, 'lineup', i)}
                                    draggable={!!player && !locked}
                                    onDragStart={(e) => player && handleDragStart(e, player.id, 'lineup', i)}
                                >
                                    <span className="text-stone-500 font-mono w-6 text-center">{i + 1}</span>
                                    {player ? (
                                        <div className="flex-1">
                                            <span className="text-white font-medium">{player.name}</span>
                                            <span className="text-xs text-stone-400 ml-2">{player.position}</span>
                                        </div>
                                    ) : (
                                        <span className="text-stone-600 text-sm italic">Empty Slot</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {battingOrder.length > 9 && (
                         <div className="mt-2 text-red-400 text-sm">
                             Warning: You have {battingOrder.length} players in the batting order. Only first 9 will play.
                         </div>
                    )}
                </div>

                {/* Bench & Pitcher */}
                <div className="flex-1 flex flex-col gap-6">
                     {/* Starting Pitcher */}
                     <div className="bg-stone-900 p-4 rounded border border-stone-700">
                         <h3 className="text-stone-300 font-semibold mb-2">Starting Pitcher</h3>
                         <select
                             className="w-full bg-stone-800 text-white p-2 rounded border border-stone-600"
                             value={startingPitcher}
                             onChange={(e) => setStartingPitcher(e.target.value)}
                             disabled={locked}
                         >
                             {roster.filter(p => p.position === 'P').map(p => (
                                 <option key={p.id} value={p.id}>{p.name} ({p.stats.defense} Def)</option>
                             ))}
                             {/* Allow position players? Usually no, but let's allow fallback */}
                             {roster.filter(p => p.position !== 'P').map(p => (
                                 <option key={p.id} value={p.id}>{p.name} (Pos: {p.position})</option>
                             ))}
                         </select>
                     </div>

                     {/* Bench */}
                     <div
                        className="flex-1 bg-stone-900 p-4 rounded border border-stone-700 min-h-[300px]"
                        onDragOver={(e) => !locked && e.preventDefault()}
                        onDrop={(e) => handleDrop(e, 'bench')}
                     >
                         <h3 className="text-stone-300 font-semibold mb-2">Bench</h3>
                         <div className="grid grid-cols-1 gap-2">
                             {bench.map((id, i) => {
                                 const player = getPlayer(id);
                                 if (!player) return null;
                                 return (
                                     <div
                                        key={id}
                                        className="bg-stone-800 p-2 rounded border border-stone-600 cursor-move hover:bg-stone-700"
                                        draggable={!locked}
                                        onDragStart={(e) => handleDragStart(e, id, 'bench', i)}
                                     >
                                         <span className="text-white text-sm">{player.name}</span>
                                         <span className="text-xs text-stone-400 ml-2">{player.position}</span>
                                     </div>
                                 )
                             })}
                             {bench.length === 0 && (
                                 <span className="text-stone-600 italic text-sm">Bench is empty</span>
                             )}
                         </div>
                     </div>
                </div>
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={locked || battingOrder.length !== 9}
                    className={`px-6 py-2 rounded font-bold text-stone-900 transition-colors ${
                        locked || battingOrder.length !== 9
                        ? 'bg-stone-600 cursor-not-allowed'
                        : 'bg-teal-500 hover:bg-teal-400'
                    }`}
                >
                    {locked ? "Locked" : "Lock Lineup"}
                </button>
                {battingOrder.length !== 9 && !locked && (
                    <span className="ml-4 text-amber-500 self-center">Must have exactly 9 batters.</span>
                )}
            </div>
        </div>
    );
}
