import type { CostingMethod } from '@domain/inventory/catalog/costing/costing';

export interface Tenant {
  id: string;
  name: string;
}

export interface Society {
  id: string;
  tenantId: string;
  name: string;
}

export interface Company {
  id: string;
  societyId: string;
  legalName: string;
  rtn: string;
  currencyCode: string;
  costingMethod: CostingMethod;
  defaultMarginPercent: number | null;
  taxEnabled: boolean;
  logoUrl?: string | null;
}

export interface Warehouse {
  id: string;
  companyId: string;
  name: string;
  code?: string;
  active?: boolean;
  isDefault?: boolean;
}

export class CompanyIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompanyIdentityError';
  }
}

export interface NewCompanyInput {
  id: string;
  societyId: string;
  legalName: string;
  rtn: string;
  currencyCode: string;
  costingMethod: CostingMethod;
  defaultMarginPercent: number | null;
}

export function createCompany(input: NewCompanyInput): Company {
  if (input.legalName.trim() === '') {
    throw new CompanyIdentityError('Company legal name is required');
  }
  if (input.rtn.trim() === '') {
    throw new CompanyIdentityError('Company RTN is required');
  }
  return {
    id: input.id,
    societyId: input.societyId,
    legalName: input.legalName.trim(),
    rtn: input.rtn.trim(),
    currencyCode: input.currencyCode,
    costingMethod: input.costingMethod,
    defaultMarginPercent: input.defaultMarginPercent,
    taxEnabled: false,
  };
}

export function createDefaultWarehouse(companyId: string, warehouseId: string): Warehouse {
  return { id: warehouseId, companyId, name: 'Principal', code: 'BOD-001', active: true, isDefault: true };
}
