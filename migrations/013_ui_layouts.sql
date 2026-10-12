IF OBJECT_ID(N'dbo.table_layouts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.table_layouts (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_table_layouts PRIMARY KEY,
    company_id UNIQUEIDENTIFIER NOT NULL,
    user_id UNIQUEIDENTIFIER NOT NULL,
    table_key NVARCHAR(80) NOT NULL,
    page_size INT NOT NULL,
    columns_json NVARCHAR(MAX) NOT NULL,
    CONSTRAINT FK_table_layouts_company FOREIGN KEY (company_id) REFERENCES dbo.companies (id),
    CONSTRAINT FK_table_layouts_user FOREIGN KEY (user_id) REFERENCES dbo.users (id),
    CONSTRAINT UQ_table_layouts_scope UNIQUE (company_id, user_id, table_key)
  );
END;

IF OBJECT_ID(N'dbo.dashboard_layouts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.dashboard_layouts (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_dashboard_layouts PRIMARY KEY,
    company_id UNIQUEIDENTIFIER NOT NULL,
    user_id UNIQUEIDENTIFIER NOT NULL,
    widgets_json NVARCHAR(MAX) NOT NULL,
    CONSTRAINT FK_dashboard_layouts_company FOREIGN KEY (company_id) REFERENCES dbo.companies (id),
    CONSTRAINT FK_dashboard_layouts_user FOREIGN KEY (user_id) REFERENCES dbo.users (id),
    CONSTRAINT UQ_dashboard_layouts_scope UNIQUE (company_id, user_id)
  );
END;

IF OBJECT_ID(N'dbo.ui_preferences', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ui_preferences (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ui_preferences PRIMARY KEY,
    company_id UNIQUEIDENTIFIER NOT NULL,
    user_id UNIQUEIDENTIFIER NOT NULL,
    sidebar_collapsed BIT NOT NULL,
    CONSTRAINT FK_ui_preferences_company FOREIGN KEY (company_id) REFERENCES dbo.companies (id),
    CONSTRAINT FK_ui_preferences_user FOREIGN KEY (user_id) REFERENCES dbo.users (id),
    CONSTRAINT UQ_ui_preferences_scope UNIQUE (company_id, user_id)
  );
END;
