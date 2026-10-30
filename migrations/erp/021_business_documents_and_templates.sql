CREATE TABLE document_templates (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  document_type varchar(40) NOT NULL CHECK (document_type IN ('proforma', 'quotation', 'requisition', 'purchase_request', 'purchase_order', 'warehouse_transfer', 'credit_note', 'debit_note', 'withholding')),
  template_key varchar(80) NOT NULL,
  name varchar(160) NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status varchar(20) NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  page_size varchar(16) NOT NULL CHECK (page_size IN ('A4', 'LETTER')),
  orientation varchar(16) NOT NULL CHECK (orientation IN ('portrait', 'landscape')),
  margin_mm integer NOT NULL CHECK (margin_mm BETWEEN 5 AND 30),
  accent_color varchar(7) NOT NULL,
  include_logo boolean NOT NULL DEFAULT true,
  header_text varchar(500) NOT NULL DEFAULT '',
  footer_text varchar(500) NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (company_id, template_key, version)
);

CREATE INDEX idx_document_templates_company_type ON document_templates(company_id, document_type, status);

CREATE TABLE business_documents (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  document_type varchar(40) NOT NULL CHECK (document_type IN ('proforma', 'quotation', 'requisition', 'purchase_request', 'purchase_order', 'warehouse_transfer', 'credit_note', 'debit_note', 'withholding')),
  document_number varchar(80) NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('draft', 'generated', 'voided')),
  idempotency_key varchar(80) NOT NULL,
  template_id uuid NOT NULL REFERENCES document_templates(id),
  template_version integer NOT NULL,
  snapshot jsonb NOT NULL,
  snapshot_hash char(64) NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, idempotency_key),
  UNIQUE (company_id, document_number)
);

CREATE INDEX idx_business_documents_company_created ON business_documents(company_id, created_at DESC);
CREATE INDEX idx_business_documents_company_type ON business_documents(company_id, document_type, status);
