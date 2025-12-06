export function mulberry32(a: number) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

export interface Vec2D {
    x: number;
    y: number;
}

// Vector math helpers
export const Vec2 = {
    add: (v1: Vec2D, v2: Vec2D): Vec2D => ({ x: v1.x + v2.x, y: v1.y + v2.y }),
    sub: (v1: Vec2D, v2: Vec2D): Vec2D => ({ x: v1.x - v2.x, y: v1.y - v2.y }),
    mult: (v: Vec2D, s: number): Vec2D => ({ x: v.x * s, y: v.y * s }),
    mag: (v: Vec2D): number => Math.sqrt(v.x * v.x + v.y * v.y),
    normalize: (v: Vec2D): Vec2D => {
        const m = Math.sqrt(v.x * v.x + v.y * v.y);
        return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
    },
    dot: (v1: Vec2D, v2: Vec2D): number => v1.x * v2.x + v1.y * v2.y,
    dist: (v1: Vec2D, v2: Vec2D): number => Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2)),
    clamp: (val: number, min: number, max: number): number => Math.min(Math.max(val, min), max)
};

export interface Circle {
    x: number;
    y: number;
    radius: number;
}

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

// Collision helpers
export const Collision = {
    // Circle-Circle collision
    circleCircle: (c1: Circle, c2: Circle): boolean => {
        const dx = c1.x - c2.x;
        const dy = c1.y - c2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < (c1.radius + c2.radius);
    },
    // Circle-Rectangle (AABB) collision
    circleRect: (circle: Circle, rect: Rect): boolean => {
        const closestX = Vec2.clamp(circle.x, rect.x, rect.x + rect.w);
        const closestY = Vec2.clamp(circle.y, rect.y, rect.y + rect.h);
        const dx = circle.x - closestX;
        const dy = circle.y - closestY;
        return (dx * dx + dy * dy) < (circle.radius * circle.radius);
    },
    // Reflect vector v across normal n (assumes n is normalized)
    reflect: (v: Vec2D, n: Vec2D): Vec2D => {
        const dot = Vec2.dot(v, n);
        return Vec2.sub(v, Vec2.mult(n, 2 * dot));
    }
};
