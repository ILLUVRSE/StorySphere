
// Simple Seeded PRNG
export class PRNG {
  constructor(seed) {
    this.seed = seed || 123456;
  }

  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  // Range [min, max)
  range(min, max) {
    return Math.floor(this.next() * (max - min) + min);
  }

  // Choose random item
  choose(array) {
    return array[this.range(0, array.length)];
  }
}

export function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);

  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
