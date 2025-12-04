export const CONFIG = {
    // Gameplay
    MANDATORY_CAPTURES: true, // If true, player must capture if able
    PAR_TIME_MS: 300000, // 5 minutes in ms
    MOVE_TIME_LIMIT_MS: 800, // AI max think time

    // Visuals
    THEME: 'TEAL', // Default theme: 'TEAL' or 'CLASSIC'
    ANIMATION_SPEED_MS: 150,

    // AI
    AI_DEPTH_EASY: 2,
    AI_DEPTH_MEDIUM: 4,
    AI_DEPTH_HARD: 6,

    // Scoring
    SCORE_WIN_BASE: 1000000,
    SCORE_TIME_FACTOR: 0.1,
    SCORE_MATERIAL_FACTOR: 500,
    SCORE_DRAW_FACTOR: 100,

    // Themes Data
    THEMES: {
        TEAL: {
            boardLight: '#fdfbf7', // Cream
            boardDark: '#004d40',  // Dark Teal
            p1: '#009688',         // Teal Accent (Player)
            p2: '#e53935',         // Red (AI/Opponent)
            highlight: 'rgba(255, 215, 0, 0.5)', // Gold
            validMove: 'rgba(0, 255, 0, 0.3)',
            lastMove: 'rgba(255, 255, 255, 0.2)',
            text: '#f0f0f0'
        },
        CLASSIC: {
            boardLight: '#eecfa1', // Wood light
            boardDark: '#8b4513',  // Wood dark
            p1: '#000000',         // Black (Player)
            p2: '#cc0000',         // Red (AI/Opponent)
            highlight: 'rgba(255, 255, 0, 0.5)',
            validMove: 'rgba(0, 255, 0, 0.4)',
            lastMove: 'rgba(255, 255, 255, 0.3)',
            text: '#f0f0f0'
        }
    }
};
