# Indian Poker

**Mission**: Fast multiplayer bluffing rounds where each player sees opponents’ cards but not their own.

## Core Loop
1.  **Ante**: All players pay an ante to start the round.
2.  **Deal**: Each player gets 1 card.
    *   **Crucial Twist**: You hold your card on your forehead (metaphorically). You see everyone else's card, but NOT your own.
3.  **Betting**: Standard poker betting (Check, Call, Raise, Fold).
    *   Strategy: Infer your card's strength based on what you see and how others bet.
    *   If you see 3 Kings on the table, it's unlikely you have a King.
    *   If opponents fold, maybe they see you have a monster card? Or maybe they just have weak cards themselves.
4.  **Showdown**: Highest card wins. Aces are high.

## Controls
*   **Fold**: Give up the pot.
*   **Check/Call**: Match the current bet.
*   **Raise**: Increase the bet.

## Rules (MVP)
*   **Deck**: Standard 52 cards.
*   **Rank**: A, K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3, 2. (A is High).
*   **Suits**: No effect on rank (Spades, Hearts, Diamonds, Clubs).
*   **Ties**: Pot is split.

## Scoring
*   **GameGrid Score**: Calculated based on net chips won during the session.
*   **Leaderboard**: Tracks highest winnings in a single session.
