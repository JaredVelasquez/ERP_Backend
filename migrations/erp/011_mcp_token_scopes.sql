ALTER TABLE mcp_tokens ADD COLUMN name varchar(120) NOT NULL DEFAULT 'Integración anterior';
ALTER TABLE mcp_tokens ADD COLUMN profile varchar(40) NOT NULL DEFAULT 'legacy';
ALTER TABLE mcp_tokens ADD COLUMN tools jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE mcp_tokens ADD COLUMN expires_at timestamptz;
ALTER TABLE mcp_tokens ADD COLUMN revoked_at timestamptz;
ALTER TABLE mcp_tokens ADD COLUMN last_used_at timestamptz;
CREATE INDEX ix_mcp_tokens_owner ON mcp_tokens(user_id, company_id, created_at DESC);
