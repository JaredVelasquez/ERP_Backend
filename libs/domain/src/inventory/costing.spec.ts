import {
  allocateIssue,
  assertCanChangeCostingMethod,
  CostingMethodChangeError,
  InsufficientStockError,
  InvalidQuantityError,
  resolveCostingMethod,
  SpecificLayerRequiredError,
  type CostLayer,
} from '@domain/inventory/costing';

function layer(
  id: string,
  receivedAt: string,
  quantity: number,
  unitCost: number,
  expiresOn: string | null = null,
): CostLayer {
  return { id, receivedAt, quantity, unitCost, expiresOn };
}

const older = layer('old', '2026-01-01T00:00:00Z', 10, 5);
const newer = layer('new', '2026-06-01T00:00:00Z', 10, 15);

describe('allocateIssue', () => {
  it('consumes the oldest layer first under PEPS', () => {
    const allocation = allocateIssue({ method: 'PEPS', quantity: 10, layers: [newer, older] });

    expect(allocation.consumed).toEqual([{ layerId: 'old', quantity: 10, unitCost: 5 }]);
    expect(allocation.totalCost).toBe(50);
    expect(allocation.remainingLayers.map((row) => row.id)).toEqual(['new']);
  });

  it('would fail if PEPS used the newest cost', () => {
    const allocation = allocateIssue({ method: 'PEPS', quantity: 15, layers: [older, newer] });

    expect(allocation.totalCost).toBe(125);
    expect(allocation.consumed[0]?.layerId).toBe('old');
  });

  it('consumes the newest layer first under UEPS', () => {
    const allocation = allocateIssue({ method: 'UEPS', quantity: 10, layers: [older, newer] });

    expect(allocation.consumed[0]?.layerId).toBe('new');
    expect(allocation.totalCost).toBe(150);
  });

  it('consumes the earliest expiry under FEFO even when that layer arrived later', () => {
    const laterExpiry = layer('later', '2026-01-01T00:00:00Z', 5, 5, '2026-12-01');
    const soonerExpiry = layer('sooner', '2026-06-01T00:00:00Z', 5, 9, '2026-02-01');
    const allocation = allocateIssue({
      method: 'FEFO',
      quantity: 5,
      layers: [laterExpiry, soonerExpiry],
    });

    expect(allocation.consumed[0]?.layerId).toBe('sooner');
    expect(allocation.totalCost).toBe(45);
  });

  it('prices an average issue from the whole balance, not the oldest layer', () => {
    const allocation = allocateIssue({ method: 'AVERAGE', quantity: 10, layers: [older, newer] });

    expect(allocation.unitCost).toBe(10);
    expect(allocation.totalCost).toBe(100);
    expect(allocation.consumed[0]?.unitCost).toBe(10);
  });

  it('requires the chosen layer for specific identification', () => {
    expect(() => allocateIssue({ method: 'SPECIFIC', quantity: 1, layers: [older, newer] })).toThrow(
      SpecificLayerRequiredError,
    );
  });

  it('does not borrow stock from another layer when the chosen one is short', () => {
    expect(() =>
      allocateIssue({
        method: 'SPECIFIC',
        quantity: 11,
        layers: [older, newer],
        selectedLayerId: 'old',
      }),
    ).toThrow(InsufficientStockError);
  });

  it('rejects zero, negative, and more than on hand', () => {
    expect(() => allocateIssue({ method: 'PEPS', quantity: 0, layers: [older] })).toThrow(
      InvalidQuantityError,
    );
    expect(() => allocateIssue({ method: 'PEPS', quantity: -1, layers: [older] })).toThrow(
      InvalidQuantityError,
    );
    expect(() => allocateIssue({ method: 'PEPS', quantity: 11, layers: [older] })).toThrow(
      InsufficientStockError,
    );
  });

  it('does not allocate the same units twice', () => {
    const first = allocateIssue({ method: 'PEPS', quantity: 10, layers: [older] });

    expect(first.remainingLayers).toEqual([]);
    expect(() => allocateIssue({ method: 'PEPS', quantity: 10, layers: first.remainingLayers })).toThrow(
      InsufficientStockError,
    );
  });

  it('leaves the original layers unchanged', () => {
    const snapshot = [older, newer];
    allocateIssue({ method: 'PEPS', quantity: 4, layers: snapshot });

    expect(snapshot[0]?.quantity).toBe(10);
    expect(snapshot[1]?.quantity).toBe(10);
  });
});

describe('costing method selection', () => {
  it('uses the company method when the product does not choose one', () => {
    expect(resolveCostingMethod(null, 'PEPS')).toBe('PEPS');
  });

  it('lets the product override the company method', () => {
    expect(resolveCostingMethod('FEFO', 'PEPS')).toBe('FEFO');
  });

  it('rejects a method change while stock remains', () => {
    expect(() => assertCanChangeCostingMethod(0.25)).toThrow(CostingMethodChangeError);
    expect(() => assertCanChangeCostingMethod(0)).not.toThrow();
  });
});
