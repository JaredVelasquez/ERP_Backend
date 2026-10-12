import { PermissionDeniedError } from '@domain/identity/module-access';
import { applyColumnLayout, applyWidgetLayout, assertCanViewTable, defaultColumns } from '@domain/workspace/layout';

describe('saved layouts', () => {
  it('ignores unknown columns and restores a missing default', () => {
    const columns = applyColumnLayout('products', [
      { key: 'barcode', visible: true, sortOrder: 0 },
      { key: 'supplier-code', visible: true, sortOrder: 1 },
      { key: 'name', visible: false, sortOrder: 2 },
    ]);

    expect(columns.map((column) => column.key)).toEqual([
      'barcode',
      'name',
      'category',
      'supplier',
      'presentation',
      'factor',
      'salePrice',
      'stock',
    ]);
    expect(columns.find((column) => column.key === 'name')?.visible).toBe(false);
    expect(columns.some((column) => column.key === 'supplier-code')).toBe(false);
    expect(applyColumnLayout('products', null)).toEqual(defaultColumns('products'));
  });

  it('drops an unknown widget and denies a table the user cannot view', () => {
    const widgets = applyWidgetLayout([
      { key: 'activity', visible: true, x: 0, y: 0, w: 1, h: 1 },
      { key: 'forecast', visible: true, x: 3, y: 9, w: 4, h: 2 },
    ]);

    expect(widgets.map((widget) => widget.key)).toEqual(['activity', 'sales', 'shrinkage', 'inventory']);
    expect(widgets.find((widget) => widget.key === 'forecast')).toBeUndefined();
    expect(() => assertCanViewTable([{ module: 'products', access: 'view' }], 'company-users')).toThrow(PermissionDeniedError);
    expect(assertCanViewTable([{ module: 'products', access: 'view' }], 'products')).toBe('products');
  });
});
