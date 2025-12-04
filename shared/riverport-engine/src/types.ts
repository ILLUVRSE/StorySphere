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
    state: 'idle' | 'pitched' | 'hit' | 'ground' | 'dead';
}

export interface Runner {
    id: string; // Placeholder for now
    stats: PlayerStats;
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
    bases: (Runner | null)[];
    ball: BallState;
    pitchMeter: { active: boolean; value: number; phase: number };
    battingReticle: { x: number; y: number };
    lastEvent?: string; // For notifications
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
