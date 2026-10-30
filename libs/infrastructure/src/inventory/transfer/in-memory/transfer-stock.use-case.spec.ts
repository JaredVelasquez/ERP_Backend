import { ConfirmDocumentUseCase } from '@application/inventory/stock/document/confirm-document.use-case';
import { TransferStockUseCase } from '@application/inventory/stock/transfer/transfer-stock.use-case';
import { CHART_OF_ACCOUNTS, POSTING_RULES, TAX_CATEGORIES } from '@domain/accounting/account/chart';
import { DocumentError } from '@domain/inventory/stock/document/document';
import { InsufficientStockError } from '@domain/inventory/catalog/costing/costing';
import type { Product } from '@domain/inventory/catalog/product/product';
import { InMemoryAccountingRepository } from '@infrastructure/accounting/account/in-memory/in-memory-accounting.repository';
import { InMemoryCompanyRepository } from '@infrastructure/tenancy/company/in-memory/in-memory-company.repository';
import { InMemoryInventoryLedger } from '@infrastructure/inventory/ledger/in-memory/in-memory-inventory.ledger';
import { InMemoryProductRepository } from '@infrastructure/catalog/product/in-memory/in-memory-product.repository';
import { createCompany, createDefaultWarehouse } from '@domain/tenancy/company/company';

const occurredAt = '2026-10-29T00:00:00.000Z';

describe('transfer stock', () => {
  it('moves PEPS layers between two warehouses and posts a balanced entry per cost center', async () => {
    const context = await fixture();
    await receive(context, 10, 5);
    await receive(context, 10, 8);

    const transfer = await context.transfer.execute({
      companyId: 'company-1',
      idempotencyKey: 'transfer-1',
      occurredAt,
      productId: 'product-1',
      unit: 'unidad',
      quantity: 12,
      originWarehouseId: 'warehouse-1',
      destinationWarehouseId: 'warehouse-2',
    });
    const repeated = await context.transfer.execute({
      companyId: 'company-1',
      idempotencyKey: 'transfer-1',
      occurredAt,
      productId: 'product-1',
      unit: 'unidad',
      quantity: 12,
      originWarehouseId: 'warehouse-1',
      destinationWarehouseId: 'warehouse-2',
    });

    const origin = await context.ledger.loadStock('company-1', ['product-1'], 'warehouse-1');
    const destination = await context.ledger.loadStock('company-1', ['product-1'], 'warehouse-2');

    expect(transfer.type).toBe('warehouse-transfer');
    expect(transfer.warehouseId).toBe('warehouse-1');
    expect(transfer.journal).toEqual([
      { accountCode: '1.01.02.001', debit: 10 * 5 + 2 * 8, credit: 0, costCenter: 'BOD-002' },
      { accountCode: '1.01.02.001', debit: 0, credit: 10 * 5 + 2 * 8, costCenter: 'BOD-001' },
    ]);
    expect(repeated.id).toBe(transfer.id);
    expect(onHand(origin)).toBe(8);
    expect(onHand(destination)).toBe(12);
  });

  it('rejects transferring to the same warehouse', async () => {
    const context = await fixture();
    await receive(context, 10, 5);

    await expect(
      context.transfer.execute({
        companyId: 'company-1',
        idempotencyKey: 'bad-transfer',
        occurredAt,
        productId: 'product-1',
        unit: 'unidad',
        quantity: 1,
        originWarehouseId: 'warehouse-1',
        destinationWarehouseId: 'warehouse-1',
      }),
    ).rejects.toThrow(DocumentError);
  });

  it('leaves both warehouses unchanged when there is not enough stock at the origin', async () => {
    const context = await fixture();
    await receive(context, 2, 5);
    const before = await context.ledger.loadStock('company-1', ['product-1'], 'warehouse-1');

    await expect(
      context.transfer.execute({
        companyId: 'company-1',
        idempotencyKey: 'too-many',
        occurredAt,
        productId: 'product-1',
        unit: 'unidad',
        quantity: 50,
        originWarehouseId: 'warehouse-1',
        destinationWarehouseId: 'warehouse-2',
      }),
    ).rejects.toThrow(InsufficientStockError);

    expect(await context.ledger.loadStock('company-1', ['product-1'], 'warehouse-1')).toEqual(before);
    expect(onHand(await context.ledger.loadStock('company-1', ['product-1'], 'warehouse-2'))).toBe(0);
  });

  it('rejects an inactive destination warehouse', async () => {
    const context = await fixture();
    await receive(context, 10, 5);
    await context.companies.createWarehouse({ id: 'warehouse-3', companyId: 'company-1', name: 'Bodega Inactiva', code: 'BOD-003', active: false, isDefault: false });

    await expect(
      context.transfer.execute({
        companyId: 'company-1',
        idempotencyKey: 'to-inactive',
        occurredAt,
        productId: 'product-1',
        unit: 'unidad',
        quantity: 1,
        originWarehouseId: 'warehouse-1',
        destinationWarehouseId: 'warehouse-3',
      }),
    ).rejects.toThrow(DocumentError);
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
    { ...createDefaultWarehouse('company-1', 'warehouse-1'), code: 'BOD-001' },
  );
  await companies.createWarehouse({ id: 'warehouse-2', companyId: 'company-1', name: 'Bodega 2', code: 'BOD-002', active: true, isDefault: false });
  await accounting.saveChart('company-1', {
    accounts: CHART_OF_ACCOUNTS.map((account) => ({ ...account })),
    rules: POSTING_RULES.map((rule) => ({ ...rule })),
    taxes: TAX_CATEGORIES.map((tax) => ({ ...tax })),
  });
  await products.save(sample('product-1', '00000001'));
  const confirm = new ConfirmDocumentUseCase(ledger, products, accounting);
  const transfer = new TransferStockUseCase(ledger, products, companies, accounting);
  return { products, ledger, confirm, transfer, companies };
}

async function receive(context: Awaited<ReturnType<typeof fixture>>, quantity: number, unitCost: number): Promise<void> {
  const key = `buy-${unitCost}-${quantity}`;
  await context.confirm.execute({
    companyCostingMethod: 'PEPS',
    receivedAt: occurredAt,
    draft: {
      id: key,
      companyId: 'company-1',
      warehouseId: 'warehouse-1',
      type: 'purchase',
      idempotencyKey: key,
      paymentAccountCode: '1.01.01.001',
      collectionAccountCode: null,
      adjustmentDirection: null,
      transferAmount: null,
      transferFromAccountCode: null,
      transferToAccountCode: null,
      lines: [
        {
          productId: 'product-1',
          presentationFactor: 1,
          quantity,
          unitCost,
          saleAmount: null,
          selectedLayerId: null,
          expiresOn: null,
          newLayerId: `layer-${key}`,
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
