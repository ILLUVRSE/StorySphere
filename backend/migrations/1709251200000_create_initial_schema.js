exports.shorthands = undefined;

exports.up = (pgm) => {
  // --- USERS ---
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email: { type: 'text', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    display_name: { type: 'text' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  });

  // --- SEASONS ---
  pgm.createTable('seasons', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true },
    year: { type: 'integer', notNull: true },
    status: { type: 'text', notNull: true, default: 'setup' }, // setup, active, completed
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  });

  // --- TEAMS ---
  pgm.createTable('teams', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true },
    owner_id: { type: 'uuid', notNull: true, references: 'users(id)' },
    season_id: { type: 'uuid', references: 'seasons(id)' },
    skill_pool: { type: 'integer', default: 0 },
    wins: { type: 'integer', default: 0 },
    losses: { type: 'integer', default: 0 },
    cosmetics: { type: 'jsonb', default: '{}' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  });

  // --- PLAYERS ---
  pgm.createTable('players', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    team_id: { type: 'uuid', notNull: true, references: 'teams(id)' },
    name: { type: 'text', notNull: true },
    position: { type: 'text', notNull: true },
    archetype: { type: 'text' },
    stats: { type: 'jsonb', notNull: true, default: '{}' },
    skill_points_invested: { type: 'integer', default: 0 },
    injury: { type: 'jsonb', default: null }, // { status: 'healthy', return_week: null }
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  });

  // --- MATCHES ---
  pgm.createTable('matches', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    season_id: { type: 'uuid', references: 'seasons(id)' },
    week: { type: 'integer' },
    home_team: { type: 'uuid', references: 'teams(id)' },
    away_team: { type: 'uuid', references: 'teams(id)' },
    status: { type: 'text', notNull: true, default: 'scheduled' }, // scheduled, in_progress, completed
    seed: { type: 'text' },
    final_score: { type: 'jsonb' }, // { home: 0, away: 0 }
    created_by: { type: 'uuid', references: 'users(id)' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  });

  // --- EVENT_LOGS ---
  pgm.createTable('event_logs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    match_id: { type: 'uuid', notNull: true, references: 'matches(id)' },
    seq: { type: 'integer', notNull: true },
    ts: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    type: { type: 'text', notNull: true },
    payload: { type: 'jsonb', notNull: true, default: '{}' },
  });
  pgm.addConstraint('event_logs', 'match_seq_unique', { unique: ['match_id', 'seq'] });

  // --- TEAM_SKILL_POINTS (Ledger) ---
  pgm.createTable('team_skill_points', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    team_id: { type: 'uuid', notNull: true, references: 'teams(id)' },
    amount: { type: 'integer', notNull: true },
    reason: { type: 'text', notNull: true }, // match_win, creation_pool, etc
    match_id: { type: 'uuid', references: 'matches(id)' },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  });

  // --- TELEMETRY ---
  pgm.createTable('telemetry_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    event_type: { type: 'text', notNull: true },
    payload: { type: 'jsonb', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('telemetry_events');
  pgm.dropTable('team_skill_points');
  pgm.dropTable('event_logs');
  pgm.dropTable('matches');
  pgm.dropTable('players');
  pgm.dropTable('teams');
  pgm.dropTable('seasons');
  pgm.dropTable('users');
};
