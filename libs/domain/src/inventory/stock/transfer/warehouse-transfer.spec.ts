import { CHART_OF_ACCOUNTS } from '@domain/accounting/account/chart';
import { DocumentError } from '@domain/inventory/stock/document/document';
import { InsufficientStockError, type CostLayer } from '@domain/inventory/catalog/costing/costing';
import { planWarehouseTransfer } from '@domain/inventory/stock/transfer/warehouse-transfer';

function layer(id: string, receivedAt: string, quantity: number, unitCost: number): CostLayer {
  return { id, receivedAt, quantity, unitCost, expiresOn: null };
}

function sequentialIds(prefix: string) {
  let count = 0;
  return () => `${prefix}-${++count}`;
}

describe('planWarehouseTransfer', () => {
  it('rejects the same warehouse as origin and destination', () => {
    expect(() =>
      planWarehouseTransfer({
        productId: 'p1',
        originWarehouseId: 'w1',
        destinationWarehouseId: 'w1',
        originCostCenter: 'BOD-001',
        destinationCostCenter: 'BOD-001',
        method: 'PEPS',
        originLayers: [layer('l1', '2026-01-01T00:00:00Z', 10, 5)],
        destinationLayers: [],
        presentationFactor: 1,
        quantity: 1,
        selectedLayerId: null,
        accounts: CHART_OF_ACCOUNTS,
        newLayerIdFactory: sequentialIds('new'),
      }),
    ).toThrow(DocumentError);
  });

  it('rejects more quantity than is on hand at the origin', () => {
    expect(() =>
      planWarehouseTransfer({
        productId: 'p1',
        originWarehouseId: 'w1',
        destinationWarehouseId: 'w2',
        originCostCenter: 'BOD-001',
        destinationCostCenter: 'BOD-002',
        method: 'PEPS',
        originLayers: [layer('l1', '2026-01-01T00:00:00Z', 2, 5)],
        destinationLayers: [],
        presentationFactor: 1,
        quantity: 5,
        selectedLayerId: null,
        accounts: CHART_OF_ACCOUNTS,
        newLayerIdFactory: sequentialIds('new'),
      }),
    ).toThrow(InsufficientStockError);
  });

  it('moves PEPS layers without revaluing them and balances the journal by cost center', () => {
    const plan = planWarehouseTransfer({
      productId: 'p1',
      originWarehouseId: 'w1',
      destinationWarehouseId: 'w2',
      originCostCenter: 'BOD-001',
      destinationCostCenter: 'BOD-002',
      method: 'PEPS',
      originLayers: [
        layer('old', '2026-01-01T00:00:00Z', 10, 5),
        layer('new', '2026-06-01T00:00:00Z', 10, 8),
      ],
      destinationLayers: [layer('existing', '2026-02-01T00:00:00Z', 3, 6)],
      presentationFactor: 1,
      quantity: 12,
      selectedLayerId: null,
      accounts: CHART_OF_ACCOUNTS,
      newLayerIdFactory: sequentialIds('moved'),
    });

    expect(plan.amount).toBe(10 * 5 + 2 * 8);
    expect(plan.baseQuantity).toBe(12);
    expect(plan.journal).toEqual([
      { accountCode: '1.01.02.001', debit: plan.amount, credit: 0, costCenter: 'BOD-002' },
      { accountCode: '1.01.02.001', debit: 0, credit: plan.amount, costCenter: 'BOD-001' },
    ]);
    expect(plan.movements).toEqual([
      { productId: 'p1', direction: 'out', baseQuantity: 12, cost: plan.amount, revenue: 0 },
      { productId: 'p1', direction: 'in', baseQuantity: 12, cost: plan.amount, revenue: 0 },
    ]);
    expect(plan.originLayers).toEqual([{ id: 'new', receivedAt: '2026-06-01T00:00:00Z', expiresOn: null, quantity: 8, unitCost: 8 }]);
    expect(plan.destinationLayers).toEqual([
      layer('existing', '2026-02-01T00:00:00Z', 3, 6),
      { id: 'moved-1', receivedAt: '2026-01-01T00:00:00Z', expiresOn: null, quantity: 10, unitCost: 5 },
      { id: 'moved-2', receivedAt: '2026-06-01T00:00:00Z', expiresOn: null, quantity: 2, unitCost: 8 },
    ]);
    expect(plan.destinationLayers).not.toBe(plan.originLayers);
  });

  it('rejects a zero or negative quantity', () => {
    expect(() =>
      planWarehouseTransfer({
        productId: 'p1',
        originWarehouseId: 'w1',
        destinationWarehouseId: 'w2',
        originCostCenter: 'BOD-001',
        destinationCostCenter: 'BOD-002',
        method: 'PEPS',
        originLayers: [layer('l1', '2026-01-01T00:00:00Z', 10, 5)],
        destinationLayers: [],
        presentationFactor: 1,
        quantity: 0,
        selectedLayerId: null,
        accounts: CHART_OF_ACCOUNTS,
        newLayerIdFactory: sequentialIds('new'),
      }),
    ).toThrow(DocumentError);
  });
});
