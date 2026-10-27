CREATE TABLE mcp_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  company_id uuid NOT NULL REFERENCES companies(id),
  token_hash varchar(128) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_mcp_tokens_user_company ON mcp_tokens(user_id, company_id);

CREATE TABLE mcp_audit_log (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  tool_name varchar(80) NOT NULL,
  result varchar(20) NOT NULL,
  movement_id varchar(80),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_mcp_audit_log_company ON mcp_audit_log(company_id, created_at);
