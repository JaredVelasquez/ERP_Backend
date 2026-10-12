import type { Company, Society, Tenant, Warehouse } from '@domain/tenancy/company';
import type { CompanyPort } from '@domain/tenancy/company.port';
import type { SqlExecutor } from '@infrastructure/persistence/sql-executor';

export class SqlCompanyRepository implements CompanyPort {
  constructor(private readonly sql: SqlExecutor) {}

  async insertTenant(tenant: Tenant): Promise<void> {
    await this.sql.transaction(async (session) => {
      await session.query(
        'INSERT INTO dbo.tenants (id, name) VALUES (@id, @name)',
        { id: tenant.id, name: tenant.name },
      );
    });
  }

  async insertSociety(society: Society): Promise<void> {
    await this.sql.transaction(async (session) => {
      await session.query(
        'INSERT INTO dbo.societies (id, tenant_id, name) VALUES (@id, @tenantId, @name)',
        { id: society.id, tenantId: society.tenantId, name: society.name },
      );
    });
  }

  async insertCompanyWithWarehouse(company: Company, warehouse: Warehouse): Promise<void> {
    await this.sql.transaction(async (session) => {
      await session.query(
        `INSERT INTO dbo.companies
          (id, society_id, legal_name, rtn, currency_code, costing_method, default_margin_percent, tax_enabled)
         VALUES
          (@id, @societyId, @legalName, @rtn, @currencyCode, @costingMethod, @defaultMarginPercent, @taxEnabled)`,
        {
          id: company.id,
          societyId: company.societyId,
          legalName: company.legalName,
          rtn: company.rtn,
          currencyCode: company.currencyCode,
          costingMethod: company.costingMethod,
          defaultMarginPercent: company.defaultMarginPercent,
          taxEnabled: company.taxEnabled,
        },
      );
      await session.query(
        'INSERT INTO dbo.warehouses (id, company_id, name) VALUES (@id, @companyId, @name)',
        { id: warehouse.id, companyId: warehouse.companyId, name: warehouse.name },
      );
    });
  }

  async listCompanies(societyId: string): Promise<Company[]> {
    return this.sql.transaction(async (session) =>
      session.query<Company>(
        `SELECT id, society_id AS societyId, legal_name AS legalName, rtn, currency_code AS currencyCode,
                costing_method AS costingMethod, default_margin_percent AS defaultMarginPercent,
                tax_enabled AS taxEnabled, logo_url AS logoUrl
         FROM dbo.companies WHERE society_id = @societyId`,
        { societyId },
      ),
    );
  }

  async findCompany(companyId: string): Promise<Company | null> {
    const rows = await this.sql.transaction(async (session) =>
      session.query<Company>(
        `SELECT id, society_id AS societyId, legal_name AS legalName, rtn, currency_code AS currencyCode,
                costing_method AS costingMethod, default_margin_percent AS defaultMarginPercent,
                tax_enabled AS taxEnabled, logo_url AS logoUrl
         FROM dbo.companies WHERE id = @companyId`,
        { companyId },
      ),
    );
    return rows[0] ?? null;
  }

  async listWarehouses(companyId: string): Promise<Warehouse[]> {
    return this.sql.transaction(async (session) =>
      session.query<Warehouse>(
        'SELECT id, company_id AS companyId, name FROM dbo.warehouses WHERE company_id = @companyId',
        { companyId },
      ),
    );
  }
}
