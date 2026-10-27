ALTER TABLE companies
  ADD COLUMN default_minimum_markup_percent numeric(9,4),
  ADD COLUMN designated_price_approver_id uuid REFERENCES users(id);

ALTER TABLE presentations
  ADD COLUMN reference_unit_cost numeric(18,4),
  ADD COLUMN minimum_markup_percent numeric(9,4),
  ADD COLUMN suggested_sale_price numeric(18,2),
  ADD COLUMN management_sale_price numeric(18,2);

UPDATE presentations SET management_sale_price = sale_price;

ALTER TABLE presentations
  ADD CONSTRAINT ck_reference_unit_cost_nonnegative CHECK (reference_unit_cost IS NULL OR reference_unit_cost >= 0),
  ADD CONSTRAINT ck_minimum_markup_nonnegative CHECK (minimum_markup_percent IS NULL OR minimum_markup_percent >= 0),
  ADD CONSTRAINT ck_suggested_sale_price_nonnegative CHECK (suggested_sale_price IS NULL OR suggested_sale_price >= 0),
  ADD CONSTRAINT ck_management_sale_price_nonnegative CHECK (management_sale_price IS NULL OR management_sale_price >= 0);

CREATE TABLE commercial_price_changes (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  product_id uuid NOT NULL REFERENCES products(id),
  presentation_id uuid NOT NULL REFERENCES presentations(id),
  previous_unit_cost numeric(18,4),
  next_unit_cost numeric(18,4),
  previous_minimum_markup_percent numeric(9,4),
  next_minimum_markup_percent numeric(9,4),
  previous_suggested_sale_price numeric(18,2),
  next_suggested_sale_price numeric(18,2),
  previous_management_sale_price numeric(18,2),
  next_management_sale_price numeric(18,2),
  source varchar(40) NOT NULL,
  source_row integer,
  reason varchar(300) NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_row IS NULL OR source_row > 0)
);
CREATE INDEX ix_commercial_price_changes_company_product ON commercial_price_changes(company_id, product_id, changed_at DESC);

CREATE TABLE price_proposals (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  product_id uuid NOT NULL REFERENCES products(id),
  presentation_id uuid NOT NULL REFERENCES presentations(id),
  previous_price numeric(18,2),
  proposed_price numeric(18,2) NOT NULL CHECK (proposed_price >= 0),
  reason varchar(300) NOT NULL,
  proposed_by uuid NOT NULL REFERENCES users(id),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  proposed_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid REFERENCES users(id),
  resolved_at timestamptz,
  resolution_note varchar(300),
  CHECK ((status = 'pending' AND resolved_by IS NULL AND resolved_at IS NULL)
      OR (status <> 'pending' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
);
CREATE INDEX ix_price_proposals_company_status ON price_proposals(company_id, status, proposed_at DESC);
