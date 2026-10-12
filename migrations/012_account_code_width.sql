IF COL_LENGTH(N'dbo.accounts', N'code') IS NOT NULL
   AND (
     SELECT c.max_length
     FROM sys.columns c
     WHERE c.object_id = OBJECT_ID(N'dbo.accounts') AND c.name = N'code'
   ) < 64
BEGIN
  ALTER TABLE dbo.accounts ALTER COLUMN code NVARCHAR(32) NOT NULL;
END;

IF COL_LENGTH(N'dbo.journal_lines', N'account_code') IS NOT NULL
   AND (
     SELECT c.max_length
     FROM sys.columns c
     WHERE c.object_id = OBJECT_ID(N'dbo.journal_lines') AND c.name = N'account_code'
   ) < 64
BEGIN
  ALTER TABLE dbo.journal_lines ALTER COLUMN account_code NVARCHAR(32) NOT NULL;
END;

IF COL_LENGTH(N'dbo.posting_rules', N'debit_code') IS NOT NULL
   AND (
     SELECT c.max_length
     FROM sys.columns c
     WHERE c.object_id = OBJECT_ID(N'dbo.posting_rules') AND c.name = N'debit_code'
   ) < 64
BEGIN
  ALTER TABLE dbo.posting_rules ALTER COLUMN debit_code NVARCHAR(32) NULL;
END;

IF COL_LENGTH(N'dbo.posting_rules', N'credit_code') IS NOT NULL
   AND (
     SELECT c.max_length
     FROM sys.columns c
     WHERE c.object_id = OBJECT_ID(N'dbo.posting_rules') AND c.name = N'credit_code'
   ) < 64
BEGIN
  ALTER TABLE dbo.posting_rules ALTER COLUMN credit_code NVARCHAR(32) NULL;
END;
