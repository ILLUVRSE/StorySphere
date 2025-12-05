export type TeamId = string;
export type PlayerId = string;

export interface PlayerStats {
    power: number;
    contact: number;
    speed: number;
    defense: number;
}

export interface Player {
    id: PlayerId;
    name: string;
    position: string;
    stats: PlayerStats;
    // Runtime stats (fatigue, etc - not used yet)
}

export interface TeamRoster {
    id: TeamId;
    name: string;
    players: Player[]; // Full roster
    lineup: PlayerId[]; // Ordered list of 9 batters
    pitcher: PlayerId; // Current pitcher
}

export interface MatchState {
    inning: number; // 1-based
    half: 'top' | 'bottom'; // top = away batting, bottom = home batting
    outs: number; // 0-2
    balls: number; // 0-3
    strikes: number; // 0-2
    score: {
        home: number;
        away: number;
    };
    runners: (PlayerId | null)[]; // [1st, 2nd, 3rd] - null if empty

    // Who is active?
    batterId: PlayerId;
    pitcherId: PlayerId;

    // Wait state
    waitingFor: 'pitch' | 'swing' | 'resolution';
    currentPitch?: PitchEvent; // Holding the pitch while waiting for swing
}

export type EventType =
    | 'match_start'
    | 'inning_start'
    | 'plate_appearance_start'
    | 'pitch'
    | 'swing'
    | 'hit_outcome' // outcome of contact (hit, out, foul)
    | 'run_scored'
    | 'inning_end'
    | 'match_end';

export interface BaseEvent {
    type: EventType;
    seq?: number; // Sequence number in the log
    ts?: number;  // Timestamp
    payload: any;
}

export interface PitchEvent {
    type: 'fastball' | 'curveball' | 'slider' | 'changeup';
    location: { x: number, y: number }; // 0-1 zone
}

export interface SwingEvent {
    timing: number; // relative to ideal
    aim: { x: number, y: number };
}

export interface GameEvent extends BaseEvent {
    stateBefore?: MatchState;
    stateAfter?: MatchState;
}
