import { CHART_OF_ACCOUNTS, POSTING_RULES } from '@domain/accounting/chart';
import type { CostLayer } from '@domain/inventory/costing';
import { resolveCompanyCode } from '@domain/inventory/code-lookup';
import { planConfirmation, type DraftDocument } from '@domain/inventory/document';
import { assertOutboundAdjustment, buildOutboundAdjustment } from '@domain/inventory/issue-draft';
import type { Product } from '@domain/inventory/product';

const receivedAt = '2026-10-04T00:00:00.000Z';

describe('outbound adjustment draft', () => {
  it('posts 6.01.01.002 against 1.01.02.001 and leaves a sale on two entries', () => {
    const draft = buildOutboundAdjustment({
      id: 'issue-1',
      companyId: 'company-1',
      idempotencyKey: 'issue-key',
      lines: [issueLine()],
    });
    const issue = planConfirmation({
      draft,
      stock: [{ productId: 'product-1', method: 'PEPS', layers: [layer()] }],
      accounts: [...CHART_OF_ACCOUNTS],
      rules: [...POSTING_RULES],
      receivedAt,
    });
    const sale = planConfirmation({
      draft: saleDraft(),
      stock: [{ productId: 'product-1', method: 'PEPS', layers: [layer()] }],
      accounts: [...CHART_OF_ACCOUNTS],
      rules: [...POSTING_RULES],
      receivedAt,
    });

    expect(draft.type).toBe('adjustment');
    expect(draft.adjustmentDirection).toBe('out');
    expect(issue.journal.map((line) => line.accountCode)).toEqual(['6.01.01.002', '1.01.02.001']);
    expect(issue.journal.some((line) => line.accountCode === '4.01.01.001' || line.accountCode === '6.01.01.001')).toBe(false);
    expect(sale.journal.map((line) => line.accountCode)).toEqual(['1.01.01.001', '4.01.01.001', '5.01.01.001', '1.01.02.001']);
  });

  it('rejects a sale draft and a blank, unknown, inactive, or repeated manufacturer code without touching stock', () => {
    const layers: CostLayer[] = [layer()];
    const before = layers.map((row) => ({ ...row }));
    const active = sample('product-1', true, '00000001', '7501');
    const inactive = sample('product-2', false, '00000002', '7502');
    const twinA = sample('product-3', true, '00000003', '7509');
    const twinB = sample('product-4', true, '00000004', '7509');

    expect(() => assertOutboundAdjustment(saleDraft())).toThrow('Issue must be an outbound adjustment');
    expect(() => resolveCompanyCode([active], '')).toThrow('Barcode is required');
    expect(() => resolveCompanyCode([active], '9999')).toThrow('Product was not found');
    expect(() => resolveCompanyCode([inactive], '00000002')).toThrow('Product is inactive');
    expect(() => resolveCompanyCode([twinA, twinB], '7509')).toThrow('Manufacturer barcode is duplicated');
    expect(resolveCompanyCode([active], '7501').product.id).toBe('product-1');
    expect(layers).toEqual(before);
  });
});

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

function layer(): CostLayer {
  return { id: 'layer-1', receivedAt, expiresOn: null, quantity: 10, unitCost: 5 };
}

function saleDraft(): DraftDocument {
  return {
    id: 'sale-1',
    companyId: 'company-1',
    type: 'sale',
    idempotencyKey: 'sale-key',
    paymentAccountCode: null,
    collectionAccountCode: '1.01.01.001',
    adjustmentDirection: null,
    transferAmount: null,
    transferFromAccountCode: null,
    transferToAccountCode: null,
    lines: [{ ...issueLine(), saleAmount: 20 }],
  };
}

function sample(id: string, active: boolean, internalBarcode: string, manufacturerBarcode: string): Product {
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
    active,
    internalBarcode,
    presentations: [
      { unit: 'unidad', factor: 1, purchasable: true, sellable: true, salePrice: 15, manufacturerBarcode },
    ],
  };
}
