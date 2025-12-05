import { createRNG, RNG } from './rng';
import { GameState, GameInput, BallState, Player, GamePhase, MatchEvent, Runner } from './types';
import { FIELD, PHYSICS, GAME_WIDTH, GAME_HEIGHT, INNINGS } from './constants';

export class GameEngine {
    state: GameState;
    rng: RNG;

    constructor(matchId: string, seed: string, homeRoster: Player[], awayRoster: Player[]) {
        this.rng = createRNG(seed);
        this.state = this.getInitialState(matchId, homeRoster, awayRoster);
    }

    getInitialState(matchId: string, homeRoster: Player[], awayRoster: Player[]): GameState {
        return {
            matchId,
            tick: 0,
            phase: 'PITCHING',
            inning: 1,
            isTopInning: true, // Away Bats First
            score: { home: 0, away: 0 },
            outs: 0,
            strikes: 0,
            balls: 0,
            bases: [null, null, null],
            ball: {
                x: FIELD.mound.x,
                y: FIELD.mound.y,
                z: 10,
                vx: 0, vy: 0, vz: 0,
                state: 'idle'
            },
            pitchMeter: { active: false, value: 0, phase: 0 },
            battingReticle: { x: 400, y: 500 },
            homeRoster,
            awayRoster,
            currentBatterIndex: { home: 0, away: 0 },
            currentPitcherIndex: { home: 0, away: 0 }, // Pitcher is usually last or designated
            eventLog: []
        };
    }

    applyInput(input: GameInput) {
        // Basic MVP validation: ignore inputs if game over
        if (this.state.phase === 'GAME_OVER') return;

        const { action } = input;

        // Input processing is phase-dependent

        // PITCHING (Defensive Player)
        // If Top Inning -> Home Team is Pitching
        // If Bottom Inning -> Away Team is Pitching

        if (this.state.phase === 'PITCHING') {
            if (action.type === 'START_PITCH' && !this.state.pitchMeter.active) {
                this.state.pitchMeter.active = true;
                this.state.pitchMeter.value = 0;
                this.state.pitchMeter.phase = 1;
            } else if (action.type === 'PITCH_PHASE_2' && this.state.pitchMeter.phase === 1) {
                this.state.pitchMeter.phase = 2;
            } else if (action.type === 'THROW_PITCH' && this.state.pitchMeter.phase === 2) {
                this.state.pitchMeter.active = false;
                this.throwBall(this.state.pitchMeter.value);
            }
        }

        // BATTING (Offensive Player)
        if (this.state.phase === 'BATTING' || (this.state.phase === 'PITCHING')) {
            // Technically batting inputs are valid during pitch flight (which starts in PITCHING then transitions)
            // But we simplify: Pitching phase handles the throw logic. Once thrown, ball state changes.
            // Wait, we need to allow moving reticle BEFORE pitch too.

             if (action.type === 'MOVE_RETICLE') {
                const { x, y } = action.payload;
                this.state.battingReticle = {
                    x: Math.max(300, Math.min(500, x)),
                    y: Math.max(400, Math.min(550, y))
                };
            } else if (action.type === 'SWING') {
                this.checkHit();
            }
        }
    }

    tick() {
        if (this.state.phase === 'GAME_OVER') return;

        this.state.tick++;

        // Pitch Meter Auto-Fail Logic
        if (this.state.pitchMeter.active) {
            if (this.state.pitchMeter.phase === 1) {
                this.state.pitchMeter.value += 2;
                if (this.state.pitchMeter.value >= 100) this.state.pitchMeter.phase = 2;
            } else {
                this.state.pitchMeter.value -= 2;
                if (this.state.pitchMeter.value <= 0) {
                    this.state.pitchMeter.active = false;
                    this.throwBall(true); // Fumble
                }
            }
        }

        // AI Logic (Simple MVP Auto-Play if needed or AI opponent)
        this.runAI();

        // Fatigue Logic
        this.updateFatigue();

        this.updateBall();
    }

    private updateFatigue() {
        if (this.state.tick % 100 === 0) {
            // Recover stamina slightly for bench?
            // Decrease stamina for active players?
            // For MVP, simple Pitcher fatigue:
            const pitcher = this.getCurrentPitcher();
            // If pitching, drain
            if (this.state.phase === 'PITCHING' && this.state.pitchMeter.active) {
                 // Active strain handled in throw
            }
        }
    }

    private runAI() {
        // Simple heuristic AI for simulation

        // AI Pitching
        if (this.state.phase === 'PITCHING' && !this.state.pitchMeter.active && this.state.ball.state === 'idle') {
            // Delay slightly so it's not instant
            if (this.state.tick % 60 === 0) {
                 // Auto throw
                 this.throwBall(this.rng() * 20); // Random accuracy error 0-20
            }
        }

        // AI Batting
        if (this.state.ball.state === 'pitched') {
             // Check if ball is close to plate
             const distToPlate = this.state.ball.y - FIELD.homePlate.y; // Positive if incoming from mound (mound y < plate y? wait mound is 350, plate 500)
             // Ball moves +y from mound(350) to plate(500)

             // Swing if close
             if (this.state.ball.y > 480 && this.state.ball.y < 520) {
                 // 50% chance to swing
                 if (this.rng() > 0.5) {
                     // Set reticle near ball for "attempt"
                     // Add some error
                     this.state.battingReticle.x = this.state.ball.x + (this.rng() - 0.5) * 40;
                     this.state.battingReticle.y = this.state.ball.y;
                     this.checkHit();
                 }
             }
        }
    }

