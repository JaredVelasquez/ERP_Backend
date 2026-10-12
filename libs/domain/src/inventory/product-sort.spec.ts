import { readProductSort, sortProducts } from '@domain/inventory/product-sort';
import type { Product } from '@domain/inventory/product';

describe('product sort', () => {
  it('keeps name ascending when the query is empty or unknown', () => {
    expect(readProductSort('')).toEqual({ column: 'name', direction: 'asc' });
    expect(readProductSort('drop table:sideways')).toEqual({ column: 'name', direction: 'asc' });
    expect(readProductSort(' supplier:desc ')).toEqual({ column: 'supplier', direction: 'desc' });
  });

  it('orders every product, not a single page', () => {
    const products = [sample('3', 'Coco', 'Zeta'), sample('1', 'Arroz', 'Mango'), sample('2', 'Banana', 'Alfa')];
    const byName = sortProducts(products, readProductSort('name:asc')).map((product) => product.name);
    const bySupplier = sortProducts(products, readProductSort('supplier:desc')).map((product) => product.supplier);

    expect(byName).toEqual(['Arroz', 'Banana', 'Coco']);
    expect(bySupplier).toEqual(['Zeta', 'Mango', 'Alfa']);
  });
});

function sample(id: string, name: string, supplier: string): Product {
  return {
    id,
    companyId: 'company-1',
    name,
    category: 'Abarrotes',
    supplier,
    baseUnit: 'unidad',
    tracksExpiry: false,
    costingMethod: null,
    marginPercent: null,
    taxCategoryCode: 'none',
    active: true,
    internalBarcode: id,
    presentations: [
      { unit: 'unidad', factor: 1, purchasable: true, sellable: true, salePrice: 10, manufacturerBarcode: null },
    ],
  };
}
