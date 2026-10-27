CREATE TABLE journal_entries (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  document_id uuid NOT NULL REFERENCES inventory_documents(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE journal_lines (
  id uuid PRIMARY KEY,
  entry_id uuid NOT NULL REFERENCES journal_entries(id),
  account_code varchar(32) NOT NULL,
  debit numeric(18,2) NOT NULL,
  credit numeric(18,2) NOT NULL
);
