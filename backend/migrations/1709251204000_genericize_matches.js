exports.shorthands = undefined;

exports.up = (pgm) => {
    // Genericize matches table
    pgm.alterColumn('matches', 'season_id', { notNull: false });
    pgm.alterColumn('matches', 'week', { notNull: false });
    pgm.alterColumn('matches', 'home_team', { notNull: false });
    pgm.alterColumn('matches', 'away_team', { notNull: false });

    pgm.addColumns('matches', {
        type: { type: 'text', notNull: true, default: 'baseball' },
        players: { type: 'jsonb', default: '[]' },
        campaign_state: { type: 'jsonb', default: '{}' }
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('matches', ['type', 'players', 'campaign_state']);

    // Note: We can't easily revert the NULL constraints if there is data that violates them,
    // but for 'down' migration we assume we can revert to strict if we clean up.
    // Ideally we'd set defaults or delete non-compliant rows, but for now we leave them nullable or try to strict them.
    // Leaving them nullable is safer for 'down' in dev, but strictly speaking we should revert schema exactly.
    // However, since we might have created 'campaign' matches with nulls, reverting would fail.
    // We will skip reverting the nullability to avoid data loss/errors during development iteration.
};
