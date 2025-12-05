// Expanded Types for Full Gameplay Logic

export type TeamSide = 'HOME' | 'AWAY';
export type GamePhase = 'MENU' | 'PITCHING' | 'BATTING' | 'RUNNING' | 'INNING_END' | 'GAME_OVER';

export interface PlayerStats {
    name: string;
    power: number;
    speed: number;
    girth: number;
    stamina: number; // 0-1
    fielding: number;
    arm: number;
    knees: number; // Injury proneness

    // Visuals
    skinColor: string;
    shirtColor: string;
    hatColor: string;
}

export interface Player {
    id: string;
    teamId: string;
    stats: PlayerStats;
    fatigue: number; // 0-100, rises with actions
    injury: { status: 'healthy' | 'injured', gamesOut: number } | null;
}

export interface BallState {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    state: 'idle' | 'pitched' | 'hit' | 'ground' | 'dead';
}

export interface Runner {
    id: string;
    stats: PlayerStats;
    teamId: string;
}

export interface GameState {
    tick: number;
    matchId: string;
    phase: GamePhase;
    inning: number;
    isTopInning: boolean;
    score: { home: number; away: number };
    outs: number;
    strikes: number;
    balls: number;
    bases: (Runner | null)[]; // [1st, 2nd, 3rd]
    ball: BallState;

    // Mechanics
    pitchMeter: { active: boolean; value: number; phase: number }; // phase: 0=idle, 1=power, 2=accuracy
    battingReticle: { x: number; y: number };

    // Roster State (who is currently on mound/plate)
    homeRoster: Player[];
    awayRoster: Player[];
    currentBatterIndex: { home: number, away: number };
    currentPitcherIndex: { home: number, away: number }; // Index in roster (usually P is specialized)

    lastEvent?: MatchEvent;
    eventLog: MatchEvent[];
}

export interface InputAction {
    type: 'START_PITCH' | 'PITCH_PHASE_2' | 'THROW_PITCH' | 'MOVE_RETICLE' | 'SWING';
    payload?: any;
}

export interface GameInput {
    clientId: string;
    seq: number;
    ts: number;
    action: InputAction;
}

export interface MatchEvent {
    seq: number;
    ts: string;
    type: 'pitch_thrown' | 'swing' | 'hit_result' | 'strike' | 'ball' | 'out' | 'walk' | 'run_scored' | 'inning_change' | 'game_over' | 'foul' | 'home_run' | 'injury';
    payload: any;
}
