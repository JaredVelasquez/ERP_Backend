IF OBJECT_ID(N'dbo.module_grants', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.module_grants (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_module_grants PRIMARY KEY,
    membership_id UNIQUEIDENTIFIER NOT NULL,
    module_name NVARCHAR(40) NOT NULL,
    access_level NVARCHAR(10) NOT NULL,
    CONSTRAINT FK_module_grants_membership FOREIGN KEY (membership_id) REFERENCES dbo.memberships (id),
    CONSTRAINT UQ_module_grants_membership_module UNIQUE (membership_id, module_name)
  );
  CREATE INDEX IX_module_grants_membership_id ON dbo.module_grants (membership_id);
END;
