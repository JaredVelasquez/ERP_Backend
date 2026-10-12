import { CompanyIdentityError, type Company, type Society, type Tenant, type Warehouse } from '@domain/tenancy/company';
import type { CompanyPort } from '@domain/tenancy/company.port';

export class InMemoryCompanyRepository implements CompanyPort {
  private readonly tenants: Tenant[] = [];
  private readonly societies: Society[] = [];
  private readonly companies: Company[] = [];
  private readonly warehouses: Warehouse[] = [];

  async insertTenant(tenant: Tenant): Promise<void> {
    this.tenants.push({ ...tenant });
  }

  async insertSociety(society: Society): Promise<void> {
    this.societies.push({ ...society });
  }

  async insertCompanyWithWarehouse(company: Company, warehouse: Warehouse): Promise<void> {
    if (this.companies.some((row) => row.rtn === company.rtn)) {
      throw new CompanyIdentityError('Company RTN already exists');
    }
    this.companies.push({ ...company });
    this.warehouses.push({ ...warehouse });
  }

  async listCompanies(societyId: string): Promise<Company[]> {
    return this.companies.filter((company) => company.societyId === societyId).map((company) => ({ ...company }));
  }

  async findCompany(companyId: string): Promise<Company | null> {
    return this.companies.find((company) => company.id === companyId) ?? null;
  }

  async listWarehouses(companyId: string): Promise<Warehouse[]> {
    return this.warehouses.filter((warehouse) => warehouse.companyId === companyId).map((warehouse) => ({ ...warehouse }));
  }
}
