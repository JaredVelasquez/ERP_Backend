CREATE TABLE IF NOT EXISTS catalog_import_batches (
  company_id uuid NOT NULL REFERENCES companies(id),
  idempotency_key varchar(80) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, idempotency_key)
);
