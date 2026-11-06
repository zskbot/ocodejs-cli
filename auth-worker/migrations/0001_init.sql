CREATE TABLE IF NOT EXISTS auth_users (
  github_id TEXT PRIMARY KEY,
  github_login TEXT NOT NULL,
  token_ciphertext TEXT NOT NULL,
  token_kind TEXT NOT NULL CHECK(token_kind IN ('oauth', 'pat')),
  scopes TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  id_hash TEXT PRIMARY KEY,
  github_id TEXT NOT NULL,
  csrf_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY(github_id) REFERENCES auth_users(github_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(github_id);
CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_states_expiry_idx ON oauth_states(expires_at);
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key_hash TEXT PRIMARY KEY,
  window_id INTEGER NOT NULL,
  hits INTEGER NOT NULL
);
