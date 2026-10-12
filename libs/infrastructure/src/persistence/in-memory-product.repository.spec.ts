import type { Product } from '@domain/inventory/product';
import { InMemoryProductRepository } from '@infrastructure/persistence/in-memory-product.repository';

describe('in-memory product page', () => {
  it('sorts the company catalog before the page offset', async () => {
    const products = new InMemoryProductRepository();
    await products.save(sample('3', 'Coco', 'Zeta'));
    await products.save(sample('1', 'Arroz', 'Mango'));
    await products.save(sample('2', 'Banana', 'Alfa'));

    const second = await products.listPage('company-1', { page: 2, pageSize: 1, search: '', sort: 'name:asc' });
    const firstDesc = await products.listPage('company-1', { page: 1, pageSize: 1, search: '', sort: 'name:desc' });
    const bySupplier = await products.listPage('company-1', { page: 1, pageSize: 1, search: '', sort: 'supplier:asc' });

    expect(second.total).toBe(3);
    expect(second.items.map((product) => product.name)).toEqual(['Banana']);
    expect(firstDesc.items.map((product) => product.name)).toEqual(['Coco']);
    expect(bySupplier.items.map((product) => product.supplier)).toEqual(['Alfa']);
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
