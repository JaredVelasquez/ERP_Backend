IF OBJECT_ID(N'dbo.tenants', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.tenants (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_tenants PRIMARY KEY,
    name NVARCHAR(200) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_tenants_created_at DEFAULT SYSUTCDATETIME()
  );
END;

IF OBJECT_ID(N'dbo.societies', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.societies (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_societies PRIMARY KEY,
    tenant_id UNIQUEIDENTIFIER NOT NULL,
    name NVARCHAR(200) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_societies_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_societies_tenant FOREIGN KEY (tenant_id) REFERENCES dbo.tenants (id)
  );
  CREATE INDEX IX_societies_tenant_id ON dbo.societies (tenant_id);
END;

IF OBJECT_ID(N'dbo.companies', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.companies (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_companies PRIMARY KEY,
    society_id UNIQUEIDENTIFIER NOT NULL,
    legal_name NVARCHAR(200) NOT NULL,
    rtn NVARCHAR(20) NOT NULL,
    currency_code NVARCHAR(3) NOT NULL,
    costing_method NVARCHAR(20) NOT NULL,
    default_margin_percent DECIMAL(9, 4) NULL,
    tax_enabled BIT NOT NULL CONSTRAINT DF_companies_tax_enabled DEFAULT 0,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_companies_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_companies_society FOREIGN KEY (society_id) REFERENCES dbo.societies (id),
    CONSTRAINT UQ_companies_rtn UNIQUE (rtn)
  );
  CREATE INDEX IX_companies_society_id ON dbo.companies (society_id);
END;

IF OBJECT_ID(N'dbo.warehouses', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.warehouses (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_warehouses PRIMARY KEY,
    company_id UNIQUEIDENTIFIER NOT NULL,
    name NVARCHAR(200) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_warehouses_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_warehouses_company FOREIGN KEY (company_id) REFERENCES dbo.companies (id),
    CONSTRAINT UQ_warehouses_company_name UNIQUE (company_id, name)
  );
END;

IF OBJECT_ID(N'dbo.roles', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.roles (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_roles PRIMARY KEY,
    code NVARCHAR(40) NOT NULL,
    name NVARCHAR(100) NOT NULL,
    CONSTRAINT UQ_roles_code UNIQUE (code)
  );
END;

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.users (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_users PRIMARY KEY,
    email NVARCHAR(320) NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    display_name NVARCHAR(200) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_users_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_users_email UNIQUE (email)
  );
END;

IF OBJECT_ID(N'dbo.memberships', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.memberships (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_memberships PRIMARY KEY,
    user_id UNIQUEIDENTIFIER NOT NULL,
    company_id UNIQUEIDENTIFIER NOT NULL,
    role_id UNIQUEIDENTIFIER NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_memberships_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_memberships_user FOREIGN KEY (user_id) REFERENCES dbo.users (id),
    CONSTRAINT FK_memberships_company FOREIGN KEY (company_id) REFERENCES dbo.companies (id),
    CONSTRAINT FK_memberships_role FOREIGN KEY (role_id) REFERENCES dbo.roles (id),
    CONSTRAINT UQ_memberships_user_company UNIQUE (user_id, company_id)
  );
  CREATE INDEX IX_memberships_company_id ON dbo.memberships (company_id);
END;
