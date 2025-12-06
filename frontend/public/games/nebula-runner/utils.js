export const CONSTANTS = {
  COLS: 12,
  ROWS: 8, // Increased from 6 for more space
  TILE_ADVANCE_START: 200, // Faster start
  TILE_ADVANCE_MIN: 100,
  SPEED_RAMP_COLUMNS: 50,
  SPEED_RAMP_DECAY: 0.96,
  CANVAS_WIDTH: 480,
  CANVAS_HEIGHT: 320,
  SHIP_COL: 1, // Moved back slightly

  // Entity Speeds (in Columns per Second)
  BULLET_SPEED: 15,
  ENEMY_SPEED: 2,

  // Cooldowns
  FIRE_RATE_MS: 200,
};

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
  return date.toISOString().split('T')[0];
}
