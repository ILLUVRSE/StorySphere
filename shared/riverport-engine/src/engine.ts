import { createRNG } from './rng';
import { GameState, GameInput, BallState, PlayerStats, GamePhase, TeamSide, Runner, Fielder } from './types';
import { FIELD, PHYSICS, GAME_WIDTH, GAME_HEIGHT, INNINGS } from './constants';

export class GameEngine {
    state: GameState;
    rng: () => number;

    constructor(seed: number = Date.now()) {
        this.rng = createRNG(seed);
        this.state = this.getInitialState();
    }

    getInitialState(): GameState {
        // Initialize Default Fielders (Random positions for MVP)
        const fielders: Fielder[] = [];
        for (let i=0; i<7; i++) { // 7 fielders (excluding pitcher/catcher)
            fielders.push({
                id: `f${i}`,
                position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 200 },
                speed: 3 + Math.random(), // 3-4 speed
                state: 'idle'
            });
        }

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
            runners: [],
            fielders: fielders,
            ball: {
                x: FIELD.mound.x,
                y: FIELD.mound.y,
                z: 10,
                vx: 0, vy: 0, vz: 0,
                state: 'idle'
            },
            pitchMeter: { active: false, value: 0, phase: 0 },
            battingReticle: { x: 400, y: 500 },
            lastEvent: "PLAY BALL!"
        };
    }

    applyInput(input: GameInput) {
        // Validation logic here (e.g. check turn)
        const { action } = input;

        // Pitching Inputs
        if (this.state.phase === 'PITCHING') {
            if (action.type === 'START_PITCH' && !this.state.pitchMeter.active) {
                this.state.pitchMeter.active = true;
                this.state.pitchMeter.value = 0;
                this.state.pitchMeter.phase = 1;
            } else if (action.type === 'PITCH_PHASE_2' && this.state.pitchMeter.phase === 1) {
                this.state.pitchMeter.phase = 2;
            } else if (action.type === 'THROW_PITCH' && this.state.pitchMeter.phase === 2) {
                this.state.pitchMeter.active = false;
                this.throwBall(this.state.pitchMeter.value); // Pass power/accuracy
            }
        }

        // Batting Inputs
        if (this.state.phase === 'BATTING' || this.state.phase === 'RUNNING') {
            if (action.type === 'MOVE_RETICLE') {
                const { x, y } = action.payload;
                this.state.battingReticle = {
                    x: Math.max(300, Math.min(500, x)),
                    y: Math.max(400, Math.min(550, y))
                };
            } else if (action.type === 'SWING') {
                this.checkHit();
            } else if (action.type === 'ADVANCE_RUNNER') {
                // Manual runner advancement
                // payload: { baseIndex: 0|1|2 } to advance runner AT that base
                const { baseIndex } = action.payload;
                // For MVP, simplistic: if ball is live, runners can try to advance
                if (this.state.runners[baseIndex]) {
                     // logic to start them running
                }
            }
        }
    }

    tick() {
        this.state.tick++;

        // Pitch Meter Update
        if (this.state.pitchMeter.active) {
            if (this.state.pitchMeter.phase === 1) {
                this.state.pitchMeter.value += 2;
                if (this.state.pitchMeter.value >= 100) this.state.pitchMeter.phase = 2;
            } else {
                this.state.pitchMeter.value -= 2;
                if (this.state.pitchMeter.value <= 0) {
                    this.state.pitchMeter.active = false;
                    this.throwBall(true); // Fumble/Auto-throw
                }
            }
        }

        this.updateBall();
        this.updateFielders();
    }

    private updateFielders() {
        // Simple Fielder Logic: If ball is hit, run to landing spot
        if (this.state.ball.state === 'hit') {
            const b = this.state.ball;
            // Estimate landing (simplified linear projection for MVP)
            // Real physics would solve quadratic for z=0
            let tLand = (b.vz + Math.sqrt(b.vz*b.vz + 2*PHYSICS.gravity*b.z)) / PHYSICS.gravity;
            let landX = b.x + b.vx * tLand;
            let landY = b.y + b.vy * tLand;

            // Move all fielders towards landing
            this.state.fielders.forEach(f => {
                f.state = 'running';
                f.target = { x: landX, y: landY };

                let dx = landX - f.position.x;
                let dy = landY - f.position.y;
                let dist = Math.sqrt(dx*dx + dy*dy);

                if (dist > f.speed) {
                    f.position.x += (dx / dist) * f.speed;
                    f.position.y += (dy / dist) * f.speed;
                } else {
                    f.position.x = landX;
                    f.position.y = landY;
                    // If arrived before ball lands (approx), catch?
                    // Logic handled in updateBall collision check or here
                }
            });
        } else {
             this.state.fielders.forEach(f => f.state = 'idle');
        }
    }

    private throwBall(fumbleOrValue: boolean | number) {
        this.state.ball.state = 'pitched';
        this.state.ball.x = FIELD.mound.x;
        this.state.ball.y = FIELD.mound.y;
        this.state.ball.z = 15;

        let accuracyErr = (typeof fumbleOrValue === 'number') ? Math.abs(fumbleOrValue) : 50;
        let target = { ...FIELD.homePlate };

        // Deterministic RNG usage
        target.x += (this.rng() - 0.5) * accuracyErr;

        let dx = target.x - this.state.ball.x;
        let dy = target.y - this.state.ball.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        let speed = 8 + (this.rng() * 2);

        // Ensure we actually aim at home plate
        if (dist > 0) {
            this.state.ball.vx = (dx / dist) * speed;
            this.state.ball.vy = (dy / dist) * speed;
        } else {
             this.state.ball.vx = 0;
             this.state.ball.vy = speed;
        }
        this.state.ball.vz = -0.2;

        // State transition handled implicitly by ball update
    }

    private checkHit() {
        if (this.state.ball.state !== 'pitched') return;

        // Simple Hit Check
        let dx = this.state.ball.x - this.state.battingReticle.x;
        let dy = this.state.ball.y - this.state.battingReticle.y;
        let dist = Math.sqrt(dx*dx + dy*dy);

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
        } else {
             // Miss = Strike (handled in ball update when it crosses plate)
        }
    }

    private updateBall() {
        const b = this.state.ball;
        if (b.state === 'idle' || b.state === 'dead') return;

        if (b.state === 'pitched') {
            b.x += b.vx;
            b.y += b.vy;
            b.z += b.vz;

            // Crossed plate
            if (b.y > FIELD.homePlate.y + 10) {
                b.state = 'idle';
                // Strike check
                if (Math.abs(b.x - FIELD.homePlate.x) < 30) {
                    this.handleStrike();
                } else {
                    this.handleBall();
                }
            }
        } else if (b.state === 'hit') {
            b.x += b.vx;
            b.y += b.vy;
            b.z += b.vz;
            b.vz -= PHYSICS.gravity;

            if (b.z < 0) {
                b.z = 0;
                b.vz = -b.vz * 0.6;
                b.vx *= PHYSICS.groundDrag;
                b.vy *= PHYSICS.groundDrag;

                if (Math.abs(b.vx) < 0.1 && Math.abs(b.vy) < 0.1) {
                    b.state = 'ground';
                    this.resolvePlay();
                }
            }
        }
    }

    private handleStrike() {
        this.state.strikes++;
        this.state.lastEvent = "STRIKE!";
        if (this.state.strikes >= 3) {
            this.state.outs++;
            this.state.strikes = 0;
            this.state.balls = 0;
            this.state.lastEvent = "OUT!";
            if (this.state.outs >= 3) this.changeInning();
        }
        this.resetBall();
    }

    private handleBall() {
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

    private resolvePlay() {
        // Check if any fielder is close enough to catch
        let caught = false;
        for (const f of this.state.fielders) {
            const dx = f.position.x - this.state.ball.x;
            const dy = f.position.y - this.state.ball.y;
            if (Math.sqrt(dx*dx + dy*dy) < 20) { // 20px catch radius
                caught = true;
                break;
            }
        }

        if (caught) {
            this.state.outs++;
            this.state.lastEvent = "OUT (Fielded)";
            if (this.state.outs >= 3) this.changeInning();
        } else {
            this.state.lastEvent = "SAFE - HIT!";
            this.advanceRunners(1);
        }
        this.resetBall();
        this.state.phase = 'PITCHING';
    }

    private advanceRunners(amount: number) {
        // Simple shift
        let bases = this.state.bases;
        let newBases = [null, null, null] as (Runner | null)[];
        let runs = 0;

        // Existing runners
        if (bases[2]) { runs++; }
        if (bases[1]) {
             if (amount >= 2) runs++;
             else newBases[2] = bases[1];
        }
        if (bases[0]) {
             if (amount >= 3) runs++;
             else if (amount == 2) newBases[2] = bases[0];
             else newBases[1] = bases[0];
        }

        // Batter
        let batter: Runner = {
            id: 'temp',
            stats: { name: 'Runner', power:0, speed:0, girth:0, stamina:0, skinColor:'#fff', shirtColor:'#fff' },
            base: 0,
            progress: 0,
            safe: true
        };
        if (amount >= 4) runs++;
        else if (amount == 1) newBases[0] = batter;
        else if (amount == 2) newBases[1] = batter;
        else if (amount == 3) newBases[2] = batter;

        this.state.bases = newBases;
        if (this.state.isTopInning) this.state.score.away += runs;
        else this.state.score.home += runs;
    }

    private changeInning() {
        this.state.bases = [null, null, null];
        this.state.strikes = 0;
        this.state.balls = 0;
        this.state.outs = 0;

        if (this.state.isTopInning) {
            this.state.isTopInning = false;
            this.state.lastEvent = `BOTTOM OF ${this.state.inning}`;
            this.state.phase = 'BATTING'; // Player (Home) starts Batting
        } else {
            this.state.isTopInning = true;
            this.state.inning++;
            if (this.state.inning > INNINGS) {
                this.state.phase = 'GAME_OVER';
                this.state.lastEvent = "GAME OVER";
            } else {
                this.state.lastEvent = `TOP OF ${this.state.inning}`;
                this.state.phase = 'PITCHING'; // Player (Home) starts Pitching
            }
        }
    }

    private resetBall() {
        this.state.ball.state = 'idle';
        this.state.ball.x = FIELD.mound.x;
        this.state.ball.y = FIELD.mound.y;
        this.state.ball.z = 10;
        this.state.ball.vx = 0;
        this.state.ball.vy = 0;
        this.state.ball.vz = 0;
    }

    getSnapshot(): GameState {
        // Deep copy to prevent mutation issues
        return JSON.parse(JSON.stringify(this.state));
    }
}
