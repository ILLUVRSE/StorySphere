export const CONSTANTS = {
  COLS: 9,
  ROWS: 7,
  TILE_SIZE: 64, // 9*64 = 576, 7*64 = 448
  CANVAS_WIDTH: 576,
  CANVAS_HEIGHT: 448,
  TICK_MS: 120,
  COLORS: {
    BG: '#111',
    WALL: '#444',
    FLOOR: '#222',
    PLAYER: '#0f0',
    ENEMY: '#f00',
    TEXT: '#fff'
  }
};

// NOTE: duplicated from other games for self-contained bundle — TODO: dedupe to shared lib later

// Simple seeded PRNG (Mulberry32)
export function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function cyrb128(str) {
    let h1 = 1779033703, h2 = 3144134277,
        h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return (h1^h2^h3^h4) >>> 0;
}

export function getDailySeed() {
  const date = new Date();
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}
