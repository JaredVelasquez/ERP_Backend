IF OBJECT_ID(N'dbo.price_changes', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.price_changes (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_price_changes PRIMARY KEY,
    company_id UNIQUEIDENTIFIER NOT NULL,
    product_id UNIQUEIDENTIFIER NOT NULL,
    unit NVARCHAR(40) NOT NULL,
    previous_price DECIMAL(18, 2) NULL,
    next_price DECIMAL(18, 2) NOT NULL,
    reason NVARCHAR(200) NOT NULL,
    actor_id UNIQUEIDENTIFIER NOT NULL,
    changed_at DATETIME2 NOT NULL,
    CONSTRAINT FK_price_changes_product FOREIGN KEY (product_id) REFERENCES dbo.products (id)
  );
  CREATE INDEX IX_price_changes_company_product ON dbo.price_changes (company_id, product_id);
END;
