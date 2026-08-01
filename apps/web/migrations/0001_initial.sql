PRAGMA foreign_keys = ON;

CREATE TABLE auth_nonces (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  chain_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  contract_address TEXT NOT NULL,
  onchain_project_id TEXT,
  client_address TEXT NOT NULL,
  freelancer_address TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  metadata_json TEXT NOT NULL,
  metadata_hash TEXT NOT NULL,
  creation_tx_hash TEXT,
  creation_block INTEGER,
  link_status TEXT NOT NULL DEFAULT 'draft' CHECK (link_status IN ('draft', 'linked')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  onchain_milestone_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount TEXT NOT NULL,
  due_date INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE (project_id, onchain_milestone_id)
);

CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  milestone_id TEXT NOT NULL,
  submitter_address TEXT NOT NULL,
  message TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  submission_hash TEXT NOT NULL,
  transaction_hash TEXT,
  link_status TEXT NOT NULL DEFAULT 'draft' CHECK (link_status IN ('draft', 'linked')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE CASCADE
);

CREATE TABLE submission_files (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

CREATE TABLE rate_limits (
  rate_key TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (rate_key, bucket)
);

CREATE INDEX idx_nonces_wallet_expiry ON auth_nonces(wallet_address, expires_at);
CREATE INDEX idx_sessions_wallet_expiry ON sessions(wallet_address, expires_at);
CREATE INDEX idx_projects_client ON projects(client_address, updated_at DESC);
CREATE INDEX idx_projects_freelancer ON projects(freelancer_address, updated_at DESC);
CREATE INDEX idx_milestones_project ON milestones(project_id, onchain_milestone_id);
CREATE INDEX idx_submissions_project ON submissions(project_id, created_at DESC);
CREATE INDEX idx_submission_files_submission ON submission_files(submission_id);
CREATE INDEX idx_rate_limits_expiry ON rate_limits(expires_at);
CREATE UNIQUE INDEX idx_projects_onchain_unique
  ON projects(chain_id, contract_address, onchain_project_id)
  WHERE onchain_project_id IS NOT NULL;
CREATE UNIQUE INDEX idx_projects_tx_unique
  ON projects(creation_tx_hash)
  WHERE creation_tx_hash IS NOT NULL;
CREATE UNIQUE INDEX idx_submissions_tx_unique
  ON submissions(transaction_hash)
  WHERE transaction_hash IS NOT NULL;
