CREATE TABLE price_changes (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id),
  unit varchar(40) NOT NULL,
  previous_price numeric(18,2),
  next_price numeric(18,2) NOT NULL,
  reason varchar(200) NOT NULL,
  actor_id uuid NOT NULL,
  changed_at timestamptz NOT NULL
);
CREATE INDEX ix_price_changes_company_product ON price_changes(company_id, product_id);
