CREATE TABLE fiscal_authorizations (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  document_type varchar(40) NOT NULL,
  authorization_code varchar(80) NOT NULL,
  range_start integer NOT NULL CHECK (range_start > 0),
  range_end integer NOT NULL CHECK (range_end >= range_start),
  next_number integer NOT NULL CHECK (next_number >= range_start),
  valid_from date NOT NULL,
  valid_until date NOT NULL CHECK (valid_until >= valid_from),
  status varchar(20) NOT NULL CHECK (status IN ('sandbox', 'active', 'replaced', 'expired', 'exhausted')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL,
  UNIQUE (company_id, document_type, authorization_code)
);

CREATE INDEX idx_fiscal_authorizations_history
  ON fiscal_authorizations(company_id, document_type, created_at DESC);

CREATE TABLE fiscal_documents (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  source_sale_document_id uuid NOT NULL REFERENCES inventory_documents(id),
  authorization_id uuid NOT NULL REFERENCES fiscal_authorizations(id),
  idempotency_key varchar(80) NOT NULL,
  document_number varchar(80) NOT NULL,
  authorization_number integer NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('issued', 'voided')),
  subtotal numeric(18, 2) NOT NULL CHECK (subtotal >= 0),
  tax_rate numeric(9, 4) NOT NULL CHECK (tax_rate >= 0 AND tax_rate <= 100),
  tax_total numeric(18, 2) NOT NULL CHECK (tax_total >= 0),
  total numeric(18, 2) NOT NULL CHECK (total >= 0),
  snapshot jsonb NOT NULL,
  snapshot_hash char(64) NOT NULL,
  issued_at timestamptz NOT NULL,
  UNIQUE (company_id, idempotency_key),
  UNIQUE (company_id, source_sale_document_id),
  UNIQUE (company_id, document_number),
  UNIQUE (authorization_id, authorization_number)
);

CREATE INDEX idx_fiscal_documents_company_issued
  ON fiscal_documents(company_id, issued_at DESC);
