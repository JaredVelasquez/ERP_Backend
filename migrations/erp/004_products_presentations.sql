CREATE TABLE products (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  name varchar(200) NOT NULL,
  category varchar(100) NOT NULL,
  base_unit varchar(40) NOT NULL,
  tracks_expiry boolean NOT NULL,
  costing_method varchar(20),
  margin_percent numeric(9,4),
  tax_category_code varchar(20) NOT NULL,
  active boolean NOT NULL,
  internal_barcode varchar(32) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  supplier varchar(100),
  UNIQUE (company_id, internal_barcode)
);

CREATE TABLE presentations (
  id uuid PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products(id),
  unit varchar(40) NOT NULL,
  factor numeric(18,4) NOT NULL,
  purchasable boolean NOT NULL,
  sellable boolean NOT NULL,
  sale_price numeric(18,2),
  manufacturer_barcode varchar(64)
);
