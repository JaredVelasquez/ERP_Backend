import type { Company, Society, Tenant, Warehouse } from '@domain/tenancy/company';

export interface CompanyPort {
  insertTenant(tenant: Tenant): Promise<void>;
  insertSociety(society: Society): Promise<void>;
  insertCompanyWithWarehouse(company: Company, warehouse: Warehouse): Promise<void>;
  listCompanies(societyId: string): Promise<Company[]>;
  listWarehouses(companyId: string): Promise<Warehouse[]>;
  findCompany(companyId: string): Promise<Company | null>;
}

export const COMPANY_PORT = Symbol('COMPANY_PORT');
