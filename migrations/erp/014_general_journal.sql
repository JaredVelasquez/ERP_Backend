CREATE TABLE IF NOT EXISTS manual_journal_entries (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  occurred_at timestamptz NOT NULL,
  description varchar(250) NOT NULL,
  idempotency_key varchar(80) NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('confirmed', 'voided')),
  created_by uuid NOT NULL REFERENCES users(id),
  reversal_of uuid REFERENCES manual_journal_entries(id),
  reversal_id uuid REFERENCES manual_journal_entries(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS ix_manual_journal_entries_company_date
  ON manual_journal_entries(company_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS manual_journal_entry_lines (
  id uuid PRIMARY KEY,
  entry_id uuid NOT NULL REFERENCES manual_journal_entries(id),
  account_code varchar(32) NOT NULL,
  debit numeric(18,2) NOT NULL CHECK (debit >= 0),
  credit numeric(18,2) NOT NULL CHECK (credit >= 0),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
CREATE INDEX IF NOT EXISTS ix_manual_journal_entry_lines_entry
  ON manual_journal_entry_lines(entry_id);
