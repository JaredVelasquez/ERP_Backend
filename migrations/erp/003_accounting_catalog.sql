CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  code varchar(32) NOT NULL,
  name varchar(200) NOT NULL,
  kind varchar(20) NOT NULL,
  postable boolean NOT NULL,
  is_collection boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
CREATE INDEX ix_accounts_company_id ON accounts(company_id);

CREATE TABLE posting_rules (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  document_type varchar(40) NOT NULL,
  debit_code varchar(32),
  credit_code varchar(32),
  debit_uses_collection boolean NOT NULL,
  credit_uses_payment boolean NOT NULL,
  UNIQUE (company_id, document_type)
);

CREATE TABLE tax_categories (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  code varchar(20) NOT NULL,
  name varchar(100) NOT NULL,
  rate_percent numeric(9,4) NOT NULL,
  is_default boolean NOT NULL,
  UNIQUE (company_id, code)
);
