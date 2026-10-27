ALTER TABLE companies ADD COLUMN designated_voucher_void_approver_id uuid REFERENCES users(id);

CREATE TABLE voucher_void_requests (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  voucher_id uuid NOT NULL REFERENCES document_submissions(id),
  reason varchar(500) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by uuid NOT NULL REFERENCES users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid REFERENCES users(id),
  resolved_at timestamptz,
  resolution_note varchar(500),
  CHECK ((status = 'pending' AND resolved_by IS NULL AND resolved_at IS NULL) OR (status <> 'pending' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
);
CREATE UNIQUE INDEX voucher_void_requests_one_pending ON voucher_void_requests(company_id, voucher_id) WHERE status = 'pending';
CREATE INDEX voucher_void_requests_company_status ON voucher_void_requests(company_id, status, requested_at DESC);
