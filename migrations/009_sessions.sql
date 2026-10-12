IF OBJECT_ID(N'dbo.sessions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.sessions (
    token NVARCHAR(128) NOT NULL CONSTRAINT PK_sessions PRIMARY KEY,
    user_id UNIQUEIDENTIFIER NOT NULL,
    company_id UNIQUEIDENTIFIER NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_sessions_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_sessions_user FOREIGN KEY (user_id) REFERENCES dbo.users (id),
    CONSTRAINT FK_sessions_company FOREIGN KEY (company_id) REFERENCES dbo.companies (id)
  );
  CREATE INDEX IX_sessions_user_company ON dbo.sessions (user_id, company_id);
END;
