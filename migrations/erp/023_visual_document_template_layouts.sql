ALTER TABLE document_templates
  ADD COLUMN IF NOT EXISTS layout_definition jsonb;
