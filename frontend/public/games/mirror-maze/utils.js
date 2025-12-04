export class Utils {
  // Linear Congruential Generator for deterministic seeds
  constructor(seed = Date.now()) {
    this.seed = seed;
  }

  // Set seed based on string (e.g. "2023-10-27")
  setSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    }
    this.seed = h >>> 0;
  }

  random() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  randInt(min, max) {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  pick(arr) {
    return arr[this.randInt(0, arr.length - 1)];
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.randInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}
