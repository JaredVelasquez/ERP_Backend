IF COL_LENGTH(N'dbo.document_submissions', N'bank_reference') IS NULL
BEGIN
  ALTER TABLE dbo.document_submissions ADD bank_reference NVARCHAR(80) NOT NULL CONSTRAINT DF_document_submissions_bank_reference DEFAULT N'';
END;

IF COL_LENGTH(N'dbo.document_submissions', N'money_movement_id') IS NULL
BEGIN
  ALTER TABLE dbo.document_submissions ADD money_movement_id UNIQUEIDENTIFIER NULL;
END;

IF COL_LENGTH(N'dbo.document_submissions', N'status') IS NULL
BEGIN
  ALTER TABLE dbo.document_submissions ADD status NVARCHAR(20) NOT NULL CONSTRAINT DF_document_submissions_status DEFAULT N'draft';
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_document_submissions_movement')
BEGIN
  ALTER TABLE dbo.document_submissions ADD CONSTRAINT FK_document_submissions_movement
    FOREIGN KEY (money_movement_id) REFERENCES dbo.inventory_documents (id);
END;
