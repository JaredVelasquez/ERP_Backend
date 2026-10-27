CREATE TABLE table_layouts (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  user_id uuid NOT NULL REFERENCES users(id),
  table_key varchar(80) NOT NULL,
  page_size integer NOT NULL,
  columns_json text NOT NULL,
  UNIQUE (company_id, user_id, table_key)
);

CREATE TABLE dashboard_layouts (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  user_id uuid NOT NULL REFERENCES users(id),
  widgets_json text NOT NULL,
  UNIQUE (company_id, user_id)
);

CREATE TABLE ui_preferences (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  user_id uuid NOT NULL REFERENCES users(id),
  sidebar_collapsed boolean NOT NULL,
  UNIQUE (company_id, user_id)
);
