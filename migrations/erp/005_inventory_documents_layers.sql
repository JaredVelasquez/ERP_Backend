CREATE TABLE inventory_documents (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  document_type varchar(40) NOT NULL,
  status varchar(20) NOT NULL,
  idempotency_key varchar(80) NOT NULL,
  reversal_of uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  reversal_id uuid,
  occurred_at timestamptz,
  UNIQUE (company_id, idempotency_key)
);

CREATE TABLE cost_layers (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  product_id uuid NOT NULL,
  received_at timestamptz NOT NULL,
  expires_on date,
  quantity numeric(18,4) NOT NULL,
  unit_cost numeric(18,4) NOT NULL
);
CREATE INDEX ix_cost_layers_company_product ON cost_layers(company_id, product_id);

CREATE TABLE inventory_document_lines (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES inventory_documents(id),
  product_id uuid NOT NULL REFERENCES products(id),
  direction varchar(8) NOT NULL,
  quantity numeric(18,4) NOT NULL,
  cost numeric(18,2) NOT NULL,
  revenue numeric(18,2) NOT NULL
);

CREATE TABLE inventory_layer_effects (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES inventory_documents(id),
  product_id uuid NOT NULL,
  layer_id uuid NOT NULL,
  quantity_delta numeric(18,4) NOT NULL,
  unit_cost numeric(18,4) NOT NULL,
  received_at timestamptz NOT NULL,
  expires_on date
);
