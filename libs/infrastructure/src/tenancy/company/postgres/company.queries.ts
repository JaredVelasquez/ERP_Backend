import type { Company, Society, Tenant, Warehouse } from '@domain/tenancy/company/company';
import type { EntityManager } from 'typeorm';
import { CompanyEntity, SocietyEntity, TenantEntity, WarehouseEntity } from '@infrastructure/tenancy/company/postgres/entities/tenancy.entity';

export interface CompanyQueryRow {
  id: string;
  societyId: string;
  legalName: string;
  rtn: string;
  currencyCode: string;
  costingMethod: Company['costingMethod'];
  defaultMarginPercent: string | number | null;
  taxEnabled: boolean;
  logoUrl: string | null;
}

export async function insertTenant(manager: EntityManager, tenant: Tenant): Promise<void> {
  await manager.createQueryBuilder().insert().into(TenantEntity).values(tenant).execute();
}

export async function insertSociety(manager: EntityManager, society: Society): Promise<void> {
  await manager.createQueryBuilder().insert().into(SocietyEntity).values(society).execute();
}

export async function insertCompany(manager: EntityManager, company: Company): Promise<void> {
  await manager.createQueryBuilder().insert().into(CompanyEntity).values({
    id: company.id,
    societyId: company.societyId,
    legalName: company.legalName,
    rtn: company.rtn,
    currencyCode: company.currencyCode,
    costingMethod: company.costingMethod,
    defaultMarginPercent: company.defaultMarginPercent,
    taxEnabled: company.taxEnabled,
    logoUrl: company.logoUrl ?? null,
  }).execute();
}

export async function insertWarehouse(manager: EntityManager, warehouse: Warehouse): Promise<void> {
  await manager.createQueryBuilder().insert().into(WarehouseEntity).values({ ...warehouse, code: warehouse.code ?? 'BOD-001', active: warehouse.active ?? true, isDefault: warehouse.isDefault ?? true }).execute();
}

export function selectCompanies(manager: EntityManager, societyId: string): Promise<CompanyQueryRow[]> {
  return manager.createQueryBuilder(CompanyEntity, 'company')
    .select('company.id', 'id')
    .addSelect('company.societyId', 'societyId')
    .addSelect('company.legalName', 'legalName')
    .addSelect('company.rtn', 'rtn')
    .addSelect('company.currencyCode', 'currencyCode')
    .addSelect('company.costingMethod', 'costingMethod')
    .addSelect('company.defaultMarginPercent', 'defaultMarginPercent')
    .addSelect('company.taxEnabled', 'taxEnabled')
    .addSelect('company.logoUrl', 'logoUrl')
    .where('company.societyId = :societyId', { societyId })
    .orderBy('company.legalName', 'ASC')
    .getRawMany<CompanyQueryRow>();
}

export async function selectCompany(manager: EntityManager, companyId: string): Promise<CompanyQueryRow | null> {
  const row = await manager.createQueryBuilder(CompanyEntity, 'company')
    .select('company.id', 'id')
    .addSelect('company.societyId', 'societyId')
    .addSelect('company.legalName', 'legalName')
    .addSelect('company.rtn', 'rtn')
    .addSelect('company.currencyCode', 'currencyCode')
    .addSelect('company.costingMethod', 'costingMethod')
    .addSelect('company.defaultMarginPercent', 'defaultMarginPercent')
    .addSelect('company.taxEnabled', 'taxEnabled')
    .addSelect('company.logoUrl', 'logoUrl')
    .where('company.id = :companyId', { companyId })
    .getRawOne<CompanyQueryRow>();
  return row ?? null;
}

export function selectWarehouses(manager: EntityManager, companyId: string): Promise<Warehouse[]> {
  return manager.createQueryBuilder(WarehouseEntity, 'warehouse')
    .select('warehouse.id', 'id')
    .addSelect('warehouse.companyId', 'companyId')
    .addSelect('warehouse.name', 'name')
    .addSelect('warehouse.code', 'code')
    .addSelect('warehouse.active', 'active')
    .addSelect('warehouse.isDefault', 'isDefault')
    .where('warehouse.companyId = :companyId', { companyId })
    .orderBy('warehouse.name', 'ASC')
    .getRawMany<Warehouse>();
}
