CREATE TABLE document_submissions (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  service_type varchar(40) NOT NULL,
  amount numeric(18,2) NOT NULL,
  currency_code varchar(3) NOT NULL,
  reference varchar(80) NOT NULL,
  holder varchar(200) NOT NULL,
  institution varchar(200) NOT NULL,
  dni varchar(40) NOT NULL,
  phone varchar(40) NOT NULL,
  occurred_on date NOT NULL,
  accepted_declaration boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  bank_reference varchar(80) NOT NULL DEFAULT '',
  money_movement_id uuid REFERENCES inventory_documents(id),
  status varchar(20) NOT NULL DEFAULT 'draft',
  service_note varchar(120) NOT NULL DEFAULT ''
);

CREATE TABLE document_signatures (
  id uuid PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES document_submissions(id),
  image_data text NOT NULL,
  UNIQUE (submission_id)
);
