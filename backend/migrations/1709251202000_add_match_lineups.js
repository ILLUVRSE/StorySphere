/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('matches', {
    lineups: { type: 'jsonb', default: '{}' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('matches', ['lineups']);
};
