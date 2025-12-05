import { RNG } from './rng';
import { GameEvent, MatchState, TeamRoster, Player, PlayerId } from './types';

export class RiverportEngine {
    private rng: RNG;
    private state: MatchState;
    private events: GameEvent[] = [];
    private homeTeam: TeamRoster;
    private awayTeam: TeamRoster;

    constructor(seed: string, homeTeam: TeamRoster, awayTeam: TeamRoster) {
        this.rng = new RNG(seed);
        this.homeTeam = homeTeam;
        this.awayTeam = awayTeam;

        // Initial State
        this.state = {
            inning: 1,
            half: 'top',
            outs: 0,
            balls: 0,
            strikes: 0,
            score: { home: 0, away: 0 },
            runners: [null, null, null],
            batterId: '', // Set on init
            pitcherId: '', // Set on init
            waitingFor: 'pitch'
        };

        this.setupNextBatter();
    }

    public getEvents(): GameEvent[] {
        return this.events;
    }

    public getState(): MatchState {
        return { ...this.state }; // Clone
    }

    private log(type: any, payload: any) {
        this.events.push({
            type,
            payload,
            ts: Date.now(),
            // seq assigned by caller/db usually, but we can track internal seq if needed
        });
    }

    private getBatter(): Player {
        const team = this.state.half === 'top' ? this.awayTeam : this.homeTeam;
        // In a real implementation, we track lineup index in state.
        // For MVP, just picking random from lineup for simplicity if index missing?
        // Let's add lineupIndex to state implicitly or just use a counter.
        // Simplifying: Random lineup for MVP auto-sim or strict index.
        // Let's assume lineup[0] for now and we need to track index in state.
        // Adding lineup index to state on fly:
        const idx = (this.state as any)[`${this.state.half}LineupIdx`] || 0;
        const pid = team.lineup[idx % team.lineup.length];
        return team.players.find(p => p.id === pid) || team.players[0];
    }

    private getPitcher(): Player {
        const team = this.state.half === 'top' ? this.homeTeam : this.awayTeam;
        return team.players.find(p => p.id === team.pitcher) || team.players[0];
    }

    private setupNextBatter() {
        this.state.batterId = this.getBatter().id;
        this.state.pitcherId = this.getPitcher().id;
        this.state.waitingFor = 'pitch';
        this.log('plate_appearance_start', { batter: this.state.batterId, pitcher: this.state.pitcherId });
    }

    private advanceLineup() {
        // Increment lineup index
        const key = `${this.state.half}LineupIdx`;
        (this.state as any)[key] = ((this.state as any)[key] || 0) + 1;
    }

    public applyInput(input: { type: 'pitch' | 'swing', payload: any }) {
        if (input.type === 'pitch' && this.state.waitingFor === 'pitch') {
            this.state.currentPitch = input.payload;
            this.state.waitingFor = 'swing';
            this.log('pitch', input.payload);

            // Auto-resolve if it's a "take" (simulated via explicit 'take' input or timeout - here assumed immediate for sim)
            // But for interactive, we wait.
        } else if (input.type === 'swing' && this.state.waitingFor === 'swing') {
            this.resolvePlay(input.payload);
        }
    }

