export function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
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
    return [(h1^h2^h3^h4)>>>0, (h2^h1)>>>0, (h3^h1)>>>0, (h4^h1)>>>0];
}

export function formatMoney(amount) {
    return "$" + amount.toLocaleString();
}

export class TweenManager {
    constructor() {
        this.tweens = [];
    }

    add(target, props, duration, easing = t => t) {
        const tween = {
            target,
            start: {},
            end: props,
            duration,
            time: 0,
            easing,
            finished: false
        };
        for (const key in props) {
            tween.start[key] = target[key] || 0;
        }
        this.tweens.push(tween);
        return new Promise(resolve => {
            tween.onComplete = resolve;
        });
    }

    update(dt) {
        for (let i = this.tweens.length - 1; i >= 0; i--) {
            const t = this.tweens[i];
            t.time += dt;
            let progress = t.time / t.duration;
            if (progress > 1) progress = 1;

            const ease = t.easing(progress);

            for (const key in t.end) {
                t.target[key] = t.start[key] + (t.end[key] - t.start[key]) * ease;
            }

            if (progress === 1) {
                t.finished = true;
                if (t.onComplete) t.onComplete();
                this.tweens.splice(i, 1);
            }
        }
    }
}

export const Easing = {
    Linear: t => t,
    EaseOutQuad: t => t * (2 - t),
    EaseOutCubic: t => (--t)*t*t+1
};
