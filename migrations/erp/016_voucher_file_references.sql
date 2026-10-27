ALTER TABLE document_submissions
  ADD COLUMN voucher_file_key text,
  ADD COLUMN bank_receipt_file_key text,
  ADD COLUMN bank_receipt_file_name varchar(180),
  ADD COLUMN bank_receipt_content_type varchar(80);
