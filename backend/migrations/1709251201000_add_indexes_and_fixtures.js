/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // --- ADD INDEXES ---
  // Foreign keys do not automatically create indexes in Postgres.
  // We add them here for performance.
  pgm.createIndex('teams', 'owner_id');
  pgm.createIndex('teams', 'season_id');
  pgm.createIndex('players', 'team_id');
  pgm.createIndex('matches', 'season_id');
  pgm.createIndex('matches', 'home_team');
  pgm.createIndex('matches', 'away_team');
  pgm.createIndex('matches', 'created_by');
  pgm.createIndex('team_skill_points', 'team_id');
  pgm.createIndex('team_skill_points', 'match_id');

  // Note: 'event_logs' already has a unique constraint on (match_id, seq),
  // which creates an index that can satisfy queries on match_id.

  // --- INSERT FIXTURE DATA ---
  // Insert 1 User, 1 Season, 1 Team, 13 Players, 1 Match
  pgm.sql(`
    WITH new_user AS (
      INSERT INTO users (email, password_hash, display_name)
      VALUES ('owner@riverport.com', 'placeholder_hash', 'League Owner')
      RETURNING id
    ),
    new_season AS (
      INSERT INTO seasons (name, year, status)
      VALUES ('Season 1', 2024, 'setup')
      RETURNING id
    ),
    new_team AS (
      INSERT INTO teams (name, owner_id, season_id, skill_pool)
      SELECT 'Riverport Raccoons', new_user.id, new_season.id, 30
      FROM new_user, new_season
      RETURNING id, season_id
    ),
    inserted_players AS (
      INSERT INTO players (team_id, name, position, stats)
      SELECT new_team.id, p.name, p.pos, '{"power": 5, "contact": 5, "speed": 5, "defense": 5}'::jsonb
      FROM new_team, (VALUES
        ('Ace Pitcher', 'P'),
        ('Catcher Joe', 'C'),
        ('First Base', '1B'),
        ('Second Base', '2B'),
        ('Third Base', '3B'),
        ('Shortstop', 'SS'),
        ('Left Field', 'LF'),
        ('Center Field', 'CF'),
        ('Right Field', 'RF'),
        ('Slugger', 'DH'),
        ('Utility 1', 'Bench'),
        ('Utility 2', 'Bench'),
        ('Rookie', 'Bench')
      ) AS p(name, pos)
    )
    INSERT INTO matches (season_id, home_team, week, status, seed)
    SELECT new_team.season_id, new_team.id, 1, 'scheduled', 'initial_seed_123'
    FROM new_team;
  `);
};

exports.down = (pgm) => {
  // --- REMOVE FIXTURE DATA ---
  pgm.sql(`
    DELETE FROM matches WHERE seed = 'initial_seed_123';
    DELETE FROM players WHERE team_id IN (SELECT id FROM teams WHERE name = 'Riverport Raccoons');
    DELETE FROM teams WHERE name = 'Riverport Raccoons';
    DELETE FROM seasons WHERE name = 'Season 1' AND year = 2024;
    DELETE FROM users WHERE email = 'owner@riverport.com';
  `);

  // --- DROP INDEXES ---
  pgm.dropIndex('team_skill_points', 'match_id');
  pgm.dropIndex('team_skill_points', 'team_id');
  pgm.dropIndex('matches', 'created_by');
  pgm.dropIndex('matches', 'away_team');
  pgm.dropIndex('matches', 'home_team');
  pgm.dropIndex('matches', 'season_id');
  pgm.dropIndex('players', 'team_id');
  pgm.dropIndex('teams', 'season_id');
  pgm.dropIndex('teams', 'owner_id');
};
