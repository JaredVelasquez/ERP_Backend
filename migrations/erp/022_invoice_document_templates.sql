ALTER TABLE document_templates DROP CONSTRAINT document_templates_document_type_check;
ALTER TABLE document_templates ADD CONSTRAINT document_templates_document_type_check
  CHECK (document_type IN ('invoice', 'proforma', 'quotation', 'requisition', 'purchase_request', 'purchase_order', 'warehouse_transfer', 'credit_note', 'debit_note', 'withholding'));

ALTER TABLE business_documents DROP CONSTRAINT business_documents_document_type_check;
ALTER TABLE business_documents ADD CONSTRAINT business_documents_document_type_check
  CHECK (document_type IN ('invoice', 'proforma', 'quotation', 'requisition', 'purchase_request', 'purchase_order', 'warehouse_transfer', 'credit_note', 'debit_note', 'withholding'));
