-- Development placeholder column. Production address remains B-002 and is not Michelle's legal address.
IF COL_LENGTH(N'dbo.companies', N'address') IS NULL
BEGIN
  ALTER TABLE dbo.companies ADD address NVARCHAR(300) NULL;
END;
