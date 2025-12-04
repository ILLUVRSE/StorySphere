export class Mulberry32 {
    constructor(seed) {
        this.a = seed;
    }

    next() {
        var t = this.a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // Range [min, max)
    range(min, max) {
        return min + Math.floor(this.next() * (max - min));
    }

    // Pick random element from array
    pick(arr) {
        return arr[this.range(0, arr.length)];
    }

    // Shuffle array in place
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = this.range(0, i + 1);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function dist(x1, y1, x2, y2) {
    return Math.sqrt((x2-x1)**2 + (y2-y1)**2);
}

// Simple unique ID
export function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
