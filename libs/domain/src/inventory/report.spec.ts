import { accountLedger, buildDashboard, inventoryValue, journal, kardex, lastDays, trialBalance } from '@domain/inventory/report';
import type { ConfirmedDocument } from '@domain/inventory/ledger.port';

describe('dashboard and reports', () => {
  it('does not count shrinkage as a sale or as revenue', () => {
    const period = lastDays('2026-10-04', 30);
    const dashboard = buildDashboard({
      ...period,
      documents: [sale('2026-10-01'), shrinkage('2026-10-02')],
      prices: [],
      activeProductIds: ['product-1', 'product-2'],
    });

    expect(period.from).toBe('2026-09-05');
    expect(dashboard.salesAmount).toBe(30);
    expect(dashboard.shrinkageCost).toBe(10);
    expect(dashboard.topRevenue?.productId).toBe('product-1');
    expect(dashboard.leastSold?.productId).toBe('product-2');
    expect(journal([sale('2026-10-01'), shrinkage('2026-10-02')], period.from, period.to)).toHaveLength(2);
    expect(accountLedger([sale('2026-10-01'), shrinkage('2026-10-02')], '4.01.01.001', period.from, period.to)).toEqual([
      { accountCode: '4.01.01.001', debit: 0, credit: 30 },
    ]);
  });

  it('keeps a voided purchase out of sales and balances the trial', () => {
    const purchase = document({
      id: 'purchase',
      type: 'purchase',
      status: 'voided',
      occurredAt: '2026-10-01T00:00:00.000Z',
      journal: [
        { accountCode: '1.01.02.001', debit: 50, credit: 0 },
        { accountCode: '1.01.01.001', debit: 0, credit: 50 },
      ],
      movements: [{ productId: 'product-1', direction: 'in', baseQuantity: 10, cost: 50, revenue: 0 }],
    });
    const reversal = document({
      id: 'void',
      type: 'void',
      status: 'confirmed',
      occurredAt: '2026-10-01T00:00:00.000Z',
      journal: [
        { accountCode: '1.01.01.001', debit: 50, credit: 0 },
        { accountCode: '1.01.02.001', debit: 0, credit: 50 },
      ],
      movements: [],
    });
    const rows = trialBalance([purchase, reversal], '2026-09-05', '2026-10-04');
    const dashboard = buildDashboard({
      from: '2026-09-05',
      to: '2026-10-04',
      documents: [purchase, reversal],
      prices: [],
      activeProductIds: ['product-1'],
    });

    expect(dashboard.salesAmount).toBe(0);
    expect(rows.reduce((sum, row) => sum + row.debit, 0)).toBe(rows.reduce((sum, row) => sum + row.credit, 0));
    expect(kardex([purchase, reversal], 'product-1', '2026-09-05', '2026-10-04')).toEqual([]);
    expect(inventoryValue([{ id: 'layer', receivedAt: '2026-10-01', expiresOn: null, quantity: 4, unitCost: 5 }])).toEqual({
      quantity: 4,
      value: 20,
    });
  });
});

function sale(occurredAt: string): ConfirmedDocument {
  return document({
    id: 'sale',
    type: 'sale',
    status: 'confirmed',
    occurredAt,
    journal: [
      { accountCode: '1.01.01.001', debit: 30, credit: 0 },
      { accountCode: '4.01.01.001', debit: 0, credit: 30 },
    ],
    movements: [{ productId: 'product-1', direction: 'out', baseQuantity: 2, cost: 10, revenue: 30 }],
  });
}

function shrinkage(occurredAt: string): ConfirmedDocument {
  return document({
    id: 'shrink',
    type: 'shrinkage',
    status: 'confirmed',
    occurredAt,
    journal: [
      { accountCode: '6.01.01.001', debit: 10, credit: 0 },
      { accountCode: '1.01.02.001', debit: 0, credit: 10 },
    ],
    movements: [{ productId: 'product-1', direction: 'out', baseQuantity: 2, cost: 10, revenue: 50 }],
  });
}

function document(overrides: Pick<ConfirmedDocument, 'id' | 'type' | 'status' | 'occurredAt' | 'journal' | 'movements'>): ConfirmedDocument {
  return {
    companyId: 'company-1',
    idempotencyKey: overrides.id,
    effects: [],
    reversalId: null,
    reversalOf: null,
    ...overrides,
  };
}
