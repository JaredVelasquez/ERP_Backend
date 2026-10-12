IF OBJECT_ID(N'dbo.document_submissions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.document_submissions (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_document_submissions PRIMARY KEY,
    company_id UNIQUEIDENTIFIER NOT NULL,
    service_type NVARCHAR(40) NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    currency_code NVARCHAR(3) NOT NULL,
    reference NVARCHAR(80) NOT NULL,
    holder NVARCHAR(200) NOT NULL,
    institution NVARCHAR(200) NOT NULL,
    dni NVARCHAR(40) NOT NULL,
    phone NVARCHAR(40) NOT NULL,
    occurred_on DATE NOT NULL,
    accepted_declaration BIT NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_document_submissions_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_document_submissions_company FOREIGN KEY (company_id) REFERENCES dbo.companies (id)
  );
END;

IF OBJECT_ID(N'dbo.document_signatures', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.document_signatures (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_document_signatures PRIMARY KEY,
    submission_id UNIQUEIDENTIFIER NOT NULL,
    image_data NVARCHAR(MAX) NOT NULL,
    CONSTRAINT FK_document_signatures_submission FOREIGN KEY (submission_id) REFERENCES dbo.document_submissions (id)
  );
END;
