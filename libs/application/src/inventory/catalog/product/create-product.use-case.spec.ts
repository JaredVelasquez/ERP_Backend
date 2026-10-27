import { CreateProductUseCase } from '@application/inventory/catalog/product/create-product.use-case';
import { PermissionDeniedError } from '@domain/identity/membership/module-access';
import { toBaseQuantity, unitCostFromPack, type Product } from '@domain/inventory/catalog/product/product';
import type { ProductPort } from '@domain/inventory/catalog/product/product.port';
import type { Page, PageRequest } from '@domain/workspace/company-list/page';

class MemoryProducts implements ProductPort {
  private sequence = 0;
  private readonly saved = new Map<string, Product>();

  async nextSequence(): Promise<number> {
    this.sequence += 1;
    return this.sequence;
  }

  async save(product: Product): Promise<void> {
    this.saved.set(product.id, product);
  }

  async find(_companyId: string, productId: string): Promise<Product | null> {
    return this.saved.get(productId) ?? null;
  }

  async list(): Promise<Product[]> {
    return [...this.saved.values()];
  }

  async listPage(_companyId: string, request: PageRequest): Promise<Page<Product>> {
    return { items: [], page: request.page, pageSize: request.pageSize, total: 0 };
  }
}

describe('create product', () => {
  it('stores a case of 48 in base units with its own sale price and no manufacturer barcode', async () => {
    const product = await new CreateProductUseCase(new MemoryProducts(), { settings: async () => ({ designatedApproverId: null }) }).execute({
      companyId: 'company-1',
      name: 'Refresco',
      category: 'Bebidas',
      baseUnit: 'unidad',
      tracksExpiry: false,
      costingMethod: null,
      marginPercent: null,
      taxCategoryCode: 'none',
      presentations: [
        {
          unit: 'caja',
          factor: 48,
          purchasable: true,
          sellable: true,
          salePrice: 120,
          manufacturerBarcode: null,
        },
      ],
    }, { userId: 'owner-1', role: 'owner' });

    expect(toBaseQuantity(product.presentations[0]?.factor ?? 0, 1)).toBe(48);
    expect(unitCostFromPack(480, product.presentations[0]?.factor ?? 0)).toBe(10);
    expect(product.presentations[0]?.salePrice).toBe(120);
    expect(product.presentations[0]?.manufacturerBarcode).toBeNull();
    expect(product.internalBarcode).toBe('00000001');
    expect(product.marginPercent).toBeNull();
  });

  it('rejects a non-owner when creating sellable presentations without designation', async () => {
    const useCase = new CreateProductUseCase(new MemoryProducts(), { settings: async () => ({ designatedApproverId: null }) });
    await expect(useCase.execute({
      companyId: 'company-1', name: 'Water', category: 'Drinks', baseUnit: 'unit', tracksExpiry: false,
      costingMethod: null, marginPercent: null, taxCategoryCode: 'none',
      presentations: [{ unit: 'unit', factor: 1, purchasable: true, sellable: true, salePrice: 5, manufacturerBarcode: null }],
    }, { userId: 'operator-1', role: 'operator' })).rejects.toThrow(PermissionDeniedError);
  });
});
