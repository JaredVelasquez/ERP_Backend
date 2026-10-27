ALTER TABLE memberships ADD COLUMN active boolean NOT NULL DEFAULT true;

INSERT INTO module_grants (id, membership_id, module_name, access_level)
SELECT gen_random_uuid(), m.id, 'settings', 'edit'
FROM memberships m JOIN roles r ON r.id = m.role_id
WHERE r.code IN ('owner', 'platform-admin')
  AND NOT EXISTS (SELECT 1 FROM module_grants g WHERE g.membership_id = m.id AND g.module_name = 'settings');

ALTER TABLE mcp_audit_log ADD COLUMN token_id uuid REFERENCES mcp_tokens(id) ON DELETE SET NULL;
CREATE INDEX ix_mcp_audit_company_user_time ON mcp_audit_log(company_id, user_id, created_at DESC);
CREATE INDEX ix_mcp_audit_token_time ON mcp_audit_log(token_id, created_at DESC);

CREATE TABLE company_ai_settings (
  company_id uuid PRIMARY KEY REFERENCES companies(id),
  provider varchar(32) NOT NULL CHECK (provider IN ('gemini', 'anthropic', 'openai')),
  model varchar(120) NOT NULL,
  encrypted_key text NOT NULL,
  key_hint varchar(12) NOT NULL,
  updated_by uuid NOT NULL REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
