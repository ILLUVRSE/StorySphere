import seedrandom from 'seedrandom';

export type RNG = () => number;

export function createRNG(seed: string | number): RNG {
    // seedrandom(seed) returns a function that returns a float 0..1
    // It is deterministic based on the seed.
    return seedrandom(String(seed));
}
