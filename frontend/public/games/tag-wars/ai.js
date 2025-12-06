import { dist } from './utils.js';

export class AI {
    constructor(entity) {
        this.entity = entity;
        this.target = null;
        this.state = 'idle'; // idle, chase, flee, hunt
        this.reactionTimer = 0;
        this.path = [];
    }

    update(dt, gameState) {
        this.reactionTimer -= dt;
        if (this.reactionTimer <= 0) {
            this.decide(gameState);
            this.reactionTimer = 0.2 + Math.random() * 0.2; // 200-400ms reaction time
        }

        // Execute move
        this.executeMove(dt, gameState);
    }

    decide(gameState) {
        const me = this.entity;

        if (gameState.mode === 'koth') {
            // King of the Hill logic
            // Always move to hill
            this.state = 'seek_hill';
            this.target = {x: gameState.hill.x, y: gameState.hill.y};

            // Unless there is a powerup very close?
            const nearestPowerup = this.findNearest(gameState.powerups, () => true);
            if (nearestPowerup && dist(me.x, me.y, nearestPowerup.x, nearestPowerup.y) < 3) {
                this.state = 'hunt';
                this.target = {x: nearestPowerup.x, y: nearestPowerup.y};
            }
            return;
        }

        // Check surrounding threats
        // Ignore invisible threats
        const nearestThreat = this.findNearest(gameState.entities, e => {
            if (e.id === me.id) return false;
            if (!e.isIt) return false;
            // Ghost check
            const isGhost = e.effects && e.effects.some(ef => ef.type === 'invis');
            return !isGhost;
        });

        // Ignore invisible prey
        const nearestPrey = this.findNearest(gameState.entities, e => {
            if (e.id === me.id) return false;
            if (e.isIt) return false;
            // Ghost check
            const isGhost = e.effects && e.effects.some(ef => ef.type === 'invis');
            return !isGhost;
        });

        const nearestPowerup = this.findNearest(gameState.powerups, () => true);

        if (me.isIt) {
            // Chase logic
            if (nearestPrey) {
                this.state = 'chase';
                this.target = {x: nearestPrey.x, y: nearestPrey.y};
            } else {
                this.state = 'idle'; // Everyone is IT?
            }
        } else {
            // Flee logic
            if (nearestThreat && dist(me.x, me.y, nearestThreat.x, nearestThreat.y) < 4) {
                this.state = 'flee';
                this.target = {x: nearestThreat.x, y: nearestThreat.y}; // Flee from this
            } else if (nearestPowerup && dist(me.x, me.y, nearestPowerup.x, nearestPowerup.y) < 5) {
                this.state = 'hunt';
                this.target = {x: nearestPowerup.x, y: nearestPowerup.y};
            } else {
                // Wander or keep distance
                this.state = 'wander';
            }
        }
    }

