import { accessForHttpMethod, canUseModule, defaultGrants, moduleForPath, resolveGrants, ModulePermissionError } from '@domain/identity/module-access';

describe('module permissions', () => {
  it('gives the operator products and inventory, and withholds accounting', () => {
    const grants = defaultGrants('operator');

    expect(canUseModule(grants, 'products', 'edit')).toBe(true);
    expect(canUseModule(grants, 'inventory', 'edit')).toBe(true);
    expect(canUseModule(grants, 'accounting', 'view')).toBe(false);
    expect(canUseModule(grants, 'platform', 'view')).toBe(false);
    expect(canUseModule(grants, 'prices', 'edit')).toBe(false);
    expect(canUseModule(grants, 'prices', 'view')).toBe(true);
  });

  it('lets an edit grant read, and a view grant cannot write', () => {
    const grants = resolveGrants('operator', [{ module: 'inventory', access: 'view' }]);

    expect(canUseModule(grants, 'inventory', 'view')).toBe(true);
    expect(canUseModule(grants, 'inventory', 'edit')).toBe(false);
    expect(canUseModule(grants, 'products', 'view')).toBe(false);
  });

  it('keeps platform on the platform admin even when the list omits it', () => {
    const grants = resolveGrants('platform-admin', [{ module: 'dashboard', access: 'view' }]);

    expect(canUseModule(grants, 'platform', 'edit')).toBe(true);
    expect(canUseModule(grants, 'accounting', 'view')).toBe(false);
  });

  it('rejects a company role that tries to take platform', () => {
    expect(() => resolveGrants('owner', [{ module: 'platform', access: 'edit' }])).toThrow(ModulePermissionError);
  });

  it('rejects a duplicated module', () => {
    expect(() =>
      resolveGrants('operator', [
        { module: 'inventory', access: 'view' },
        { module: 'inventory', access: 'edit' },
      ]),
    ).toThrow(ModulePermissionError);
  });

  it('maps store routes to modules', () => {
    expect(moduleForPath('/admin/companies')).toBe('platform');
    expect(moduleForPath('/erp/accounts')).toBe('accounting');
    expect(moduleForPath('/erp/products/abc/prices')).toBe('prices');
    expect(moduleForPath('/erp/products')).toBe('products');
    expect(moduleForPath('/erp/barcode-sheets')).toBe('products');
    expect(moduleForPath('/erp/stock-cards')).toBe('inventory');
    expect(moduleForPath('/erp/inventory-issues')).toBe('inventory');
    expect(moduleForPath('/erp/products/search')).toBe('products');
    expect(moduleForPath('/erp/imports/catalog')).toBe('imports');
  });

  it('treats GET as view and POST as edit', () => {
    expect(accessForHttpMethod('get')).toBe('view');
    expect(accessForHttpMethod('POST')).toBe('edit');
  });
});
