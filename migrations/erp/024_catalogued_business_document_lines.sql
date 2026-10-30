ALTER TABLE products
  ADD COLUMN item_type varchar(20) NOT NULL DEFAULT 'product',
  ADD CONSTRAINT ck_products_item_type CHECK (item_type IN ('product', 'service'));

ALTER TABLE products ADD CONSTRAINT uq_products_company_id_id UNIQUE (company_id, id);
ALTER TABLE business_documents ADD CONSTRAINT uq_business_documents_company_id_id UNIQUE (company_id, id);

CREATE TABLE business_document_lines (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  document_id uuid NOT NULL,
  line_number integer NOT NULL CHECK (line_number > 0),
  product_id uuid,
  item_type varchar(20) NOT NULL CHECK (item_type IN ('product', 'service')),
  description_snapshot varchar(200) NOT NULL,
  presentation_unit varchar(40) NOT NULL,
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  unit_price numeric(18,4) NOT NULL CHECK (unit_price >= 0),
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  tax_category_code varchar(20) NOT NULL,
  tax_rate numeric(9,4) NOT NULL CHECK (tax_rate BETWEEN 0 AND 100),
  tax_amount numeric(18,2) NOT NULL CHECK (tax_amount >= 0),
  legacy_unlinked boolean NOT NULL DEFAULT false,
  CONSTRAINT ck_business_document_line_catalog_link CHECK ((legacy_unlinked AND product_id IS NULL) OR (NOT legacy_unlinked AND product_id IS NOT NULL)),
  CONSTRAINT fk_business_document_line_document FOREIGN KEY (company_id, document_id)
    REFERENCES business_documents(company_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_business_document_line_product FOREIGN KEY (company_id, product_id)
    REFERENCES products(company_id, id) ON DELETE RESTRICT,
  CONSTRAINT uq_business_document_line_number UNIQUE (document_id, line_number)
);

INSERT INTO business_document_lines (
  id, company_id, document_id, line_number, product_id, item_type, description_snapshot,
  presentation_unit, quantity, unit_price, amount, tax_category_code, tax_rate, tax_amount, legacy_unlinked
)
SELECT gen_random_uuid(), document.company_id, document.id, line.ordinality::integer, NULL, 'product',
       left(COALESCE(line.value->>'description', 'Detalle histórico'), 200), 'unidad',
       GREATEST(COALESCE((line.value->>'quantity')::numeric, 1), 0.0001),
       GREATEST(COALESCE((line.value->>'unitPrice')::numeric, 0), 0),
       GREATEST(COALESCE((line.value->>'amount')::numeric, 0), 0), 'none', 0, 0, true
FROM business_documents AS document
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(document.snapshot->'lines', '[]'::jsonb)) WITH ORDINALITY AS line(value, ordinality);

CREATE INDEX idx_business_document_lines_document ON business_document_lines(company_id, document_id, line_number);
CREATE INDEX idx_business_document_lines_product ON business_document_lines(company_id, product_id) WHERE product_id IS NOT NULL;
