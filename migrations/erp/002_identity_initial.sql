CREATE TABLE roles (
  id uuid PRIMARY KEY,
  code varchar(40) NOT NULL UNIQUE,
  name varchar(100) NOT NULL
);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email varchar(320) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  display_name varchar(200) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  company_id uuid NOT NULL REFERENCES companies(id),
  role_id uuid NOT NULL REFERENCES roles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id)
);
CREATE INDEX ix_memberships_company_id ON memberships(company_id);

CREATE TABLE module_grants (
  id uuid PRIMARY KEY,
  membership_id uuid NOT NULL REFERENCES memberships(id),
  module_name varchar(40) NOT NULL,
  access_level varchar(10) NOT NULL,
  UNIQUE (membership_id, module_name)
);
CREATE INDEX ix_module_grants_membership_id ON module_grants(membership_id);

CREATE TABLE sessions (
  token varchar(128) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  company_id uuid NOT NULL REFERENCES companies(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_sessions_user_company ON sessions(user_id, company_id);
