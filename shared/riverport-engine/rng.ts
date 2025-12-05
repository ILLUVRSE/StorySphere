import seedrandom from 'seedrandom';

export class RNG {
    private rng: seedrandom.PRNG;

    constructor(seed: string) {
        this.rng = seedrandom(seed);
    }

    // Returns float between 0 and 1
    next(): number {
        return this.rng();
    }

    // Returns integer between min and max (inclusive)
    nextInt(min: number, max: number): number {
        return Math.floor(this.rng() * (max - min + 1)) + min;
    }

    // Returns true if random float < chance
    check(chance: number): boolean {
        return this.rng() < chance;
    }
}
