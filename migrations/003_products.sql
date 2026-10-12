IF OBJECT_ID(N'dbo.products', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.products (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_products PRIMARY KEY,
    company_id UNIQUEIDENTIFIER NOT NULL,
    name NVARCHAR(200) NOT NULL,
    category NVARCHAR(100) NOT NULL,
    base_unit NVARCHAR(40) NOT NULL,
    tracks_expiry BIT NOT NULL,
    costing_method NVARCHAR(20) NULL,
    margin_percent DECIMAL(9, 4) NULL,
    tax_category_code NVARCHAR(20) NOT NULL,
    active BIT NOT NULL,
    internal_barcode NVARCHAR(32) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_products_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_products_company FOREIGN KEY (company_id) REFERENCES dbo.companies (id),
    CONSTRAINT UQ_products_company_barcode UNIQUE (company_id, internal_barcode)
  );
END;

IF OBJECT_ID(N'dbo.presentations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.presentations (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_presentations PRIMARY KEY,
    product_id UNIQUEIDENTIFIER NOT NULL,
    unit NVARCHAR(40) NOT NULL,
    factor DECIMAL(18, 4) NOT NULL,
    purchasable BIT NOT NULL,
    sellable BIT NOT NULL,
    sale_price DECIMAL(18, 2) NULL,
    manufacturer_barcode NVARCHAR(64) NULL,
    CONSTRAINT FK_presentations_product FOREIGN KEY (product_id) REFERENCES dbo.products (id)
  );
END;
