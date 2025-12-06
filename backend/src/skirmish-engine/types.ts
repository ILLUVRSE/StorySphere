// Core types for the Skirmish Engine (Checkers + Scenario)

export type PieceType = 'MILITIA' | 'KNIGHT' | 'ARCHER' | 'SIEGE' | 'COMMANDER';
export type PlayerId = string; // e.g. "P1", "P2"
export type TileType = 'NORMAL' | 'FORT' | 'SUPPLY' | 'TRAP' | 'VOID';

export interface Piece {
    id: string;
    type: PieceType;
    owner: number; // 1 (Bottom/P1), -1 (Top/P2)
    isKing: boolean;
    hp: number; // For future mechanics, MVP can ignore or use for Siege rules
}

export interface BoardTile {
    type: TileType;
    piece: Piece | null;
}

export type Board = BoardTile[][];

export interface Position {
    r: number;
    c: number;
}

export interface Move {
    from: Position;
    to: Position;
    jumps: Position[];   // Intermediate steps or landing spots? Usually landing spots.
    captured: Position[]; // Coordinates of captured pieces
}

export interface SkirmishState {
    board: Board;
    turn: number; // 1 or -1
    movesWithoutCapture: number;
    winner: number | null; // 1, -1, or 0 (Draw)
    history: any[]; // Log of moves
    config: SkirmishConfig;
}

export interface SkirmishConfig {
    scenario: 'CLASSIC' | 'SIEGE'; // Expandable
    mandatoryCaptures: boolean;
    turnTimeLimitMs: number;
}
