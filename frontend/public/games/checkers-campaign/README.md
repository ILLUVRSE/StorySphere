# Checkers

A fast-paced, arcade-style implementation of American Checkers (8x8) built for GameGrid.

## Rules
- **Board**: 8x8 grid. Play is on dark squares only.
- **Pieces**: Each player has 12 pieces (Red vs White/Teal).
- **Movement**:
  - Regular pieces move diagonally forward one square.
  - Kings (crowned pieces) can move diagonally forward or backward.
- **Capturing**:
  - Captures are made by jumping over an opponent's piece.
  - **Mandatory Captures**: If a capture is available, you *must* take it.
  - **Multi-Jumps**: If a landing square allows another capture, you must continue jumping.
- **Winning**:
  - Capture all opponent pieces.
  - Block opponent so they have no legal moves.

## Controls
- **Mouse/Touch**: Click a piece to select it. Valid moves will highlight. Click a highlighted square to move.
- **Drag**: (Optional) Drag a piece to a valid destination.

## Scoring
- **Win**: `1,000,000 + (remainingTimeMs * 0.1) + (materialAdvantage * 500)`
- **Draw/Loss**: `materialAdvantage * 100`
- **Time Limit**: Matches have a "Par Time" (default 5 mins) for score calculation.

## Development
- `engine.js`: Core rules, move generation (inc. chains).
- `ai.js`: Web Worker using Minimax with Alpha-Beta pruning.
- `renderer.js`: Canvas rendering with Teal/Classic themes.
- `input.js`: Unified mouse/touch handling.
