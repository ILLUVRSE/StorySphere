import { Vec2 } from './utils.js';

export class AI {
    constructor(playerNum) {
        this.playerNum = playerNum;
        this.difficulty = 0.8; // 0 to 1
        this.targetY = 4;
        this.reactionTimer = 0;
    }

    update(dt, gameState) {
        // Output: { moveVector: {x,y}, dash: bool }

        // Only react every few frames to simulate reaction time
        this.reactionTimer -= dt;
        if (this.reactionTimer > 0) return this.lastOutput || { moveVector: {x:0, y:0}, dash: false };
        this.reactionTimer = (1 - this.difficulty) * 0.2; // 0.05s to 0.2s

        const me = this.playerNum === 1 ? gameState.p1 : gameState.p2;
        const puck = gameState.puck;
        const gridW = gameState.map.gridW;

        const isPuckOnMySide = (this.playerNum === 1 && puck.x < gridW/2) || (this.playerNum === 2 && puck.x > gridW/2);

        let tx = 0, ty = 0;
        let dash = false;

        if (isPuckOnMySide) {
            // Offensive / Intercept
            // Predict where puck will be at my X
            // Simple: Just aim for puck current Y + lead
            ty = puck.y;

            // Try to hit with edge of paddle to angle it?
            // For now, center hit.

            // X positioning: Stay aggressive but don't overextend
            // Target X: Puck X, but clamped to my defensive zone?
            // No, go meet the puck.
            tx = puck.x;

            // Charge if perfect shot?
            if (Math.abs(puck.y - me.y) < 0.5 && Math.abs(puck.x - me.x) < 2) {
                dash = true;
            }

        } else {
            // Defensive
            // Return to goal center, track Y slightly
            const goalX = this.playerNum === 1 ? 1 : gridW - 1;
            tx = goalX;
            ty = gameState.map.gridH / 2;

            // Track puck Y slightly
            ty = (ty + puck.y) / 2;
        }

        // Calculate Move Vector
        const dx = tx - me.x;
        const dy = ty - me.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        let mx = 0, my = 0;
        if (dist > 0.1) {
            mx = dx / dist;
            my = dy / dist;
        }

        this.lastOutput = { moveVector: {x: mx, y: my}, dash };
        return this.lastOutput;
    }
}
