IF OBJECT_ID(N'dbo.inventory_documents', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.inventory_documents (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_inventory_documents PRIMARY KEY,
    company_id UNIQUEIDENTIFIER NOT NULL,
    document_type NVARCHAR(40) NOT NULL,
    status NVARCHAR(20) NOT NULL,
    idempotency_key NVARCHAR(80) NOT NULL,
    reversal_of UNIQUEIDENTIFIER NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_inventory_documents_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_inventory_documents_company FOREIGN KEY (company_id) REFERENCES dbo.companies (id),
    CONSTRAINT UQ_inventory_documents_company_key UNIQUE (company_id, idempotency_key)
  );
END;

IF OBJECT_ID(N'dbo.cost_layers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cost_layers (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_cost_layers PRIMARY KEY,
    company_id UNIQUEIDENTIFIER NOT NULL,
    product_id UNIQUEIDENTIFIER NOT NULL,
    received_at DATETIME2 NOT NULL,
    expires_on DATE NULL,
    quantity DECIMAL(18, 4) NOT NULL,
    unit_cost DECIMAL(18, 4) NOT NULL
  );
  CREATE INDEX IX_cost_layers_company_product ON dbo.cost_layers (company_id, product_id);
END;

IF OBJECT_ID(N'dbo.journal_entries', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.journal_entries (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_journal_entries PRIMARY KEY,
    company_id UNIQUEIDENTIFIER NOT NULL,
    document_id UNIQUEIDENTIFIER NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_journal_entries_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_journal_entries_document FOREIGN KEY (document_id) REFERENCES dbo.inventory_documents (id)
  );
END;

IF OBJECT_ID(N'dbo.journal_lines', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.journal_lines (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_journal_lines PRIMARY KEY,
    entry_id UNIQUEIDENTIFIER NOT NULL,
    account_code NVARCHAR(20) NOT NULL,
    debit DECIMAL(18, 2) NOT NULL,
    credit DECIMAL(18, 2) NOT NULL,
    CONSTRAINT FK_journal_lines_entry FOREIGN KEY (entry_id) REFERENCES dbo.journal_entries (id)
  );
END;
