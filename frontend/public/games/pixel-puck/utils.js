// Mulberry32 RNG
export function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

// Vector math helpers
export const Vec2 = {
    add: (v1, v2) => ({ x: v1.x + v2.x, y: v1.y + v2.y }),
    sub: (v1, v2) => ({ x: v1.x - v2.x, y: v1.y - v2.y }),
    mult: (v, s) => ({ x: v.x * s, y: v.y * s }),
    mag: (v) => Math.sqrt(v.x * v.x + v.y * v.y),
    normalize: (v) => {
        const m = Math.sqrt(v.x * v.x + v.y * v.y);
        return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
    },
    dot: (v1, v2) => v1.x * v2.x + v1.y * v2.y,
    dist: (v1, v2) => Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2)),
    clamp: (val, min, max) => Math.min(Math.max(val, min), max)
};

// Collision helpers
export const Collision = {
    // Circle-Circle collision
    circleCircle: (c1, c2) => {
        const dx = c1.x - c2.x;
        const dy = c1.y - c2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < (c1.radius + c2.radius);
    },
    // Circle-Rectangle (AABB) collision
    circleRect: (circle, rect) => {
        const closestX = Vec2.clamp(circle.x, rect.x, rect.x + rect.w);
        const closestY = Vec2.clamp(circle.y, rect.y, rect.y + rect.h);
        const dx = circle.x - closestX;
        const dy = circle.y - closestY;
        return (dx * dx + dy * dy) < (circle.radius * circle.radius);
    },
    // Reflect vector v across normal n (assumes n is normalized)
    reflect: (v, n) => {
        const dot = Vec2.dot(v, n);
        return Vec2.sub(v, Vec2.mult(n, 2 * dot));
    }
};
