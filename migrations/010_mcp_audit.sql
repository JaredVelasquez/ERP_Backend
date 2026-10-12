IF OBJECT_ID(N'dbo.mcp_tokens', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.mcp_tokens (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_mcp_tokens PRIMARY KEY,
    user_id UNIQUEIDENTIFIER NOT NULL,
    company_id UNIQUEIDENTIFIER NOT NULL,
    token_hash NVARCHAR(128) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_mcp_tokens_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_mcp_tokens_hash UNIQUE (token_hash),
    CONSTRAINT FK_mcp_tokens_user FOREIGN KEY (user_id) REFERENCES dbo.users (id),
    CONSTRAINT FK_mcp_tokens_company FOREIGN KEY (company_id) REFERENCES dbo.companies (id)
  );
  CREATE INDEX IX_mcp_tokens_user_company ON dbo.mcp_tokens (user_id, company_id);
END;

IF OBJECT_ID(N'dbo.mcp_audit_log', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.mcp_audit_log (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_mcp_audit_log PRIMARY KEY,
    user_id UNIQUEIDENTIFIER NOT NULL,
    company_id UNIQUEIDENTIFIER NOT NULL,
    tool_name NVARCHAR(80) NOT NULL,
    result NVARCHAR(20) NOT NULL,
    movement_id NVARCHAR(80) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_mcp_audit_log_created_at DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_mcp_audit_log_company ON dbo.mcp_audit_log (company_id, created_at);
END;
