IF OBJECT_ID(N'dbo.accounts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.accounts (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_accounts PRIMARY KEY,
    company_id UNIQUEIDENTIFIER NOT NULL,
    code NVARCHAR(20) NOT NULL,
    name NVARCHAR(200) NOT NULL,
    kind NVARCHAR(20) NOT NULL,
    postable BIT NOT NULL,
    is_collection BIT NOT NULL CONSTRAINT DF_accounts_is_collection DEFAULT 0,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_accounts_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_accounts_company FOREIGN KEY (company_id) REFERENCES dbo.companies (id),
    CONSTRAINT UQ_accounts_company_code UNIQUE (company_id, code)
  );
  CREATE INDEX IX_accounts_company_id ON dbo.accounts (company_id);
END;

IF OBJECT_ID(N'dbo.posting_rules', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.posting_rules (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_posting_rules PRIMARY KEY,
    company_id UNIQUEIDENTIFIER NOT NULL,
    document_type NVARCHAR(40) NOT NULL,
    debit_code NVARCHAR(20) NULL,
    credit_code NVARCHAR(20) NULL,
    debit_uses_collection BIT NOT NULL,
    credit_uses_payment BIT NOT NULL,
    CONSTRAINT FK_posting_rules_company FOREIGN KEY (company_id) REFERENCES dbo.companies (id),
    CONSTRAINT UQ_posting_rules_company_type UNIQUE (company_id, document_type)
  );
END;

IF OBJECT_ID(N'dbo.tax_categories', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.tax_categories (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_tax_categories PRIMARY KEY,
    company_id UNIQUEIDENTIFIER NOT NULL,
    code NVARCHAR(20) NOT NULL,
    name NVARCHAR(100) NOT NULL,
    rate_percent DECIMAL(9, 4) NOT NULL,
    is_default BIT NOT NULL,
    CONSTRAINT FK_tax_categories_company FOREIGN KEY (company_id) REFERENCES dbo.companies (id),
    CONSTRAINT UQ_tax_categories_company_code UNIQUE (company_id, code)
  );
END;
