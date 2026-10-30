CREATE TABLE company_payment_methods (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  kind varchar(24) NOT NULL CHECK (kind IN ('cash', 'card', 'bank-transfer', 'supplier-credit')),
  collection_account_code varchar(32),
  payment_account_code varchar(32),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (collection_account_code IS NOT NULL OR payment_account_code IS NOT NULL),
  UNIQUE (company_id, name)
);
CREATE INDEX ix_company_payment_methods_company_active ON company_payment_methods(company_id, active);

CREATE TABLE company_bank_accounts (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_name varchar(120) NOT NULL,
  account_name varchar(120) NOT NULL,
  masked_number varchar(32) NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'HNL' CHECK (currency = 'HNL'),
  account_code varchar(32) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, account_code)
);
CREATE INDEX ix_company_bank_accounts_company_active ON company_bank_accounts(company_id, active);
