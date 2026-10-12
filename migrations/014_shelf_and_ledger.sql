IF COL_LENGTH(N'dbo.products', N'supplier') IS NULL
BEGIN
  ALTER TABLE dbo.products ADD supplier NVARCHAR(100) NULL;
END;

IF COL_LENGTH(N'dbo.companies', N'logo_url') IS NULL
BEGIN
  ALTER TABLE dbo.companies ADD logo_url NVARCHAR(500) NULL;
END;

IF COL_LENGTH(N'dbo.inventory_documents', N'reversal_id') IS NULL
BEGIN
  ALTER TABLE dbo.inventory_documents ADD reversal_id UNIQUEIDENTIFIER NULL;
END;

IF COL_LENGTH(N'dbo.inventory_documents', N'occurred_at') IS NULL
BEGIN
  ALTER TABLE dbo.inventory_documents ADD occurred_at DATETIME2 NULL;
END;

IF OBJECT_ID(N'dbo.inventory_document_lines', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.inventory_document_lines (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_inventory_document_lines PRIMARY KEY,
    document_id UNIQUEIDENTIFIER NOT NULL,
    product_id UNIQUEIDENTIFIER NOT NULL,
    direction NVARCHAR(8) NOT NULL,
    quantity DECIMAL(18, 4) NOT NULL,
    cost DECIMAL(18, 2) NOT NULL,
    revenue DECIMAL(18, 2) NOT NULL,
    CONSTRAINT FK_inventory_document_lines_document FOREIGN KEY (document_id) REFERENCES dbo.inventory_documents (id),
    CONSTRAINT FK_inventory_document_lines_product FOREIGN KEY (product_id) REFERENCES dbo.products (id)
  );
END;

IF OBJECT_ID(N'dbo.inventory_layer_effects', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.inventory_layer_effects (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_inventory_layer_effects PRIMARY KEY,
    document_id UNIQUEIDENTIFIER NOT NULL,
    product_id UNIQUEIDENTIFIER NOT NULL,
    layer_id UNIQUEIDENTIFIER NOT NULL,
    quantity_delta DECIMAL(18, 4) NOT NULL,
    unit_cost DECIMAL(18, 4) NOT NULL,
    received_at DATETIME2 NOT NULL,
    expires_on DATE NULL,
    CONSTRAINT FK_inventory_layer_effects_document FOREIGN KEY (document_id) REFERENCES dbo.inventory_documents (id)
  );
END;
