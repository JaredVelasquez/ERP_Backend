import type { Company, Society, Tenant, Warehouse } from '@domain/tenancy/company/company';
import type { CompanyPort } from '@domain/tenancy/company/company.port';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';
import type { CompanyQueryRow } from '@infrastructure/tenancy/company/postgres/company.queries';
import {
  insertCompany,
  insertSociety,
  insertTenant,
  insertWarehouse,
  selectCompanies,
  selectCompany,
  selectWarehouses,
} from '@infrastructure/tenancy/company/postgres/company.queries';

export class PostgresCompanyRepository implements CompanyPort {
  constructor(private readonly orm: TypeOrmExecutor) {}

  async insertTenant(tenant: Tenant): Promise<void> {
    await this.orm.transaction(() => this.orm.withManager((manager) => insertTenant(manager, tenant)));
  }

  async insertSociety(society: Society): Promise<void> {
    await this.orm.transaction(() => this.orm.withManager((manager) => insertSociety(manager, society)));
  }

  async insertCompanyWithWarehouse(company: Company, warehouse: Warehouse): Promise<void> {
    await this.orm.transaction(async () => {
      await this.orm.withManager((manager) => insertCompany(manager, company));
      await this.orm.withManager((manager) => insertWarehouse(manager, warehouse));
    });
  }

  async listCompanies(societyId: string): Promise<Company[]> {
    const rows = await this.orm.withManager((manager) => selectCompanies(manager, societyId));
    return rows.map(mapCompany);
  }

  async findCompany(companyId: string): Promise<Company | null> {
    const row = await this.orm.withManager((manager) => selectCompany(manager, companyId));
    if (row === null) return null;
    return mapCompany(row);
  }

  listWarehouses(companyId: string): Promise<Warehouse[]> {
    return this.orm.withManager((manager) => selectWarehouses(manager, companyId));
  }
}

function mapCompany(row: CompanyQueryRow): Company {
  return {
    id: row.id,
    societyId: row.societyId,
    legalName: row.legalName,
    rtn: row.rtn,
    currencyCode: row.currencyCode,
    costingMethod: row.costingMethod,
    defaultMarginPercent: row.defaultMarginPercent === null ? null : Number(row.defaultMarginPercent),
    taxEnabled: row.taxEnabled,
    logoUrl: row.logoUrl,
  };
}
