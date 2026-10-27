CREATE TABLE tenants (
  id uuid PRIMARY KEY,
  name varchar(200) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE societies (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name varchar(200) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_societies_tenant_id ON societies(tenant_id);

CREATE TABLE companies (
  id uuid PRIMARY KEY,
  society_id uuid NOT NULL REFERENCES societies(id),
  legal_name varchar(200) NOT NULL,
  rtn varchar(20) NOT NULL UNIQUE,
  currency_code varchar(3) NOT NULL,
  costing_method varchar(20) NOT NULL,
  default_margin_percent numeric(9,4),
  tax_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  address varchar(300),
  logo_url varchar(500)
);
CREATE INDEX ix_companies_society_id ON companies(society_id);

CREATE TABLE warehouses (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  name varchar(200) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