    executeMove(dt, gameState) {
        const me = this.entity;
        let dx = 0;
        let dy = 0;

        if (this.state === 'chase' && this.target) {
            // BFS towards target
            const nextStep = this.getPathStep(gameState, Math.floor(me.x), Math.floor(me.y), Math.floor(this.target.x), Math.floor(this.target.y));
            if (nextStep) {
                dx = (nextStep.x + 0.5) - me.x;
                dy = (nextStep.y + 0.5) - me.y;
            } else {
                // Direct line fallback
                dx = this.target.x - me.x;
                dy = this.target.y - me.y;
            }
        } else if (this.state === 'flee' && this.target) {
            // Simple flee: move away from target
            dx = me.x - this.target.x;
            dy = me.y - this.target.y;

            // Avoid corners/dead ends?
            // Better: pick a neighbor tile that maximizes distance to threat
            const bestMove = this.getBestFleeMove(gameState, me.x, me.y, this.target.x, this.target.y);
            if (bestMove) {
                dx = (bestMove.x + 0.5) - me.x;
                dy = (bestMove.y + 0.5) - me.y;
            }
        } else if (this.state === 'hunt' && this.target) {
             dx = this.target.x - me.x;
             dy = this.target.y - me.y;
        } else if (this.state === 'seek_hill' && this.target) {
             // BFS to hill
             const nextStep = this.getPathStep(gameState, Math.floor(me.x), Math.floor(me.y), Math.floor(this.target.x), Math.floor(this.target.y));
             if (nextStep) {
                 dx = (nextStep.x + 0.5) - me.x;
                 dy = (nextStep.y + 0.5) - me.y;
             } else {
                 dx = this.target.x - me.x;
                 dy = this.target.y - me.y;
             }
        } else {
            // Wander randomly
            if (Math.random() < 0.05) {
                this.wanderDir = {x: Math.random() - 0.5, y: Math.random() - 0.5};
            }
            if (this.wanderDir) {
                dx = this.wanderDir.x;
                dy = this.wanderDir.y;
            }
        }

        // Normalize input
        const len = Math.sqrt(dx*dx + dy*dy);
        if (len > 0.1) {
            me.input.x = dx / len;
            me.input.y = dy / len;
        } else {
            me.input.x = 0;
            me.input.y = 0;
        }
    }

    findNearest(list, predicate) {
        let nearest = null;
        let minDst = Infinity;
        const me = this.entity;
        list.forEach(item => {
            if (predicate(item)) {
                const d = dist(me.x, me.y, item.x, item.y);
                if (d < minDst) {
                    minDst = d;
                    nearest = item;
                }
            }
        });
        return nearest;
    }

    getPathStep(gameState, sx, sy, tx, ty) {
        // Simple BFS
        const w = gameState.w;
        const h = gameState.h;
        const q = [{x: sx, y: sy, path: []}];
        const visited = new Set([sx+','+sy]);

        // Limit depth for perf
        let iterations = 0;

        while(q.length > 0 && iterations++ < 100) {
            const curr = q.shift();
            if (curr.x === tx && curr.y === ty) {
                return curr.path[0];
            }

            const neighbors = [
                {x: curr.x+1, y: curr.y}, {x: curr.x-1, y: curr.y},
                {x: curr.x, y: curr.y+1}, {x: curr.x, y: curr.y-1}
            ];

            for (const n of neighbors) {
                if (n.x >= 0 && n.x < w && n.y >= 0 && n.y < h) {
                    if (gameState.grid[n.y][n.x].type !== 1 && !visited.has(n.x+','+n.y)) {
                        visited.add(n.x+','+n.y);
                        const newPath = [...curr.path, {x: n.x, y: n.y}];
                        q.push({x: n.x, y: n.y, path: newPath});

                        // Heuristic optimization: if we are close enough, just return first step
                        if (newPath.length === 1 && Math.abs(n.x - tx) + Math.abs(n.y - ty) < Math.abs(curr.x - tx) + Math.abs(curr.y - ty)) {
                             // This is greedy, not BFS optimal, but good for realtime
                        }
                    }
                }
            }
        }
        return null;
    }

    getBestFleeMove(gameState, mx, my, tx, ty) {
        const cx = Math.floor(mx);
        const cy = Math.floor(my);
        const neighbors = [
            {x: cx+1, y: cy}, {x: cx-1, y: cy},
            {x: cx, y: cy+1}, {x: cx, y: cy-1}
        ];

        let best = null;
        let maxDist = dist(mx, my, tx, ty);

        for (const n of neighbors) {
            if (n.x >= 0 && n.x < gameState.w && n.y >= 0 && n.y < gameState.h) {
                if (gameState.grid[n.y][n.x].type !== 1) {
                     const d = dist(n.x+0.5, n.y+0.5, tx, ty);
                     if (d > maxDist) {
                         maxDist = d;
                         best = n;
                     }
                }
            }
        }
        return best;
    }
}
