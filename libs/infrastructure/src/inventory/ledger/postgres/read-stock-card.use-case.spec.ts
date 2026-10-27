import { ReadStockCardUseCase } from '@application/inventory/stock/report/read-stock-card.use-case';
import { CHART_OF_ACCOUNTS, POSTING_RULES, TAX_CATEGORIES } from '@domain/accounting/account/chart';
import { defaultGrants, type ModuleGrant } from '@domain/identity/membership/module-access';
import type { CostLayer } from '@domain/inventory/catalog/costing/costing';
import type { Product } from '@domain/inventory/catalog/product/product';
import { InMemoryAccountingRepository } from '@infrastructure/accounting/account/in-memory/in-memory-accounting.repository';
import { InMemoryCompanyRepository } from '@infrastructure/tenancy/company/in-memory/in-memory-company.repository';
import { InMemoryInventoryLedger } from '@infrastructure/inventory/ledger/in-memory/in-memory-inventory.ledger';
import { InMemoryProductRepository } from '@infrastructure/catalog/product/in-memory/in-memory-product.repository';
import { createCompany, createDefaultWarehouse } from '@domain/tenancy/company/company';

describe('read stock card', () => {
  it('returns name, presentation, stock, PEPS cost, price, and code', async () => {
    const context = await fixture();
    const card = await context.useCase.execute({
      companyId: 'company-1',
      productId: '',
      code: '75010001',
      grants: defaultGrants('owner'),
    });

    expect(card.name).toBe('Refresco');
    expect(card.resolvedUnit).toBe('caja');
    expect(card.manufacturerBarcode).toBe('75010001');
    expect(card.baseQuantity).toBe(10);
    expect(card.unitCost).toBe(4);
    expect(card.presentations.find((item) => item.unit === 'caja')?.salePrice).toBe(80);
    expect(card.internalBarcode).toBe('00000001');
    expect(await context.ledger.listDocuments('company-1')).toHaveLength(1);
  });

  it('does not write a document for an unknown code and hides a specific cost without a layer', async () => {
    const context = await fixture();
    await context.products.save({ ...product(), id: 'product-2', internalBarcode: '00000002', costingMethod: 'SPECIFIC' });

    await expect(
      context.useCase.execute({ companyId: 'company-1', productId: '', code: 'no-such', grants: defaultGrants('owner') }),
    ).rejects.toThrow('Product was not found');
    const specific = await context.useCase.execute({
      companyId: 'company-1',
      productId: 'product-2',
      code: '',
      grants: defaultGrants('owner'),
    });

    expect(specific.unitCost).toBeNull();
    expect(await context.ledger.listDocuments('company-1')).toHaveLength(1);
  });

  it('refuses the card when prices cannot be viewed', async () => {
    const context = await fixture();
    const grants: ModuleGrant[] = [
      { module: 'inventory', access: 'view' },
      { module: 'products', access: 'view' },
    ];

    await expect(
      context.useCase.execute({ companyId: 'company-1', productId: 'product-1', code: '', grants }),
    ).rejects.toThrow('Permission denied');
    expect(await context.ledger.listDocuments('company-1')).toHaveLength(1);
  });
});

async function fixture() {
  const products = new InMemoryProductRepository();
  const ledger = new InMemoryInventoryLedger();
  const companies = new InMemoryCompanyRepository();
  const accounting = new InMemoryAccountingRepository();
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
  await products.save(product());
  await ledger.commit({
    document: {
      id: 'seed',
      companyId: 'company-1',
      type: 'opening',
      status: 'confirmed',
      idempotencyKey: 'seed',
      occurredAt: '2026-01-01T00:00:00.000Z',
      journal: [
        { accountCode: '1.01.02.001', debit: 40, credit: 0 },
        { accountCode: '3.01.02.001', debit: 0, credit: 40 },
      ],
      effects: [],
      movements: [],
      reversalId: null,
      reversalOf: null,
    },
    voidedDocumentId: null,
    stock: [{ companyId: 'company-1', productId: 'product-1', layers: [oldLayer(), newLayer()] }],
  });
  return { products, ledger, useCase: new ReadStockCardUseCase(products, ledger, companies) };
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
      { unit: 'caja', factor: 12, purchasable: true, sellable: true, salePrice: 80, manufacturerBarcode: '75010001' },
    ],
  };
}

function oldLayer(): CostLayer {
  return { id: 'old', receivedAt: '2026-01-01T00:00:00.000Z', expiresOn: null, quantity: 4, unitCost: 4 };
}

function newLayer(): CostLayer {
  return { id: 'new', receivedAt: '2026-02-01T00:00:00.000Z', expiresOn: null, quantity: 6, unitCost: 9 };
}