    private logEvent(type: MatchEvent['type'], payload: any) {
        const event: MatchEvent = {
            seq: this.state.eventLog.length + 1,
            ts: new Date().toISOString(),
            type,
            payload
        };
        this.state.eventLog.push(event);
        this.state.lastEvent = event;
    }

    private throwBall(fumbleOrValue: boolean | number) {
        this.state.ball.state = 'pitched';
        this.state.ball.x = FIELD.mound.x;
        this.state.ball.y = FIELD.mound.y;
        this.state.ball.z = 15;

        // Pitcher Stats
        const pitcher = this.getCurrentPitcher();

        let accuracyErr = (typeof fumbleOrValue === 'number') ? Math.abs(fumbleOrValue) : 50;
        // Improve accuracy based on pitcher control stat (1-10) -> reduces error
        accuracyErr = Math.max(0, accuracyErr - (pitcher.stats.fielding * 2)); // Fielding as Control proxy for MVP

        let target = { ...FIELD.homePlate };
        target.x += (this.rng() - 0.5) * accuracyErr;

        let dx = target.x - this.state.ball.x;
        let dy = target.y - this.state.ball.y;
        let dist = Math.sqrt(dx*dx + dy*dy);

        let speed = 8 + (this.rng() * 2) + (pitcher.stats.power * 0.2); // Power adds velocity

        if (dist > 0) {
            this.state.ball.vx = (dx / dist) * speed;
            this.state.ball.vy = (dy / dist) * speed;
        } else {
             this.state.ball.vx = 0;
             this.state.ball.vy = speed;
        }
        this.state.ball.vz = -0.2; // Gravity for pitch

        // Fatigue Pitcher
        pitcher.fatigue = Math.min(100, (pitcher.fatigue || 0) + 1); // +1 per pitch
        // Injury Chance
        if (pitcher.fatigue > 50 && this.rng() < 0.01 * (pitcher.stats.knees || 1)) {
            // INJURY!
            this.handleInjury(pitcher);
        }

        this.logEvent('pitch_thrown', { speed, target, pitcherId: pitcher.id });
    }

    private handleInjury(player: Player) {
        player.injury = { status: 'injured', gamesOut: 1 + Math.floor(this.rng() * 3) };
        this.logEvent('injury', { playerId: player.id, gamesOut: player.injury.gamesOut });
    }

