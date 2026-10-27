import { ApplyMarginUseCase } from '@application/inventory/catalog/pricing/apply-margin.use-case';
import { ChangePriceUseCase } from '@application/inventory/catalog/pricing/change-price.use-case';
import { PriceError, type PriceChange } from '@domain/inventory/catalog/product/price';
import type { PricePort } from '@domain/inventory/catalog/product/price.port';
import type { Product } from '@domain/inventory/catalog/product/product';
import type { ProductPort } from '@domain/inventory/catalog/product/product.port';
import type { Page, PageRequest } from '@domain/workspace/company-list/page';
import type { Company, Society, Tenant, Warehouse } from '@domain/tenancy/company/company';
import type { CompanyPort } from '@domain/tenancy/company/company.port';

class MemoryCatalog implements ProductPort, PricePort {
  changes: PriceChange[] = [];

  constructor(public product: Product | null) {}

  async nextSequence(): Promise<number> {
    return 1;
  }

  async save(product: Product): Promise<void> {
    this.product = product;
  }

  async find(): Promise<Product | null> {
    return this.product;
  }

  async list(): Promise<Product[]> {
    return this.product === null ? [] : [this.product];
  }

  async listPage(_companyId: string, request: PageRequest): Promise<Page<Product>> {
    return { items: [], page: request.page, pageSize: request.pageSize, total: 0 };
  }

  async record(product: Product, change: PriceChange): Promise<void> {
    this.product = product;
    this.changes.push(change);
  }

  async history(): Promise<PriceChange[]> {
    return this.changes;
  }

  async historyForCompany(): Promise<PriceChange[]> {
    return this.changes;
  }
}

class MemoryCompanies implements CompanyPort {
  constructor(private readonly company: Company | null) {}

  async insertTenant(_tenant: Tenant): Promise<void> {}

  async insertSociety(_society: Society): Promise<void> {}

  async insertCompanyWithWarehouse(_company: Company, _warehouse: Warehouse): Promise<void> {}

  async listCompanies(): Promise<Company[]> {
    return this.company === null ? [] : [this.company];
  }

  async listWarehouses(): Promise<Warehouse[]> {
    return [];
  }

  async findCompany(): Promise<Company | null> {
    return this.company;
  }
}

describe('apply margin', () => {
  it('does not change the shelf price when neither percent exists', async () => {
    const catalog = new MemoryCatalog(sample(null));
    const useCase = new ApplyMarginUseCase(catalog, new MemoryCompanies(company(null)), new ChangePriceUseCase(catalog, catalog));

    await expect(useCase.execute(command())).rejects.toThrow(PriceError);
    expect(catalog.product?.presentations[0]?.salePrice).toBe(15);
    expect(catalog.changes).toEqual([]);
  });

  it('applies the product percent and keeps 0.25 as 0.25 percent', async () => {
    const catalog = new MemoryCatalog(sample(0.25));
    const useCase = new ApplyMarginUseCase(catalog, new MemoryCompanies(company(25)), new ChangePriceUseCase(catalog, catalog));
    const change = await useCase.execute(command());

    expect(change.nextPrice).toBe(80.2);
    expect(change.previousPrice).toBe(15);
    expect(catalog.product?.presentations[0]?.salePrice).toBe(80.2);
  });

  it('uses the company percent when the product has none', async () => {
    const catalog = new MemoryCatalog(sample(null));
    const useCase = new ApplyMarginUseCase(catalog, new MemoryCompanies(company(25)), new ChangePriceUseCase(catalog, catalog));
    const change = await useCase.execute(command());

    expect(change.nextPrice).toBe(100);
    expect(change.reason).toBe('Aplicar margen');
  });
});

function command() {
  return {
    companyId: 'company-1',
    productId: 'product-1',
    unit: 'unidad',
    cost: 80,
    actorId: 'user-1',
    at: '2026-10-04T00:00:00.000Z',
  };
}

function sample(marginPercent: number | null): Product {
  return {
    id: 'product-1',
    companyId: 'company-1',
    name: 'Refresco',
    category: 'Bebidas',
    baseUnit: 'unidad',
    tracksExpiry: false,
    costingMethod: null,
    marginPercent,
    taxCategoryCode: 'none',
    active: true,
    internalBarcode: '00000001',
    presentations: [
      { unit: 'unidad', factor: 1, purchasable: true, sellable: true, salePrice: 15, manufacturerBarcode: null },
    ],
  };
}

function company(defaultMarginPercent: number | null): Company {
  return {
    id: 'company-1',
    societyId: 'society-1',
    legalName: 'Tienda',
    rtn: '08010000000001',
    currencyCode: 'HNL',
    costingMethod: 'PEPS',
    defaultMarginPercent,
    taxEnabled: false,
  };
}
