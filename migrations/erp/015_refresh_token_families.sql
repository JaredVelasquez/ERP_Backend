CREATE TABLE auth_session_families (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  company_id uuid NOT NULL REFERENCES companies(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX ix_auth_session_families_user_company
  ON auth_session_families(user_id, company_id);

ALTER TABLE sessions DROP CONSTRAINT sessions_pkey;
ALTER TABLE sessions ALTER COLUMN token DROP NOT NULL;
ALTER TABLE sessions ADD COLUMN token_hash char(64);
ALTER TABLE sessions ADD COLUMN family_id uuid REFERENCES auth_session_families(id);
ALTER TABLE sessions ADD COLUMN expires_at timestamptz;
CREATE UNIQUE INDEX ux_sessions_token_hash ON sessions(token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX ix_sessions_family_id ON sessions(family_id);
ALTER TABLE sessions ADD CONSTRAINT ck_sessions_token_or_hash
  CHECK (token IS NOT NULL OR token_hash IS NOT NULL);

CREATE TABLE refresh_sessions (
  id uuid PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES auth_session_families(id),
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_refresh_sessions_family_id ON refresh_sessions(family_id);
