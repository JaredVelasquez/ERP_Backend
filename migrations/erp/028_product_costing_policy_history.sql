CREATE TABLE product_costing_policy_history (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  previous_method varchar(20),
  new_method varchar(20),
  changed_by uuid NOT NULL REFERENCES users(id),
  reason varchar(300) NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_product_costing_policy_history_product ON product_costing_policy_history(company_id, product_id);
