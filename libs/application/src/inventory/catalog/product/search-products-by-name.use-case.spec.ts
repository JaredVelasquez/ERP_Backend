import { SearchProductsByNameUseCase } from '@application/inventory/catalog/product/search-products-by-name.use-case';
import type { Product } from '@domain/inventory/catalog/product/product';
import type { ProductPort } from '@domain/inventory/catalog/product/product.port';
import type { Page, PageRequest } from '@domain/workspace/company-list/page';

describe('search products by name', () => {
  it('matches a trimmed fragment inside the company and does not save', async () => {
    const products = new MemoryProducts();
    await products.save(sample('sku-1', 'company-1', 'Refresco cola', true));
    await products.save(sample('sku-2', 'company-1', 'Arroz', false));
    await products.save(sample('sku-3', 'company-2', 'Refresco uva', true));
    products.saves = 0;
    const hits = await new SearchProductsByNameUseCase(products).execute('company-1', '  reFRESCO ');

    expect(hits.map((hit) => hit.id)).toEqual(['sku-1']);
    expect(hits[0]?.internalBarcode).toBe('00000001');
    expect(hits[0]?.presentations[0]?.salePrice).toBe(15);
    expect(products.saves).toBe(0);
  });

  it('rejects an empty search', async () => {
    const products = new MemoryProducts();
    await expect(new SearchProductsByNameUseCase(products).execute('company-1', '   ')).rejects.toThrow('Search text is required');
    expect(products.saves).toBe(0);
  });
});

class MemoryProducts implements ProductPort {
  saves = 0;
  private readonly rows: Product[] = [];

  async nextSequence(): Promise<number> {
    return this.rows.length + 1;
  }

  async save(product: Product): Promise<void> {
    this.saves += 1;
    this.rows.push(product);
  }

  async find(companyId: string, productId: string): Promise<Product | null> {
    return this.rows.find((product) => product.companyId === companyId && product.id === productId) ?? null;
  }

  async list(companyId: string): Promise<Product[]> {
    return this.rows.filter((product) => product.companyId === companyId);
  }

  async listPage(_companyId: string, request: PageRequest): Promise<Page<Product>> {
    return { items: [], page: request.page, pageSize: request.pageSize, total: 0 };
  }
}

function sample(id: string, companyId: string, name: string, active: boolean): Product {
  return {
    id,
    companyId,
    name,
    category: 'Bebidas',
    baseUnit: 'unidad',
    tracksExpiry: false,
    costingMethod: null,
    marginPercent: null,
    taxCategoryCode: 'none',
    active,
    internalBarcode: '00000001',
    presentations: [
      { unit: 'unidad', factor: 1, purchasable: true, sellable: true, salePrice: 15, manufacturerBarcode: null },
    ],
  };
}
