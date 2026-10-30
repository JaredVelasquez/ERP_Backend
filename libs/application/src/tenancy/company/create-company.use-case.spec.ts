import { CreateCompanyUseCase } from '@application/tenancy/company/create-company.use-case';
import { CreateSocietyUseCase } from '@application/tenancy/company/create-society.use-case';
import { CreateTenantUseCase } from '@application/tenancy/company/create-tenant.use-case';
import { CompanyIdentityError, type Company, type Society, type Tenant, type Warehouse } from '@domain/tenancy/company/company';
import type { CompanyPort } from '@domain/tenancy/company/company.port';

class MemoryCompanyPort implements CompanyPort {
  readonly companies: Company[] = [];
  readonly warehouses: Warehouse[] = [];
  private readonly tenants: Tenant[] = [];
  private readonly societies: Society[] = [];

  async insertTenant(tenant: Tenant): Promise<void> {
    this.tenants.push(tenant);
  }

  async insertSociety(society: Society): Promise<void> {
    this.societies.push(society);
  }

  async insertCompanyWithWarehouse(company: Company, warehouse: Warehouse): Promise<void> {
    if (this.companies.some((row) => row.rtn === company.rtn)) {
      throw new CompanyIdentityError('Company RTN already exists');
    }
    this.companies.push(company);
    this.warehouses.push(warehouse);
  }

  async listCompanies(societyId: string): Promise<Company[]> {
    return this.companies.filter((company) => company.societyId === societyId);
  }

  async findCompany(companyId: string): Promise<Company | null> {
    return this.companies.find((company) => company.id === companyId) ?? null;
  }

  async listWarehouses(companyId: string): Promise<Warehouse[]> {
    return this.warehouses.filter((warehouse) => warehouse.companyId === companyId);
  }

  async createWarehouse(warehouse: Warehouse): Promise<void> {
    this.warehouses.push(warehouse);
  }
}

describe('company tenancy', () => {
  it('gives each company its own warehouse, PEPS, and no tax or margin', async () => {
    const repository = new MemoryCompanyPort();
    const tenant = await new CreateTenantUseCase(repository).execute('Michelle');
    const society = await new CreateSocietyUseCase(repository).execute({
      tenantId: tenant.id,
      name: 'Grupo Michelle',
    });
    const createCompany = new CreateCompanyUseCase(repository);
    const first = await createCompany.execute({
      societyId: society.id,
      legalName: 'Michelle Market',
      rtn: '08010000000001',
      currencyCode: 'HNL',
    });
    const second = await createCompany.execute({
      societyId: society.id,
      legalName: 'Otra tienda',
      rtn: '08010000000002',
      currencyCode: 'HNL',
      costingMethod: 'AVERAGE',
      defaultMarginPercent: 30,
    });

    expect(first.company.costingMethod).toBe('PEPS');
    expect(first.company.taxEnabled).toBe(false);
    expect(first.company.defaultMarginPercent).toBeNull();
    expect(first.warehouse.name).toBe('Principal');
    expect(second.warehouse.id).not.toBe(first.warehouse.id);
    expect(second.company.costingMethod).toBe('AVERAGE');
    expect((await repository.listWarehouses(first.company.id)).map((row) => row.id)).toEqual([
      first.warehouse.id,
    ]);
  });

  it('rejects a second company with the same RTN', async () => {
    const repository = new MemoryCompanyPort();
    const createCompany = new CreateCompanyUseCase(repository);
    await createCompany.execute({
      societyId: 'society-1',
      legalName: 'Michelle Market',
      rtn: '08010000000001',
      currencyCode: 'HNL',
    });

    await expect(
      createCompany.execute({
        societyId: 'society-1',
        legalName: 'Copia',
        rtn: '08010000000001',
        currencyCode: 'HNL',
      }),
    ).rejects.toBeInstanceOf(CompanyIdentityError);
  });
});
