import { ConfirmDocumentUseCase } from '@application/inventory/stock/document/confirm-document.use-case';
import { SetProductCostingMethodUseCase } from '@application/inventory/catalog/costing/set-product-costing-method.use-case';
import { CHART_OF_ACCOUNTS, POSTING_RULES, TAX_CATEGORIES } from '@domain/accounting/account/chart';
import { CostingMethodChangeError } from '@domain/inventory/catalog/costing/costing';
import { DocumentError } from '@domain/inventory/stock/document/document';
import type { Product } from '@domain/inventory/catalog/product/product';
import { InMemoryAccountingRepository } from '@infrastructure/accounting/account/in-memory/in-memory-accounting.repository';
import { InMemoryInventoryLedger } from '@infrastructure/inventory/ledger/in-memory/in-memory-inventory.ledger';
import { InMemoryProductRepository } from '@infrastructure/catalog/product/in-memory/in-memory-product.repository';

const occurredAt = '2026-10-29T00:00:00.000Z';

describe('set product costing method', () => {
  it('sets a per-product override and records who/when, with no stock', async () => {
    const context = await fixture();
    await context.setCostingMethod.execute({
      companyId: 'company-1', productId: 'product-1', costingMethod: 'FEFO', reason: 'Producto perecedero', actorId: 'user-1',
    });

    const product = await context.products.find('company-1', 'product-1');
    const history = await context.products.productCostingHistory('company-1', 'product-1');

    expect(product?.costingMethod).toBe('FEFO');
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ previousMethod: null, newMethod: 'FEFO', reason: 'Producto perecedero', actorId: 'user-1' });
  });

  it('returns to "use the company default" with a null costing method', async () => {
    const context = await fixture();
    await context.setCostingMethod.execute({ companyId: 'company-1', productId: 'product-1', costingMethod: 'FEFO', reason: 'r1', actorId: 'user-1' });
    await context.setCostingMethod.execute({ companyId: 'company-1', productId: 'product-1', costingMethod: null, reason: 'Ya no aplica', actorId: 'user-1' });

    const product = await context.products.find('company-1', 'product-1');
    expect(product?.costingMethod).toBeNull();
  });

  it('rejects the change when the product has on-hand stock', async () => {
    const context = await fixture();
    await context.confirm.execute(purchase('product-1', 10));

    await expect(
      context.setCostingMethod.execute({ companyId: 'company-1', productId: 'product-1', costingMethod: 'AVERAGE', reason: 'r1', actorId: 'user-1' }),
    ).rejects.toThrow(CostingMethodChangeError);
    expect((await context.products.find('company-1', 'product-1'))?.costingMethod).toBeNull();
  });

  it('does nothing and keeps no history when the method does not actually change', async () => {
    const context = await fixture();
    await context.setCostingMethod.execute({ companyId: 'company-1', productId: 'product-1', costingMethod: null, reason: 'sin cambio', actorId: 'user-1' });

    expect(await context.products.productCostingHistory('company-1', 'product-1')).toHaveLength(0);
  });

  it('rejects an empty reason and an unknown product', async () => {
    const context = await fixture();

    await expect(
      context.setCostingMethod.execute({ companyId: 'company-1', productId: 'product-1', costingMethod: 'FEFO', reason: '  ', actorId: 'user-1' }),
    ).rejects.toThrow(DocumentError);
    await expect(
      context.setCostingMethod.execute({ companyId: 'company-1', productId: 'missing', costingMethod: 'FEFO', reason: 'r1', actorId: 'user-1' }),
    ).rejects.toThrow(DocumentError);
  });
});

async function fixture() {
  const products = new InMemoryProductRepository();
  const ledger = new InMemoryInventoryLedger();
  const accounting = new InMemoryAccountingRepository();
  await accounting.saveChart('company-1', {
    accounts: CHART_OF_ACCOUNTS.map((account) => ({ ...account })),
    rules: POSTING_RULES.map((rule) => ({ ...rule })),
    taxes: TAX_CATEGORIES.map((tax) => ({ ...tax })),
  });
  await products.save(sample('product-1', '00000001'));
  const confirm = new ConfirmDocumentUseCase(ledger, products, accounting);
  const setCostingMethod = new SetProductCostingMethodUseCase(products, ledger, products);
  return { products, ledger, confirm, setCostingMethod };
}

function purchase(productId: string, quantity: number) {
  return {
    companyCostingMethod: 'PEPS' as const,
    receivedAt: occurredAt,
    draft: {
      id: `buy-${productId}`,
      companyId: 'company-1',
      warehouseId: 'warehouse-1',
      type: 'purchase' as const,
      idempotencyKey: `buy-${productId}`,
      paymentAccountCode: '1.01.01.001',
      collectionAccountCode: null,
      adjustmentDirection: null,
      transferAmount: null,
      transferFromAccountCode: null,
      transferToAccountCode: null,
      lines: [
        { productId, presentationFactor: 1, quantity, unitCost: 5, saleAmount: null, selectedLayerId: null, expiresOn: null, newLayerId: `layer-${productId}` },
      ],
    },
  };
}

function sample(id: string, internalBarcode: string): Product {
  return {
    id,
    companyId: 'company-1',
    name: 'Refresco',
    category: 'Bebidas',
    baseUnit: 'unidad',
    tracksExpiry: false,
    costingMethod: null,
    marginPercent: null,
    taxCategoryCode: 'none',
    active: true,
    internalBarcode,
    presentations: [
      { unit: 'unidad', factor: 1, purchasable: true, sellable: true, salePrice: 15, manufacturerBarcode: null },
    ],
  };
}
