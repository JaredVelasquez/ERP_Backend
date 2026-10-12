IF COL_LENGTH(N'dbo.document_submissions', N'service_note') IS NULL
BEGIN
  ALTER TABLE dbo.document_submissions ADD service_note NVARCHAR(120) NOT NULL CONSTRAINT DF_document_submissions_service_note DEFAULT N'';
END;
