import type { MembershipRole } from '@domain/identity/access';

export const COMPANY_MODULES = [
  'dashboard',
  'products',
  'inventory',
  'prices',
  'accounting',
  'imports',
  'documents',
] as const;

export const APP_MODULES = [...COMPANY_MODULES, 'platform'] as const;

export type CompanyModule = (typeof COMPANY_MODULES)[number];

export type AppModule = (typeof APP_MODULES)[number];

export type ModuleAccess = 'view' | 'edit';

export interface ModuleGrant {
  module: AppModule;
  access: ModuleAccess;
}

export class ModulePermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModulePermissionError';
  }
}

export class PermissionDeniedError extends Error {
  constructor() {
    super('Permission denied');
    this.name = 'PermissionDeniedError';
  }
}

export function defaultGrants(role: MembershipRole): ModuleGrant[] {
  if (role === 'platform-admin') {
    return APP_MODULES.map((module) => ({ module, access: 'edit' }));
  }
  if (role === 'owner') {
    return COMPANY_MODULES.map((module) => ({ module, access: 'edit' }));
  }
  return [
    { module: 'dashboard', access: 'view' },
    { module: 'products', access: 'edit' },
    { module: 'inventory', access: 'edit' },
    { module: 'prices', access: 'view' },
    { module: 'imports', access: 'edit' },
    { module: 'documents', access: 'edit' },
  ];
}

export function resolveGrants(role: MembershipRole, requested: readonly ModuleGrant[] | null): ModuleGrant[] {
  if (requested === null) {
    return defaultGrants(role);
  }
  assertGrantList(requested);
  if (role === 'platform-admin') {
    return [...requested, { module: 'platform', access: 'edit' }];
  }
  return [...requested];
}

export function canUseModule(
  grants: readonly ModuleGrant[],
  module: AppModule,
  action: ModuleAccess,
): boolean {
  const grant = grants.find((row) => row.module === module);
  if (grant === undefined) {
    return false;
  }
  if (action === 'view') {
    return grant.access === 'view' || grant.access === 'edit';
  }
  return grant.access === 'edit';
}

export function accessForHttpMethod(method: string): ModuleAccess {
  const normalized = method.toUpperCase();
  if (normalized === 'GET' || normalized === 'HEAD') {
    return 'view';
  }
  return 'edit';
}

export function moduleForPath(pathname: string): AppModule | null {
  const path = pathname.split('?')[0] ?? '';
  if (path.startsWith('/admin')) {
    return 'platform';
  }
  if (path.startsWith('/erp/accounts')) {
    return 'accounting';
  }
  if (path.startsWith('/erp/imports')) {
    return 'imports';
  }
  if (path.startsWith('/erp/inventory-documents')) {
    return 'inventory';
  }
  if (path.startsWith('/erp/reports') || path.startsWith('/erp/layouts') || path.startsWith('/erp/preferences')) {
    return 'dashboard';
  }
  if (path.startsWith('/erp/company-users')) {
    return 'platform';
  }
  if (path.startsWith('/erp/import-history')) {
    return 'imports';
  }
  if (path.startsWith('/erp/vouchers')) {
    return 'documents';
  }
  if (path.includes('/prices') || path.includes('/margin')) {
    return 'prices';
  }
  if (path.startsWith('/erp/barcode-sheets')) {
    return 'products';
  }
  if (path.startsWith('/erp/stock-cards')) {
    return 'inventory';
  }
  if (path.startsWith('/erp/inventory-issues')) {
    return 'inventory';
  }
  if (path.startsWith('/erp/products')) {
    return 'products';
  }
  return null;
}

export function isCompanyModule(value: string): value is CompanyModule {
  return COMPANY_MODULES.some((module) => module === value);
}

function assertGrantList(requested: readonly ModuleGrant[]): void {
  const seen = new Set<string>();
  for (const grant of requested) {
    if (!isCompanyModule(grant.module)) {
      throw new ModulePermissionError('Module is invalid');
    }
    if (grant.access !== 'view' && grant.access !== 'edit') {
      throw new ModulePermissionError('Access is invalid');
    }
    if (seen.has(grant.module)) {
      throw new ModulePermissionError('Module is duplicated');
    }
    seen.add(grant.module);
  }
}
