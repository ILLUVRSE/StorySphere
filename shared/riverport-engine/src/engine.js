"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEngine = void 0;
const rng_1 = require("./rng");
const constants_1 = require("./constants");
class GameEngine {
    constructor(seed = Date.now()) {
        this.rng = (0, rng_1.createRNG)(seed);
        this.state = this.getInitialState();
    }
    getInitialState() {
        return {
            tick: 0,
            phase: 'PITCHING', // Start immediately for MVP
            inning: 1,
            isTopInning: true,
            score: { home: 0, away: 0 },
            outs: 0,
            strikes: 0,
            balls: 0,
            bases: [null, null, null],
            ball: {
                x: constants_1.FIELD.mound.x,
                y: constants_1.FIELD.mound.y,
                z: 10,
                vx: 0, vy: 0, vz: 0,
                state: 'idle'
            },
            pitchMeter: { active: false, value: 0, phase: 0 },
            battingReticle: { x: 400, y: 500 },
            lastEvent: "PLAY BALL!"
        };
    }
    applyInput(input) {
        // Validation logic here (e.g. check turn)
        const { action } = input;
        // Pitching Inputs
        if (this.state.phase === 'PITCHING') {
            if (action.type === 'START_PITCH' && !this.state.pitchMeter.active) {
                this.state.pitchMeter.active = true;
                this.state.pitchMeter.value = 0;
                this.state.pitchMeter.phase = 1;
            }
            else if (action.type === 'PITCH_PHASE_2' && this.state.pitchMeter.phase === 1) {
                this.state.pitchMeter.phase = 2;
            }
            else if (action.type === 'THROW_PITCH' && this.state.pitchMeter.phase === 2) {
                this.state.pitchMeter.active = false;
                this.throwBall(this.state.pitchMeter.value); // Pass power/accuracy
            }
        }
        // Batting Inputs
        if (this.state.phase === 'BATTING') {
            if (action.type === 'MOVE_RETICLE') {
                const { x, y } = action.payload;
                this.state.battingReticle = {
                    x: Math.max(300, Math.min(500, x)),
                    y: Math.max(400, Math.min(550, y))
                };
            }
            else if (action.type === 'SWING') {
                this.checkHit();
            }
        }
    }
    tick() {
        this.state.tick++;
        // Pitch Meter Update
        if (this.state.pitchMeter.active) {
            if (this.state.pitchMeter.phase === 1) {
                this.state.pitchMeter.value += 2;
                if (this.state.pitchMeter.value >= 100)
                    this.state.pitchMeter.phase = 2;
            }
            else {
                this.state.pitchMeter.value -= 2;
                if (this.state.pitchMeter.value <= 0) {
                    this.state.pitchMeter.active = false;
                    this.throwBall(true); // Fumble/Auto-throw
                }
            }
        }
        this.updateBall();
    }
    throwBall(fumbleOrValue) {
        this.state.ball.state = 'pitched';
        this.state.ball.x = constants_1.FIELD.mound.x;
        this.state.ball.y = constants_1.FIELD.mound.y;
        this.state.ball.z = 15;
        let accuracyErr = (typeof fumbleOrValue === 'number') ? Math.abs(fumbleOrValue) : 50;
        let target = { ...constants_1.FIELD.homePlate };
        // Deterministic RNG usage
        target.x += (this.rng() - 0.5) * accuracyErr;
        let dx = target.x - this.state.ball.x;
        let dy = target.y - this.state.ball.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        let speed = 8 + (this.rng() * 2);
        // Ensure we actually aim at home plate
        if (dist > 0) {
            this.state.ball.vx = (dx / dist) * speed;
            this.state.ball.vy = (dy / dist) * speed;
        }
        else {
            this.state.ball.vx = 0;
            this.state.ball.vy = speed;
        }
        this.state.ball.vz = -0.2;
        // State transition handled implicitly by ball update
    }
    checkHit() {
        if (this.state.ball.state !== 'pitched')
            return;
        // Simple Hit Check
        let dx = this.state.ball.x - this.state.battingReticle.x;
        let dy = this.state.ball.y - this.state.battingReticle.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 30 && this.state.ball.y > 450) {
            this.state.ball.state = 'hit';
            let power = 10 + this.rng() * 10;
            let angle = -Math.PI / 2 + (this.rng() - 0.5);
            this.state.ball.vx = Math.cos(angle) * power;
            this.state.ball.vy = Math.sin(angle) * power;
            this.state.ball.vz = 5 + this.rng() * 5;
            this.state.lastEvent = "CRACK!";
            // Transition phase
            this.state.phase = 'RUNNING';
        }
        else {
            // Miss = Strike (handled in ball update when it crosses plate)
        }
    }
    updateBall() {
        const b = this.state.ball;
        if (b.state === 'idle' || b.state === 'dead')
            return;
        if (b.state === 'pitched') {
            b.x += b.vx;
            b.y += b.vy;
            b.z += b.vz;
            // Crossed plate
            if (b.y > constants_1.FIELD.homePlate.y + 10) {
                b.state = 'idle';
                // Strike check
                if (Math.abs(b.x - constants_1.FIELD.homePlate.x) < 30) {
                    this.handleStrike();
                }
                else {
                    this.handleBall();
                }
            }
        }
        else if (b.state === 'hit') {
            b.x += b.vx;
            b.y += b.vy;
            b.z += b.vz;
            b.vz -= constants_1.PHYSICS.gravity;
            if (b.z < 0) {
                b.z = 0;
                b.vz = -b.vz * 0.6;
                b.vx *= constants_1.PHYSICS.groundDrag;
                b.vy *= constants_1.PHYSICS.groundDrag;
                if (Math.abs(b.vx) < 0.1 && Math.abs(b.vy) < 0.1) {
                    b.state = 'ground';
                    this.resolvePlay();
                }
            }
        }
    }
    handleStrike() {
        this.state.strikes++;
        this.state.lastEvent = "STRIKE!";
        if (this.state.strikes >= 3) {
            this.state.outs++;
            this.state.strikes = 0;
            this.state.balls = 0;
            this.state.lastEvent = "OUT!";
            if (this.state.outs >= 3)
                this.changeInning();
        }
        this.resetBall();
    }
    handleBall() {
        this.state.balls++;
        this.state.lastEvent = "BALL!";
        if (this.state.balls >= 4) {
            this.state.lastEvent = "WALK!";
            this.advanceRunners(1);
            this.state.strikes = 0;
            this.state.balls = 0;
        }
        this.resetBall();
    }
    resolvePlay() {
        // RNG based fielding
        let caught = this.rng() > 0.4;
        if (caught) {
            this.state.outs++;
            this.state.lastEvent = "OUT (Fielded)";
            if (this.state.outs >= 3)
                this.changeInning();
        }
        else {
            this.state.lastEvent = "SAFE - HIT!";
            this.advanceRunners(1);
        }
        this.resetBall();
        this.state.phase = this.state.isTopInning ? 'PITCHING' : 'BATTING'; // Return to pitch phase (actually always PITCHING logic-wise, just perspective shifts)
        // Correction: Phase should basically reset to waiting for pitch
        this.state.phase = this.state.isTopInning ? 'PITCHING' : 'BATTING';
        // Wait, if it's Top Inning, Home is Pitching? No.
        // Top Inning: Away Bats, Home Pitches.
        // Bottom Inning: Home Bats, Away Pitches.
        // The active player depends on phase.
        // Let's stick to phase PITCHING meaning "Waiting for pitch to be thrown".
        this.state.phase = 'PITCHING';
    }
    advanceRunners(amount) {
        // Simple shift
        let bases = this.state.bases;
        let newBases = [null, null, null];
        let runs = 0;
        // Existing runners
        if (bases[2]) {
            runs++;
        }
        if (bases[1]) {
            if (amount >= 2)
                runs++;
            else
                newBases[2] = bases[1];
        }
        if (bases[0]) {
            if (amount >= 3)
                runs++;
            else if (amount == 2)
                newBases[2] = bases[0];
            else
                newBases[1] = bases[0];
        }
        // Batter
        let batter = { id: 'temp', stats: { name: 'Runner', power: 0, speed: 0, girth: 0, stamina: 0, skinColor: '#fff', shirtColor: '#fff' } };
        if (amount >= 4)
            runs++;
        else if (amount == 1)
            newBases[0] = batter;
        else if (amount == 2)
            newBases[1] = batter;
        else if (amount == 3)
            newBases[2] = batter;
        this.state.bases = newBases;
        if (this.state.isTopInning)
            this.state.score.away += runs;
        else
            this.state.score.home += runs;
    }
    changeInning() {
        this.state.bases = [null, null, null];
        this.state.strikes = 0;
        this.state.balls = 0;
        this.state.outs = 0;
        if (this.state.isTopInning) {
            this.state.isTopInning = false;
            this.state.lastEvent = `BOTTOM OF ${this.state.inning}`;
            this.state.phase = 'BATTING'; // Player (Home) starts Batting
        }
        else {
            this.state.isTopInning = true;
            this.state.inning++;
            if (this.state.inning > constants_1.INNINGS) {
                this.state.phase = 'GAME_OVER';
                this.state.lastEvent = "GAME OVER";
            }
            else {
                this.state.lastEvent = `TOP OF ${this.state.inning}`;
                this.state.phase = 'PITCHING'; // Player (Home) starts Pitching
            }
        }
    }
    resetBall() {
        this.state.ball.state = 'idle';
        this.state.ball.x = constants_1.FIELD.mound.x;
        this.state.ball.y = constants_1.FIELD.mound.y;
        this.state.ball.z = 10;
        this.state.ball.vx = 0;
        this.state.ball.vy = 0;
        this.state.ball.vz = 0;
    }
    getSnapshot() {
        // Deep copy to prevent mutation issues
        return JSON.parse(JSON.stringify(this.state));
    }
}
exports.GameEngine = GameEngine;
