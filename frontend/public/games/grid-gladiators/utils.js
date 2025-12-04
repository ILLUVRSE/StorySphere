// Mulberry32 PRNG
export function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

export function dist(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Circle-Circle collision
export function checkCircleCollision(c1, c2) {
  const d = dist(c1.x, c1.y, c2.x, c2.y);
  return d < c1.r + c2.r;
}

// Circle-Rect collision (for tile checks)
export function checkCircleRectCollision(circle, rect) {
  const cx = clamp(circle.x, rect.x, rect.x + rect.w);
  const cy = clamp(circle.y, rect.y, rect.y + rect.h);
  return dist(circle.x, circle.y, cx, cy) < circle.r;
}

export function generateSeed() {
  return Math.floor(Math.random() * 2147483647);
}
