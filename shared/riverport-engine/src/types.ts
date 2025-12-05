export type TeamSide = 'HOME' | 'AWAY';
export type GamePhase = 'MENU' | 'PITCHING' | 'BATTING' | 'RUNNING' | 'INNING_END' | 'GAME_OVER';

export interface PlayerStats {
    name: string;
    power: number;
    speed: number;
    girth: number;
    stamina: number;
    skinColor: string;
    shirtColor: string;
}

export interface BallState {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    state: 'idle' | 'pitched' | 'hit' | 'ground' | 'dead' | 'caught';
}

export interface Fielder {
    id: string;
    position: { x: number; y: number }; // Current visual position
    target?: { x: number; y: number }; // Where they are running to
    speed: number;
    state: 'idle' | 'running' | 'catching' | 'throwing';
}

export interface Runner {
    id: string;
    stats: PlayerStats;
    base: number; // 0=home->1st, 1=1st->2nd, 2=2nd->3rd, 3=3rd->home
    progress: number; // 0.0 to 1.0 (1.0 = reached next base)
    safe: boolean; // True if standing on a base
}

export interface GameState {
    tick: number;
    phase: GamePhase;
    inning: number;
    isTopInning: boolean;
    score: { home: number; away: number };
    outs: number;
    strikes: number;
    balls: number;

    // Updated Logic
    runners: Runner[]; // Active runners on field
    fielders: Fielder[]; // Active fielders (defense)

    // Legacy support (to be deprecated or mapped)
    bases: (Runner | null)[]; // Snapshot for UI ease? Or derive from runners

    ball: BallState;
    pitchMeter: { active: boolean; value: number; phase: number };
    battingReticle: { x: number; y: number };
    lastEvent?: string; // For notifications
}

export interface InputAction {
    type: 'START_PITCH' | 'PITCH_PHASE_2' | 'THROW_PITCH' | 'MOVE_RETICLE' | 'SWING' | 'ADVANCE_RUNNER';
    payload?: any;
}

export interface GameInput {
    clientId: string;
    seq: number;
    ts: number;
    action: InputAction;
}
