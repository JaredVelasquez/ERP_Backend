import { ConfirmDocumentUseCase } from '@application/inventory/stock/document/confirm-document.use-case';
import { IssueStockUseCase } from '@application/inventory/stock/issue/issue-stock.use-case';
import { CHART_OF_ACCOUNTS, POSTING_RULES, TAX_CATEGORIES } from '@domain/accounting/account/chart';
import { InsufficientStockError } from '@domain/inventory/catalog/costing/costing';
import type { Product } from '@domain/inventory/catalog/product/product';
import { InMemoryAccountingRepository } from '@infrastructure/accounting/account/in-memory/in-memory-accounting.repository';
import { InMemoryCompanyRepository } from '@infrastructure/tenancy/company/in-memory/in-memory-company.repository';
import { InMemoryInventoryLedger } from '@infrastructure/inventory/ledger/in-memory/in-memory-inventory.ledger';
import { InMemoryProductRepository } from '@infrastructure/catalog/product/in-memory/in-memory-product.repository';
import { createCompany, createDefaultWarehouse } from '@domain/tenancy/company/company';

const receivedAt = '2026-10-04T00:00:00.000Z';

describe('issue stock', () => {
  it('confirms one line and several lines as 6.01.01.002 against 1.01.02.001', async () => {
    const context = await fixture();
    await receive(context, 'product-1', 10);
    await receive(context, 'product-2', 6);
    const one = await context.issue.execute({
      companyId: 'company-1',
      idempotencyKey: 'issue-1',
      receivedAt,
      lines: [{ productId: 'product-1', unit: 'unidad', quantity: 2 }],
    });
    const many = await context.issue.execute({
      companyId: 'company-1',
      idempotencyKey: 'issue-2',
      receivedAt,
      lines: [
        { productId: 'product-1', unit: 'unidad', quantity: 1 },
        { productId: 'product-2', unit: 'unidad', quantity: 3 },
      ],
    });
    const repeated = await context.issue.execute({
      companyId: 'company-1',
      idempotencyKey: 'issue-2',
      receivedAt,
      lines: [{ productId: 'product-1', unit: 'unidad', quantity: 1 }],
    });
    const sale = await context.confirm.execute({
      companyCostingMethod: 'PEPS',
      receivedAt,
      draft: {
        id: 'sale-1',
        companyId: 'company-1',
        type: 'sale',
        idempotencyKey: 'sale-1',
        paymentAccountCode: null,
        collectionAccountCode: '1.01.01.001',
        adjustmentDirection: null,
        transferAmount: null,
        transferFromAccountCode: null,
        transferToAccountCode: null,
        lines: [
          {
            productId: 'product-1',
            presentationFactor: 1,
            quantity: 1,
            unitCost: null,
            saleAmount: 15,
            selectedLayerId: null,
            expiresOn: null,
            newLayerId: 'sale-layer',
          },
        ],
      },
    });

    expect(one.type).toBe('adjustment');
    expect(one.journal.map((line) => line.accountCode)).toEqual(['6.01.01.002', '1.01.02.001']);
    expect(one.journal).toEqual([
      { accountCode: '6.01.01.002', debit: 10, credit: 0 },
      { accountCode: '1.01.02.001', debit: 0, credit: 10 },
    ]);
    expect(many.journal.map((line) => line.accountCode)).toEqual(['6.01.01.002', '1.01.02.001']);
    expect(repeated.id).toBe(many.id);
    expect(onHand(await context.ledger.loadStock('company-1', ['product-1']))).toBe(6);
    expect(onHand(await context.ledger.loadStock('company-1', ['product-2']))).toBe(3);
    expect(sale.journal.map((line) => line.accountCode)).toEqual(['1.01.01.001', '4.01.01.001', '5.01.01.001', '1.01.02.001']);
  });

  it('leaves stock unchanged when the quantity is greater than on hand', async () => {
    const context = await fixture();
    await receive(context, 'product-1', 2);
    const before = await context.ledger.loadStock('company-1', ['product-1']);

    await expect(
      context.issue.execute({
        companyId: 'company-1',
        idempotencyKey: 'too-many',
        receivedAt,
        lines: [{ productId: 'product-1', unit: 'unidad', quantity: 5 }],
      }),
    ).rejects.toThrow(InsufficientStockError);

    expect(await context.ledger.loadStock('company-1', ['product-1'])).toEqual(before);
    await expect(context.ledger.findByIdempotency('company-1', 'too-many')).resolves.toBeNull();
  });
});

async function fixture() {
  const products = new InMemoryProductRepository();
  const ledger = new InMemoryInventoryLedger();
  const accounting = new InMemoryAccountingRepository();
  const companies = new InMemoryCompanyRepository();
  await companies.insertCompanyWithWarehouse(
    createCompany({
      id: 'company-1',
      societyId: 'society-1',
      legalName: 'Tienda',
      rtn: '08010000000001',
      currencyCode: 'HNL',
      costingMethod: 'PEPS',
      defaultMarginPercent: null,
    }),
    createDefaultWarehouse('company-1', 'warehouse-1'),
  );
  await accounting.saveChart('company-1', {
    accounts: CHART_OF_ACCOUNTS.map((account) => ({ ...account })),
    rules: POSTING_RULES.map((rule) => ({ ...rule })),
    taxes: TAX_CATEGORIES.map((tax) => ({ ...tax })),
  });
  await products.save(sample('product-1', '00000001'));
  await products.save(sample('product-2', '00000002'));
  const confirm = new ConfirmDocumentUseCase(ledger, products, accounting);
  return { products, ledger, confirm, issue: new IssueStockUseCase(confirm, products, companies) };
}

async function receive(context: Awaited<ReturnType<typeof fixture>>, productId: string, quantity: number): Promise<void> {
  await context.confirm.execute({
    companyCostingMethod: 'PEPS',
    receivedAt,
    draft: {
      id: `buy-${productId}`,
      companyId: 'company-1',
      type: 'purchase',
      idempotencyKey: `buy-${productId}`,
      paymentAccountCode: '1.01.01.001',
      collectionAccountCode: null,
      adjustmentDirection: null,
      transferAmount: null,
      transferFromAccountCode: null,
      transferToAccountCode: null,
      lines: [
        {
          productId,
          presentationFactor: 1,
          quantity,
          unitCost: 5,
          saleAmount: null,
          selectedLayerId: null,
          expiresOn: null,
          newLayerId: `layer-${productId}`,
        },
      ],
    },
  });
}

function onHand(stock: Array<{ layers: Array<{ quantity: number }> }>): number {
  return stock[0]?.layers.reduce((sum, layer) => sum + layer.quantity, 0) ?? 0;
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
