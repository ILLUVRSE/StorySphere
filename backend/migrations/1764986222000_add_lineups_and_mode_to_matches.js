exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('matches', {
    lineups: { type: 'jsonb', notNull: true, default: '{}' },
    mode: { type: 'text', notNull: true, default: 'live' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('matches', ['lineups', 'mode']);
};