    private checkHit() {
        if (this.state.ball.state !== 'pitched') return;

        // Hitting logic
        const batter = this.getCurrentBatter();

        let dx = this.state.ball.x - this.state.battingReticle.x;
        let dy = this.state.ball.y - this.state.battingReticle.y;
        let dist = Math.sqrt(dx*dx + dy*dy);

        // Hit Threshold - influenced by Vision/Contact
        const hitThreshold = 30 + (batter.stats.fielding * 2); // Using fielding as contact proxy or add new stat?
        // Let's use 'fielding' as 'Contact' for MVP if not explicit.
        // Actually types has no contact. Let's use Power for power, Fielding for defense.
        // Wait, types has: power, speed, girth, stamina, fielding, arm, knees.
        // Let's use Speed as Contact proxy? Or Girth?
        // Let's assume hitting uses generic ability.

        if (dist < hitThreshold && this.state.ball.y > 450) {
             this.state.ball.state = 'hit';

             // Outcome
             let power = 10 + (this.rng() * 10) + (batter.stats.power);
             let angle = -Math.PI / 2 + (this.rng() - 0.5); // Roughly forward fan

             this.state.ball.vx = Math.cos(angle) * power;
             this.state.ball.vy = Math.sin(angle) * power;
             this.state.ball.vz = 5 + (this.rng() * 5); // Launch angle

             this.logEvent('hit_result', { batterId: batter.id, power, angle });

             this.state.phase = 'RUNNING';
        } else {
             // Swing and Miss
             this.state.ball.state = 'dead'; // So it doesn't count as ball/strike at plate again
             this.handleStrike();
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
                if (Math.abs(b.x - FIELD.homePlate.x) < 30) { // Simple strike zone
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

            // HR Check
            if (this.distOrigin(b.x, b.y) > 350 && b.z > 10) {
                this.handleHomeRun();
            }

            // Foul Check logic (omitted for brevity in MVP but simple cone check)
        }
    }

    private handleStrike() {
        this.state.strikes++;
        this.logEvent('strike', { count: this.state.strikes });
        if (this.state.strikes >= 3) {
            this.state.outs++;
            this.logEvent('out', { type: 'strikeout' });
            this.resetCount();
            if (this.state.outs >= 3) this.changeInning();
            else this.nextBatter();
        } else {
            this.resetBall();
        }
    }

    private handleBall() {
        this.state.balls++;
        this.logEvent('ball', { count: this.state.balls });
        if (this.state.balls >= 4) {
             this.logEvent('walk', {});
             this.advanceRunners(1);
             this.resetCount();
             this.nextBatter(); // Walk implies next batter up
        } else {
            this.resetBall();
        }
    }

    private handleHomeRun() {
        this.logEvent('home_run', { batter: this.getCurrentBatter().id });
        let runs = 1 + this.countRunners();
        this.scoreRuns(runs);
        this.state.bases = [null, null, null];
        this.resetCount();
        this.nextBatter();
        this.resetBall();
    }

    private resolvePlay() {
        // Fielding Logic - Deterministic but based on stats
        // Distance from plate determines ease of out
        const dist = this.distOrigin(this.state.ball.x, this.state.ball.y);

        // Random fielding factor (seeded)
        // If ball is close to a fielder (which we don't simulate positions of for MVP), out.
        // We simulate "Out Probability" based on distance + random.

        let outProb = 0.5; // Base
        if (dist < 150) outProb = 0.9; // Infield
        else if (dist > 300) outProb = 0.2; // Deep outfield

        if (this.rng() < outProb) {
            this.state.outs++;
            this.logEvent('out', { type: 'fielded' });
            if (this.state.outs >= 3) this.changeInning();
            else this.nextBatter();
        } else {
            this.logEvent('hit_result', { type: 'single' }); // Simplified hit type
            this.advanceRunners(1);
            this.nextBatter();
        }
        this.resetBall();
        this.state.phase = this.state.isTopInning ? 'PITCHING' : 'BATTING'; // Actually always PITCHING phase to start next play
        this.state.phase = 'PITCHING';
    }

    private advanceRunners(amount: number) {
        // Simple base shift logic
        let bases = this.state.bases;
        let newBases = [null, null, null] as (Runner | null)[];
        let runs = 0;

        // Batter becomes runner
        const batter = this.getCurrentBatter();
        const batterRunner: Runner = { id: batter.id, stats: batter.stats, teamId: batter.teamId };

        // Move existing
        if (bases[2]) { runs++; } // 3rd -> Home
        if (bases[1]) {
             if (amount >= 2) runs++;
             else newBases[2] = bases[1];
        }
        if (bases[0]) {
             if (amount >= 3) runs++;
             else if (amount == 2) newBases[2] = bases[0];
             else newBases[1] = bases[0];
        }

        // Place Batter
        if (amount >= 4) runs++;
        else if (amount == 1) newBases[0] = batterRunner;
        else if (amount == 2) newBases[1] = batterRunner;
        else if (amount == 3) newBases[2] = batterRunner;

        this.state.bases = newBases;
        if (runs > 0) this.scoreRuns(runs);
    }

    private scoreRuns(n: number) {
        if (this.state.isTopInning) this.state.score.away += n;
        else this.state.score.home += n;
        this.logEvent('run_scored', { amount: n });
    }

    private changeInning() {
        this.state.bases = [null, null, null];
        this.resetCount();
        this.state.outs = 0;

        if (this.state.isTopInning) {
            this.state.isTopInning = false; // Bottom
            this.logEvent('inning_change', { inning: this.state.inning, top: false });
        } else {
            this.state.isTopInning = true; // Top
            this.state.inning++;
            if (this.state.inning > INNINGS) {
                this.state.phase = 'GAME_OVER';
                this.logEvent('game_over', { score: this.state.score });
                return;
            }
            this.logEvent('inning_change', { inning: this.state.inning, top: true });
        }
        this.state.phase = 'PITCHING';
    }

    private resetBall() {
        this.state.ball = { x: FIELD.mound.x, y: FIELD.mound.y, z: 10, vx:0, vy:0, vz:0, state: 'idle' };
    }

    private resetCount() {
        this.state.strikes = 0;
        this.state.balls = 0;
    }

    private nextBatter() {
        if (this.state.isTopInning) {
            this.state.currentBatterIndex.away = (this.state.currentBatterIndex.away + 1) % this.state.awayRoster.length;
        } else {
            this.state.currentBatterIndex.home = (this.state.currentBatterIndex.home + 1) % this.state.homeRoster.length;
        }
    }

    private getCurrentBatter(): Player {
        if (this.state.isTopInning) return this.state.awayRoster[this.state.currentBatterIndex.away];
        return this.state.homeRoster[this.state.currentBatterIndex.home];
    }

    private getCurrentPitcher(): Player {
        if (this.state.isTopInning) return this.state.homeRoster[this.state.currentPitcherIndex.home];
        return this.state.awayRoster[this.state.currentPitcherIndex.away];
    }

    private countRunners() {
        return this.state.bases.filter(b => b !== null).length;
    }

    private distOrigin(x: number, y: number) {
        const dx = x - FIELD.homePlate.x;
        const dy = y - FIELD.homePlate.y;
        return Math.sqrt(dx*dx + dy*dy);
    }

    getSnapshot(): GameState {
        return JSON.parse(JSON.stringify(this.state));
    }
}
