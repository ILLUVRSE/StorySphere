
import { TILE } from './tiles.js';

/*
Level Format:
{
  w: width,
  h: height,
  map: [string array],
  hint: "Text",
  par: seconds or ticks
}
*/

export const PUZZLES = [
  {
    w: 9, h: 7,
    map: [
      "#########",
      "#S......#",
      "#.#####.#",
      "#.......#",
      "#.#####.#",
      "#......E#",
      "#########"
    ],
    hint: "Move with WASD / Arrows.",
    par: 10
  },
  {
    w: 9, h: 7,
    map: [
      "#########",
      "#S......#",
      "#TTTTTTT#",
      "#.......#",
      "#TTTTTTT#",
      "#......E#",
      "#########"
    ],
    hint: "Toggle Blocks (T) switch every 4 ticks. Wait or REWIND (R/Space) to fix mistakes.",
    par: 15
  },
  {
    w: 9, h: 7,
    map: [
      "#########",
      "#S.|.|.E#",
      "#..|.|.|#",
      "#..|.|.|#",
      "#.......#",
      "#.......#",
      "#########"
    ],
    hint: "Lasers firing! Time your movement. Rewind if you get hit.",
    par: 15
  },
  {
    w: 9, h: 7,
    map: [
      "#########",
      "#S>...v.#",
      "#^...<v.#",
      "#^....v.#",
      "#^....<.E",
      "#.......#",
      "#########"
    ],
    hint: "One-way tiles guide your path.",
    par: 15
  },
  {
    w: 9, h: 7,
    map: [
      "#########",
      "#S......#",
      "#######.#",
      "#-......#",
      "#.#######",
      "#......E#",
      "#########"
    ],
    hint: "Horizontal Laser covers the row. Wait for the gap.",
    par: 20
  },
    {
    w: 9, h: 7,
    map: [
      "#########",
      "#S.T.T.T#",
      "#.|.|.|.#",
      "#.T.T.T.#",
      "#.......#",
      "#T.T.T.E#",
      "#########"
    ],
    hint: "Complex timing. Use Rewind to retry tricky steps.",
    par: 30
  }
];
