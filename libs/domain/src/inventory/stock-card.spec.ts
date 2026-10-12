import { quoteIssueUnitCost, type CostLayer } from '@domain/inventory/costing';
import { buildStockCard } from '@domain/inventory/stock-card';
import type { Product } from '@domain/inventory/product';

describe('stock card cost', () => {
  it('uses the oldest PEPS layer, the average value, and no single cost for specific identification', () => {
    const layers: CostLayer[] = [
      { id: 'new', receivedAt: '2026-02-01T00:00:00.000Z', expiresOn: null, quantity: 1, unitCost: 9 },
      { id: 'old', receivedAt: '2026-01-01T00:00:00.000Z', expiresOn: null, quantity: 1, unitCost: 4 },
    ];
    const card = buildStockCard({
      product: product(),
      layers,
      method: 'SPECIFIC',
      manufacturerBarcode: null,
      resolvedUnit: null,
    });

    expect(quoteIssueUnitCost('PEPS', layers)).toBe(4);
    expect(quoteIssueUnitCost('AVERAGE', layers)).toBe(6.5);
    expect(card.unitCost).toBeNull();
    expect(card.baseQuantity).toBe(2);
    expect(card.internalBarcode).toBe('00000001');
  });
});

function product(): Product {
  return {
    id: 'product-1',
    companyId: 'company-1',
    name: 'Refresco',
    category: 'Bebidas',
    baseUnit: 'unidad',
    tracksExpiry: false,
    costingMethod: 'SPECIFIC',
    marginPercent: null,
    taxCategoryCode: 'none',
    active: true,
    internalBarcode: '00000001',
    presentations: [
      { unit: 'unidad', factor: 1, purchasable: true, sellable: true, salePrice: 15, manufacturerBarcode: null },
    ],
  };
}
