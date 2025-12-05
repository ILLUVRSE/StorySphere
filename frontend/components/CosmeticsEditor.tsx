"use client";
import { useState } from 'react';

interface CosmeticsEditorProps {
    teamId: string;
    initialCosmetics: any;
    onSave: () => void;
}

export default function CosmeticsEditor({ teamId, initialCosmetics, onSave }: CosmeticsEditorProps) {
    const [hatColor, setHatColor] = useState(initialCosmetics.hatColor || '#000000');
    const [shirtColor, setShirtColor] = useState(initialCosmetics.shirtColor || '#ffffff');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        const token = localStorage.getItem('token');
        try {
            // Need PUT endpoint for team
            // For MVP, we might need to add this endpoint logic.
            // Assuming /api/teams/:id supports PUT or we use specific cosmetics endpoint.
            // The plan said "Integrate with PUT /api/teams/:id".

            // Wait, existing /api/teams/:id is GET in routes.ts?
            // Let's check routes.ts.
            // We only have POST (create) and GET (read) and PUT skill-allocation.
            // We need to add PUT update.

            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/teams/${teamId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ cosmetics: { hatColor, shirtColor } })
            });

            if (res.ok) onSave();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded shadow mt-6 border-t-4 border-amber-600">
            <h2 className="text-xl font-bold mb-4">Team Cosmetics</h2>
            <div className="flex gap-8 mb-4">
                <div>
                    <label className="block text-sm font-bold">Hat Color</label>
                    <input
                        type="color"
                        value={hatColor}
                        onChange={e => setHatColor(e.target.value)}
                        className="h-10 w-20"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold">Jersey Color</label>
                    <input
                        type="color"
                        value={shirtColor}
                        onChange={e => setShirtColor(e.target.value)}
                        className="h-10 w-20"
                    />
                </div>

                {/* Preview */}
                <div className="flex items-end pb-2">
                    <div className="text-sm mr-2">Preview:</div>
                    <div className="relative w-12 h-12">
                         {/* Simple CSS preview */}
                         <div className="absolute bottom-0 w-8 h-8 rounded-full left-2" style={{backgroundColor: shirtColor}}></div>
                         <div className="absolute top-1 w-6 h-6 rounded-full left-3" style={{backgroundColor: '#ffdbac'}}></div>
                         <div className="absolute top-0 w-6 h-3 rounded-t-full left-3" style={{backgroundColor: hatColor}}></div>
                    </div>
                </div>
            </div>
            <button
                onClick={save}
                disabled={saving}
                className="bg-amber-700 text-white px-4 py-2 rounded hover:bg-amber-800"
            >
                {saving ? 'Saving...' : 'Update Uniforms'}
            </button>
        </div>
    );
}
