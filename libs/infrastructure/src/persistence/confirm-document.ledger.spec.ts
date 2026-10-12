import { ConfirmDocumentUseCase } from '@application/inventory/confirm-document.use-case';
import { VoidDocumentUseCase } from '@application/inventory/void-document.use-case';
import { CHART_OF_ACCOUNTS, POSTING_RULES, TAX_CATEGORIES } from '@domain/accounting/chart';
import { InsufficientStockError } from '@domain/inventory/costing';
import type { DraftDocument } from '@domain/inventory/document';
import type { Product } from '@domain/inventory/product';
import { InMemoryAccountingRepository } from '@infrastructure/persistence/in-memory-accounting.repository';
import { InMemoryInventoryLedger } from '@infrastructure/persistence/in-memory-inventory.ledger';
import { InMemoryProductRepository } from '@infrastructure/persistence/in-memory-product.repository';

const receivedAt = '2026-10-04T00:00:00.000Z';

describe('confirm inventory document', () => {
  it('does not move the shelf price when a receipt is confirmed', async () => {
    const context = await fixture();
    await context.confirm.execute(command('purchase', 'key-1', 'doc-1', [receiptLine()]));
    const product = await context.products.find('company-1', 'product-1');

    expect(product?.presentations[0]?.salePrice).toBe(15);
    expect(await context.products.history('company-1', 'product-1')).toEqual([]);
  });

  it('does not duplicate quantity or journal lines when confirm is repeated', async () => {
    const context = await fixture();
    const first = await context.confirm.execute(command('purchase', 'key-1', 'doc-1', [receiptLine()]));
    const second = await context.confirm.execute(command('purchase', 'key-1', 'doc-2', [receiptLine()]));
    const stock = await context.ledger.loadStock('company-1', ['product-1']);

    expect(second.id).toBe(first.id);
    expect(stock[0]?.layers.reduce((sum, layer) => sum + layer.quantity, 0)).toBe(10);
    expect(first.journal.reduce((sum, line) => sum + line.debit, 0)).toBe(
      first.journal.reduce((sum, line) => sum + line.credit, 0),
    );
  });

  it('writes nothing when a sale has no stock', async () => {
    const context = await fixture();
    const before = await context.ledger.loadStock('company-1', ['product-1']);

    await expect(
      context.confirm.execute(command('sale', 'sale-1', 'doc-sale', [{ ...issueLine(), saleAmount: 30 }], '1.01.01.001')),
    ).rejects.toThrow(InsufficientStockError);
    await expect(context.ledger.findByIdempotency('company-1', 'sale-1')).resolves.toBeNull();
    expect(await context.ledger.loadStock('company-1', ['product-1'])).toEqual(before);
  });

  it('restores stock once when the purchase is voided twice', async () => {
    const context = await fixture();
    const confirmed = await context.confirm.execute(command('purchase', 'key-1', 'doc-1', [receiptLine()]));
    const reversal = await context.voidDocument.execute('company-1', confirmed.id);
    await context.voidDocument.execute('company-1', confirmed.id);
    const stock = await context.ledger.loadStock('company-1', ['product-1']);

    expect(reversal.journal.reduce((sum, line) => sum + line.debit, 0)).toBe(50);
    expect(stock[0]?.layers).toEqual([]);
  });

  it('keeps the previous stock when the journal is not balanced', async () => {
    const context = await fixture();
    await context.confirm.execute(command('purchase', 'key-1', 'doc-1', [receiptLine()]));
    const before = await context.ledger.loadStock('company-1', ['product-1']);

    await expect(
      context.ledger.commit({
        document: {
          id: 'bad',
          companyId: 'company-1',
          type: 'purchase',
          status: 'confirmed',
          idempotencyKey: 'bad',
          occurredAt: receivedAt,
          journal: [{ accountCode: '1.01.02.001', debit: 10, credit: 0 }],
          effects: [],
          movements: [],
          reversalId: null,
          reversalOf: null,
        },
        voidedDocumentId: null,
        stock: [{ companyId: 'company-1', productId: 'product-1', layers: [] }],
      }),
    ).rejects.toThrow('Journal is not balanced');
    expect(await context.ledger.loadStock('company-1', ['product-1'])).toEqual(before);
    await expect(context.ledger.find('company-1', 'bad')).resolves.toBeNull();
  });
});

async function fixture() {
  const accounting = new InMemoryAccountingRepository();
  const products = new InMemoryProductRepository();
  const ledger = new InMemoryInventoryLedger();
  await accounting.saveChart('company-1', {
    accounts: CHART_OF_ACCOUNTS.map((account) => ({ ...account })),
    rules: POSTING_RULES.map((rule) => ({ ...rule })),
    taxes: TAX_CATEGORIES.map((tax) => ({ ...tax })),
  });
  await products.save(product());
  return {
    ledger,
    products,
    confirm: new ConfirmDocumentUseCase(ledger, products, accounting),
    voidDocument: new VoidDocumentUseCase(ledger),
  };
}

function command(
  type: DraftDocument['type'],
  idempotencyKey: string,
  id: string,
  lines: DraftDocument['lines'],
  collectionAccountCode: string | null = null,
): Parameters<ConfirmDocumentUseCase['execute']>[0] {
  return {
    companyCostingMethod: 'PEPS',
    receivedAt,
    draft: {
      id,
      companyId: 'company-1',
      type,
      idempotencyKey,
      paymentAccountCode: null,
      collectionAccountCode,
      adjustmentDirection: null,
      transferAmount: null,
      transferFromAccountCode: null,
      transferToAccountCode: null,
      lines,
    },
  };
}

function product(): Product {
  return {
    id: 'product-1',
    companyId: 'company-1',
    name: 'Refresco',
    category: 'Bebidas',
    baseUnit: 'unidad',
    tracksExpiry: false,
    costingMethod: null,
    marginPercent: null,
    taxCategoryCode: 'none',
    active: true,
    internalBarcode: '00000001',
    presentations: [
      { unit: 'unidad', factor: 1, purchasable: true, sellable: true, salePrice: 15, manufacturerBarcode: null },
    ],
  };
}

function receiptLine() {
  return {
    productId: 'product-1',
    presentationFactor: 1,
    quantity: 10,
    unitCost: 5,
    saleAmount: null,
    selectedLayerId: null,
    expiresOn: null,
    newLayerId: 'layer-1',
  };
}

function issueLine() {
  return {
    productId: 'product-1',
    presentationFactor: 1,
    quantity: 2,
    unitCost: null,
    saleAmount: null,
    selectedLayerId: null,
    expiresOn: null,
    newLayerId: 'unused',
  };
}
