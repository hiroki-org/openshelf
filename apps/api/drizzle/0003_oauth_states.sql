CREATE TABLE oauth_states (
  state TEXT PRIMARY KEY,
  browser_nonce TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX oauth_states_created_at_idx ON oauth_states (created_at);