    // MVP: Simplified resolution
    // Using simple stats: contact vs defense/pitching
    private resolvePlay(swing: any | null) {
        const batter = this.homeTeam.players.find(p => p.id === this.state.batterId) || this.awayTeam.players.find(p => p.id === this.state.batterId);
        const pitcher = this.homeTeam.players.find(p => p.id === this.state.pitcherId) || this.awayTeam.players.find(p => p.id === this.state.pitcherId);

        if (!batter || !pitcher) return; // Should not happen

        // 1. Determine Outcome
        // Simple RNG model based on stats
        // If swing is null, it's a take.
        let outcome = 'ball';

        if (!swing) {
            // Take logic: 50/50 for MVP if pitch in zone (we don't have zone logic yet)
            // Let's just RNG a strike or ball based on pitcher control (mocked as contact for now?)
            outcome = this.rng.check(0.6) ? 'strike' : 'ball';
        } else {
            // Swing logic
            const contactChance = (batter.stats.contact * 0.05) + 0.2; // 10 contact = 0.7 chance
            if (this.rng.check(contactChance)) {
                // Made contact
                outcome = 'hit'; // Could be foul, out, hit
            } else {
                outcome = 'strike'; // Swing and miss
            }
        }

        // 2. Apply Outcome
        if (outcome === 'ball') {
            this.state.balls++;
            this.log('hit_outcome', { result: 'ball', balls: this.state.balls, strikes: this.state.strikes });
        } else if (outcome === 'strike') {
            this.state.strikes++;
            this.log('hit_outcome', { result: 'strike', balls: this.state.balls, strikes: this.state.strikes });
        } else if (outcome === 'hit') {
            // Contact made. Field or Base Hit?
            // Power check
            const isHomerun = this.rng.check(batter.stats.power * 0.03);
            if (isHomerun) {
                this.scoreRun(1 + this.countRunners());
                this.clearRunners();
                this.resetCount();
                this.advanceLineup();
                this.setupNextBatter();
                this.log('hit_outcome', { result: 'homerun' });
                return;
            }

            const isHit = this.rng.check(0.3); // 300 BABIP baseline
            if (isHit) {
                // Single/Double/Triple
                // Assume single for MVP
                this.advanceRunners(1);
                this.log('hit_outcome', { result: 'single' });
                this.resetCount();
                this.advanceLineup();
                this.setupNextBatter();
                return;
            } else {
                // Out (Ground/Fly)
                this.state.outs++;
                this.log('hit_outcome', { result: 'out', outs: this.state.outs });
            }
        }

        // 3. Check Counts
        if (this.state.balls >= 4) {
            this.advanceRunners(1, true); // Walk (forced)
            this.resetCount();
            this.advanceLineup();
            this.setupNextBatter();
        } else if (this.state.strikes >= 3) {
            this.state.outs++;
            this.resetCount();
            this.advanceLineup();
            this.setupNextBatter();
        }

        // 4. Check Inning
        if (this.state.outs >= 3) {
            this.switchSide();
        } else {
            // Ready for next pitch
            this.state.waitingFor = 'pitch';
        }
    }

    private countRunners(): number {
        return this.state.runners.filter(r => r !== null).length;
    }

    private clearRunners() {
        this.state.runners = [null, null, null];
    }

    private advanceRunners(bases: number, forcedOnly = false) {
        // MVP: Simple advancement. Forced walk pushes runners. Hit moves everyone `bases` amount.
        if (forcedOnly) {
            // Walk logic: Push if occupied
            if (this.state.runners[0]) {
                if (this.state.runners[1]) {
                    if (this.state.runners[2]) {
                        this.scoreRun(1);
                    }
                    this.state.runners[2] = this.state.runners[1];
                }
                this.state.runners[1] = this.state.runners[0];
            }
            this.state.runners[0] = this.state.batterId;
        } else {
            // Hit logic: Everyone advances `bases`.
            // Runners on 3rd score?
            // MVP: Simply shift array.
            // Example: Single (1 base).
            // Runner on 3rd -> Score. Runner on 2nd -> 3rd. Runner on 1st -> 2nd. Batter -> 1st.

            // Process from 3rd base down to avoid overwriting
            if (this.state.runners[2]) this.scoreRun(1);
            this.state.runners[2] = this.state.runners[1];
            this.state.runners[1] = this.state.runners[0];
            this.state.runners[0] = this.state.batterId;
        }
    }

    private scoreRun(amount: number) {
        if (this.state.half === 'top') {
            this.state.score.away += amount;
        } else {
            this.state.score.home += amount;
        }
        this.log('run_scored', { amount, score: this.state.score });
    }

    private resetCount() {
        this.state.balls = 0;
        this.state.strikes = 0;
        this.state.currentPitch = undefined;
    }

    private switchSide() {
        this.state.outs = 0;
        this.state.runners = [null, null, null];
        this.resetCount();
        this.log('inning_end', { inning: this.state.inning, half: this.state.half });

        if (this.state.half === 'top') {
            this.state.half = 'bottom';
        } else {
            this.state.half = 'top';
            this.state.inning++;
        }

        if (this.state.inning > 9) {
            this.log('match_end', { finalScore: this.state.score });
            // Stop logic
        } else {
            this.log('inning_start', { inning: this.state.inning, half: this.state.half });
            this.setupNextBatter();
        }
    }

    public simulateToEnd() {
        let safety = 0;
        while (this.state.inning <= 9 && safety < 1000) {
            // Sim Pitch
            this.applyInput({ type: 'pitch', payload: { type: 'fastball', location: {x:0.5, y:0.5} } });

            // Sim Swing (randomly swing or take)
            const swing = this.rng.check(0.5) ? { timing: 0, aim: {x:0.5, y:0.5} } : null;
            this.applyInput({ type: 'swing', payload: swing });

            safety++;
        }
        if (safety >= 1000) console.warn("Sim safety break");
    }
}
