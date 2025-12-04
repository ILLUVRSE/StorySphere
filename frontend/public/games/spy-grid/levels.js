import { DIR } from './engine.js';

export const LEVELS = [
    // Level 1: Basics - Just walk to exit
    {
        width: 8,
        height: 8,
        map: [
            "########",
            "#@.....#",
            "#......#",
            "#......#",
            "#......#",
            "#......#",
            "#.....X#",
            "########"
        ],
        guards: [],
        items: [{x: 4, y: 4}],
        props: [],
        hint: "Move to the Exit (X). Collect Loot (Gold)."
    },
    // Level 2: First Guard - Simple patrol
    {
        width: 8,
        height: 8,
        map: [
            "########",
            "#@.....#",
            "###.####",
            "#......#",
            "#......#",
            "####.###",
            "#X.....#",
            "########"
        ],
        guards: [
            { x: 4, y: 4, dir: DIR.W, alertState: 'patrol', patrol: [{x: 4, y: 4}, {x: 2, y: 4}], patrolIndex: 0 }
        ],
        items: [{x: 1, y: 6}],
        hint: "Wait (Space) for the guard to turn away."
    },
    // Level 3: Cover
    {
        width: 8,
        height: 8,
        map: [
            "########",
            "#@..+..#",
            "#......#",
            "#.+.+..#",
            "#......#",
            "#..+.+.#",
            "#X.....#",
            "########"
        ],
        guards: [
             { x: 4, y: 3, dir: DIR.S, alertState: 'patrol', patrol: [{x: 4, y: 3}, {x: 4, y: 5}], patrolIndex: 0 }
        ],
        items: [{x: 6, y: 1}],
        hint: "Hide behind Cover (+)."
    },
    // Level 4: Vents
    // Note: Vents not fully implemented in engine yet (teleport logic needs to be in Main or Engine)
    // I will add them to map but maybe skip complex vent puzzle for MVP unless I add logic.
    // Let's stick to walls/cover for now in tutorial.
    {
        width: 8,
        height: 8,
        map: [
            "########",
            "#@#...X#",
            "#.#.####",
            "#......#",
            "####.###",
            "#......#",
            "#.####.#",
            "########"
        ],
        guards: [
            { x: 5, y: 3, dir: DIR.N, alertState: 'patrol', patrol: [{x: 5, y: 3}, {x: 5, y: 5}], patrolIndex: 0 }
        ],
        items: [{x: 1, y: 6}],
        hint: "Plan your route carefully."
    },
    // Level 5: Two Guards
    {
        width: 8,
        height: 8,
        map: [
            "########",
            "#@.....#",
            "#.#.#.##",
            "#......#",
            "##.#.#.#",
            "#......#",
            "#.....X#",
            "########"
        ],
        guards: [
            { x: 3, y: 3, dir: DIR.E, alertState: 'patrol', patrol: [{x: 3, y: 3}, {x: 6, y: 3}], patrolIndex: 0 },
            { x: 4, y: 5, dir: DIR.W, alertState: 'patrol', patrol: [{x: 4, y: 5}, {x: 1, y: 5}], patrolIndex: 0 }
        ],
        items: [{x: 7, y: 1}],
        hint: "Watch multiple patterns."
    },
    // Level 6: Noise (Decoy) - Place '!' tile
    {
        width: 8,
        height: 8,
        map: [
            "########",
            "#@.....#",
            "###.####",
            "#!.....#",
            "########",
            "#X.....#",
            "########",
            "########"
        ],
        guards: [
            { x: 4, y: 3, dir: DIR.W, alertState: 'patrol', patrol: [{x: 4, y: 3}, {x: 4, y: 3}], patrolIndex: 0 } // Standing guard
        ],
        items: [],
        hint: "Step on Noise (!) to distract guard."
    },
    // Level 7: Tight Squeeze
    {
        width: 8,
        height: 8,
        map: [
            "########",
            "#@#...X#",
            "#.#.####",
            "#.#....#",
            "#...##.#",
            "#####..#",
            "#......#",
            "########"
        ],
        guards: [
             { x: 3, y: 3, dir: DIR.S, alertState: 'patrol', patrol: [{x: 3, y: 3}, {x: 3, y: 6}], patrolIndex: 0 }
        ],
        items: [{x: 6, y: 6}],
        hint: "Timing is key."
    },
     // Level 8: Final Exam
    {
        width: 8,
        height: 8,
        map: [
            "########",
            "#@.....#",
            "#.####.#",
            "#......#",
            "#.####.#",
            "#......#",
            "#X....!#",
            "########"
        ],
        guards: [
            { x: 1, y: 3, dir: DIR.E, alertState: 'patrol', patrol: [{x: 1, y: 3}, {x: 6, y: 3}], patrolIndex: 0 },
            { x: 6, y: 5, dir: DIR.W, alertState: 'patrol', patrol: [{x: 6, y: 5}, {x: 1, y: 5}], patrolIndex: 0 }
        ],
        items: [{x: 3, y: 1}, {x: 3, y: 7}],
        hint: "Good luck."
    }
];
