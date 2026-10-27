import { CHART_OF_ACCOUNTS, POSTING_RULES } from '@domain/accounting/account/chart';
import { InsufficientStockError } from '@domain/inventory/catalog/costing/costing';
import {
  assertBalanced,
  journalTotals,
  planConfirmation,
  planVoid,
  type DraftDocument,
  type StockSnapshot,
} from '@domain/inventory/stock/document/document';

const receivedAt = '2026-10-04T00:00:00.000Z';

describe('inventory documents', () => {
  it('purchases into a layer and posts a balanced entry to cash', () => {
    const plan = planConfirmation(input(draft({ type: 'purchase', lines: [receiptLine()] }), [emptyStock()]));

    expect(onHand(plan.stockChanges[0]?.layers ?? [])).toBe(10);
    expect(plan.journal).toEqual([
      { accountCode: '1.01.02.001', debit: 50, credit: 0 },
      { accountCode: '1.01.01.001', debit: 0, credit: 50 },
    ]);
    expect(journalTotals(plan.journal)).toEqual({ debit: 50, credit: 50 });
  });

  it('credits opening balances and does not touch cash', () => {
    const plan = planConfirmation(input(draft({ type: 'opening', lines: [receiptLine()] }), [emptyStock()]));

    expect(plan.journal.map((line) => line.accountCode)).toEqual(['1.01.02.001', '3.01.02.001']);
    assertBalanced(plan.journal);
  });

  it('sells stock with two balanced entries', () => {
    const plan = planConfirmation(
      input(draft({ type: 'sale', collectionAccountCode: '1.01.01.001', lines: [saleLine()] }), [stock(10)]),
    );

    expect(onHand(plan.stockChanges[0]?.layers ?? [])).toBe(8);
    expect(journalTotals(plan.journal)).toEqual({ debit: 40, credit: 40 });
    expect(plan.journal.map((line) => line.accountCode)).toEqual(['1.01.01.001', '4.01.01.001', '5.01.01.001', '1.01.02.001']);
  });

  it('writes nothing for a sale without stock', () => {
    expect(() => planConfirmation(input(draft({ type: 'sale', collectionAccountCode: '1.01.01.001', lines: [saleLine()] }), [emptyStock()]))).toThrow(
      InsufficientStockError,
    );
  });

  it('posts shrinkage to merma, not to sales', () => {
    const plan = planConfirmation(input(draft({ type: 'shrinkage', lines: [issueLine()] }), [stock(10)]));

    expect(plan.journal.map((line) => line.accountCode)).toEqual(['6.01.01.001', '1.01.02.001']);
    expect(onHand(plan.stockChanges[0]?.layers ?? [])).toBe(8);
    assertBalanced(plan.journal);
  });

  it('increases stock on a positive adjustment and decreases it on a negative one', () => {
    const increase = planConfirmation(
      input(draft({ type: 'adjustment', adjustmentDirection: 'in', lines: [receiptLine()] }), [emptyStock()]),
    );
    const decrease = planConfirmation(
      input(draft({ type: 'adjustment', adjustmentDirection: 'out', lines: [issueLine()] }), [stock(10)]),
    );

    expect(onHand(increase.stockChanges[0]?.layers ?? [])).toBe(10);
    expect(increase.journal.map((line) => line.accountCode)).toEqual(['1.01.02.001', '6.01.01.002']);
    expect(onHand(decrease.stockChanges[0]?.layers ?? [])).toBe(8);
    assertBalanced(increase.journal);
    assertBalanced(decrease.journal);
  });

  it('moves money without changing inventory', () => {
    const plan = planConfirmation(
      input(
        draft({
          type: 'cash-transfer',
          transferAmount: 25,
          transferFromAccountCode: '1.01.01.001',
          transferToAccountCode: '1.01.01.006',
        }),
        [stock(10)],
      ),
    );

    expect(plan.stockChanges).toEqual([]);
    expect(plan.journal).toEqual([
      { accountCode: '1.01.01.006', debit: 25, credit: 0 },
      { accountCode: '1.01.01.001', debit: 0, credit: 25 },
    ]);
  });

  it('voids a purchase back to zero with a balanced reversal', () => {
    const purchase = planConfirmation(input(draft({ type: 'purchase', lines: [receiptLine()] }), [emptyStock()]));
    const reversal = planVoid({
      status: 'confirmed',
      effects: purchase.effects,
      journal: purchase.journal,
      stock: [{ productId: 'product-1', method: 'PEPS', layers: purchase.stockChanges[0]?.layers ?? [] }],
      reversalId: 'void-1',
    });

    expect(onHand(reversal.stockChanges[0]?.layers ?? [])).toBe(0);
    expect(journalTotals(reversal.journal)).toEqual({ debit: 50, credit: 50 });
  });
});

function input(document: DraftDocument, snapshots: StockSnapshot[]) {
  return {
    draft: document,
    stock: snapshots,
    accounts: CHART_OF_ACCOUNTS,
    rules: POSTING_RULES,
    receivedAt,
  };
}

function draft(overrides: Partial<DraftDocument> & Pick<DraftDocument, 'type'>): DraftDocument {
  return {
    id: 'doc-1',
    companyId: 'company-1',
    idempotencyKey: 'key-1',
    paymentAccountCode: null,
    collectionAccountCode: null,
    adjustmentDirection: null,
    transferAmount: null,
    transferFromAccountCode: null,
    transferToAccountCode: null,
    lines: [],
    ...overrides,
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

function saleLine() {
  return { ...issueLine(), saleAmount: 30 };
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

function emptyStock(): StockSnapshot {
  return { productId: 'product-1', method: 'PEPS', layers: [] };
}

function stock(quantity: number): StockSnapshot {
  return {
    productId: 'product-1',
    method: 'PEPS',
    layers: [{ id: 'layer-1', receivedAt, expiresOn: null, quantity, unitCost: 5 }],
  };
}

function onHand(layers: readonly { quantity: number }[]): number {
  return layers.reduce((sum, layer) => sum + layer.quantity, 0);
}
