import { db } from '../db';

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending', -- pending, running, finished
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS match_players (
  match_id uuid REFERENCES matches(id),
  user_id uuid REFERENCES users(id),
  team_side text CHECK (team_side IN ('HOME', 'AWAY')),
  roster jsonb,
  PRIMARY KEY(match_id, user_id)
);

CREATE TABLE IF NOT EXISTS match_events (
  id bigserial PRIMARY KEY,
  match_id uuid REFERENCES matches(id),
  tick int NOT NULL,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);
`;

export async function initMultiplayerDb() {
  if (db.isReady()) {
    try {
      await db.query(CREATE_TABLES_SQL);
      console.log('Multiplayer DB tables initialized');
    } catch (err) {
      console.error('Failed to initialize multiplayer tables', err);
    }
  } else {
    console.warn('DB not ready, skipping multiplayer table init');
  }
}

// Auto-run if executed directly
if (require.main === module) {
  initMultiplayerDb().then(() => process.exit());
}
