export const ELEMENTS = {
    FIRE: 'fire',
    ICE: 'ice',
    METAL: 'metal',
    ENERGY: 'energy'
};

export const SHAPES = {
    LINE: 'line',
    L: 'L',
    T: 'T',
    CROSS: 'cross'
};

export const TIERS = {
    COMMON: 'common',
    RARE: 'rare',
    EPIC: 'epic'
};

export const ARCHETYPES = {
    PISTOL: 'pistol',
    BEAM: 'beam',
    GRENADE: 'grenade',
    MINE: 'mine',
    SHIELD: 'shield',
    TURRET: 'turret' // Optional
};

const BASE_POWER = {
    [ARCHETYPES.PISTOL]: 6,
    [ARCHETYPES.BEAM]: 12,
    [ARCHETYPES.GRENADE]: 18,
    [ARCHETYPES.MINE]: 8,
    [ARCHETYPES.SHIELD]: 0,
    [ARCHETYPES.TURRET]: 10
};

const TIER_MULTIPLIER = {
    [TIERS.COMMON]: 1.0,
    [TIERS.RARE]: 1.5,
    [TIERS.EPIC]: 2.4
};

export class CraftingSystem {
    constructor() {
        this.craftedItems = [];
    }

    /**
     * Converts a match event into a weapon/item.
     * @param {Object} matchData
     * @param {string} matchData.element - fire, ice, metal, energy
     * @param {string} matchData.shape - line, L, T, cross
     * @param {number} matchData.count - number of tiles
     * @returns {Object} Weapon object
     */
    craft(matchData) {
        const { element, shape, count } = matchData;

        // Determine Tier
        let tier = TIERS.COMMON;
        if (count === 4) tier = TIERS.RARE;
        if (count >= 5) tier = TIERS.EPIC;

        // Determine Archetype based on Shape (and optionally Count/Element if we want complexity)
        // Rules from spec:
        // Line (3) -> Common Pistol?
        // Line (5+) -> Beam? Or Rapid Pistol?
        // Spec says: Line -> Beam? No, spec says "Line -> Beam, L -> Grenade, Cross -> Shield"
        // Let's formalize:

        let archetype = ARCHETYPES.PISTOL; // Default

        if (shape === SHAPES.LINE) {
            // Short line = pistol, Long line = beam?
            // Or just Line always equals Beam? Spec example: "3x red Fire line -> Beam".
            // Wait, "Line match (5+) + Energy -> Rapid Pistol".
            // Let's stick to the Spec examples as primary guidance but genericize.

            if (count >= 5) {
                archetype = ARCHETYPES.BEAM; // Stronger linear attack
            } else {
                archetype = ARCHETYPES.PISTOL; // Basic projectile
            }
        } else if (shape === SHAPES.L) {
            archetype = ARCHETYPES.GRENADE; // AoE
        } else if (shape === SHAPES.T) {
            archetype = ARCHETYPES.MINE; // Trap
        } else if (shape === SHAPES.CROSS) {
            archetype = ARCHETYPES.SHIELD; // Defensive
        }

        // Calculate Stats
        const base = BASE_POWER[archetype] || 5;
        const mult = TIER_MULTIPLIER[tier];
        const power = Math.floor(base * mult);

        // Charges/Cooldowns logic
        let charges = 10;
        let cooldownMs = 500;
        let durationMs = 0;
        let aoeRadius = 0;

        switch (archetype) {
            case ARCHETYPES.PISTOL:
                charges = 12;
                cooldownMs = 200; // Fast
                if (element === ELEMENTS.ENERGY) cooldownMs = 100; // Rapid fire
                break;
            case ARCHETYPES.BEAM:
                charges = 5;
                cooldownMs = 800; // Slow, heavy
                break;
            case ARCHETYPES.GRENADE:
                charges = 3;
                cooldownMs = 1000;
                aoeRadius = 1.5;
                break;
            case ARCHETYPES.MINE:
                charges = 5;
                cooldownMs = 500;
                break;
            case ARCHETYPES.SHIELD:
                charges = 1;
                durationMs = 3000 * mult; // 3s, 4.5s, 7.2s
                break;
        }

        const weapon = {
            id: `wpn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            archetype,
            element,
            tier,
            power,
            charges,
            cooldownMs,
            durationMs,
            meta: {
                aoeRadius
            }
        };

        return weapon;
    }
}
