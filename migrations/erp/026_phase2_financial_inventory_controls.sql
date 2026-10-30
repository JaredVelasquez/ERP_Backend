ALTER TABLE warehouses ADD COLUMN code varchar(20);
ALTER TABLE warehouses ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE warehouses ADD COLUMN is_default boolean NOT NULL DEFAULT false;

WITH numbered AS (
  SELECT id, company_id, row_number() OVER (PARTITION BY company_id ORDER BY created_at, id) AS position
  FROM warehouses
)
UPDATE warehouses w
SET code = 'BOD-' || lpad(numbered.position::text, 3, '0'),
    is_default = numbered.position = 1
FROM numbered
WHERE numbered.id = w.id;

ALTER TABLE warehouses ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX ux_warehouses_company_code ON warehouses(company_id, code);
CREATE UNIQUE INDEX ux_warehouses_company_default ON warehouses(company_id) WHERE is_default;

ALTER TABLE inventory_documents ADD COLUMN warehouse_id uuid;
ALTER TABLE cost_layers ADD COLUMN warehouse_id uuid;

UPDATE inventory_documents document
SET warehouse_id = warehouse.id
FROM warehouses warehouse
WHERE warehouse.company_id = document.company_id AND warehouse.is_default;

UPDATE cost_layers layer
SET warehouse_id = warehouse.id
FROM warehouses warehouse
WHERE warehouse.company_id = layer.company_id AND warehouse.is_default;

ALTER TABLE inventory_documents ALTER COLUMN warehouse_id SET NOT NULL;
ALTER TABLE cost_layers ALTER COLUMN warehouse_id SET NOT NULL;
ALTER TABLE inventory_documents ADD CONSTRAINT fk_inventory_documents_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
ALTER TABLE cost_layers ADD CONSTRAINT fk_cost_layers_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
DROP INDEX IF EXISTS ix_cost_layers_company_product;
CREATE INDEX ix_cost_layers_company_warehouse_product ON cost_layers(company_id, warehouse_id, product_id);

CREATE TABLE company_fiscal_profiles (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  environment varchar(16) NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  tax_regime varchar(24) NOT NULL DEFAULT 'not-confirmed' CHECK (tax_regime IN ('not-confirmed', 'general', 'simplified')),
  legal_name varchar(200) NOT NULL,
  rtn varchar(20) NOT NULL,
  address varchar(300) NOT NULL DEFAULT '',
  phone varchar(40) NOT NULL DEFAULT '',
  email varchar(160) NOT NULL DEFAULT '',
  emission_mode varchar(24) NOT NULL DEFAULT 'sandbox' CHECK (emission_mode IN ('sandbox', 'preprinted', 'auto-printer', 'electronic')),
  require_fiscal_document boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE fiscal_establishments (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code char(3) NOT NULL CHECK (code ~ '^[0-9]{3}$'),
  emission_point_code char(3) NOT NULL CHECK (emission_point_code ~ '^[0-9]{3}$'),
  name varchar(120) NOT NULL,
  address varchar(300) NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, code, emission_point_code)
);

ALTER TABLE fiscal_authorizations ADD COLUMN establishment_id uuid REFERENCES fiscal_establishments(id);
ALTER TABLE fiscal_authorizations ADD COLUMN document_code char(2) NOT NULL DEFAULT '01';
ALTER TABLE fiscal_authorizations ADD COLUMN replaced_by uuid REFERENCES fiscal_authorizations(id);

CREATE TABLE accounting_periods (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL CHECK (ends_on >= starts_on),
  status varchar(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closed_by uuid REFERENCES users(id),
  closed_at timestamptz,
  reopened_by uuid REFERENCES users(id),
  reopened_at timestamptz,
  reopen_reason varchar(300),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, starts_on, ends_on)
);
CREATE INDEX ix_accounting_periods_company_dates ON accounting_periods(company_id, starts_on, ends_on);

CREATE TABLE company_precision_policies (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  quantity_digits smallint NOT NULL DEFAULT 4 CHECK (quantity_digits BETWEEN 0 AND 6),
  unit_cost_digits smallint NOT NULL DEFAULT 4 CHECK (unit_cost_digits BETWEEN 2 AND 6),
  calculation_digits smallint NOT NULL DEFAULT 6 CHECK (calculation_digits BETWEEN 2 AND 8),
  report_digits smallint NOT NULL DEFAULT 2 CHECK (report_digits BETWEEN 0 AND 4),
  document_digits smallint NOT NULL DEFAULT 2 CHECK (document_digits BETWEEN 0 AND 4),
  rounding_mode varchar(16) NOT NULL DEFAULT 'half-up' CHECK (rounding_mode IN ('half-up', 'half-even')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE company_costing_policy_history (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  previous_method varchar(20) NOT NULL,
  new_method varchar(20) NOT NULL,
  changed_by uuid NOT NULL REFERENCES users(id),
  reason varchar(300) NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bank_statement_lines (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES company_bank_accounts(id) ON DELETE CASCADE,
  transaction_date date NOT NULL,
  reference varchar(120) NOT NULL,
  description varchar(300) NOT NULL DEFAULT '',
  amount numeric(18,4) NOT NULL CHECK (amount <> 0),
  status varchar(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'ignored')),
  matched_journal_entry_id uuid REFERENCES manual_journal_entries(id),
  imported_by uuid NOT NULL REFERENCES users(id),
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, bank_account_id, transaction_date, reference, amount)
);
CREATE INDEX ix_bank_statement_lines_company_status ON bank_statement_lines(company_id, status, transaction_date DESC);

INSERT INTO company_fiscal_profiles(company_id, legal_name, rtn, address)
SELECT id, legal_name, rtn, coalesce(address, '') FROM companies
ON CONFLICT (company_id) DO NOTHING;

INSERT INTO company_precision_policies(company_id)
SELECT id FROM companies
ON CONFLICT (company_id) DO NOTHING;

INSERT INTO fiscal_establishments(id, company_id, code, emission_point_code, name, address)
SELECT gen_random_uuid(), id, '001', '001', 'Principal', coalesce(address, '') FROM companies company
WHERE NOT EXISTS (SELECT 1 FROM fiscal_establishments establishment WHERE establishment.company_id = company.id);

UPDATE fiscal_authorizations auth
SET establishment_id = establishment.id
FROM fiscal_establishments establishment
WHERE establishment.company_id = auth.company_id
  AND establishment.code = '001'
  AND establishment.emission_point_code = '001'
  AND auth.establishment_id IS NULL;

ALTER TABLE fiscal_authorizations ALTER COLUMN establishment_id SET NOT NULL;
