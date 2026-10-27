import { PriceError, priceFromMargin, resolveMarginPercent } from '@domain/inventory/catalog/product/price';

describe('margin price', () => {
  it('uses the stored percent as percent points, so 0.25 is not 25 percent', () => {
    expect(priceFromMargin(80, 25)).toBe(100);
    expect(priceFromMargin(80, 0.25)).toBe(80.2);
  });

  it('does not calculate a price when no percent exists', () => {
    expect(priceFromMargin(80, null)).toBeNull();
    expect(resolveMarginPercent(null, null)).toBeNull();
  });

  it('prefers the product percent over the company percent', () => {
    expect(resolveMarginPercent(10, 25)).toBe(10);
    expect(resolveMarginPercent(null, 25)).toBe(25);
  });

  it('rejects a negative margin', () => {
    expect(() => priceFromMargin(80, -1)).toThrow(PriceError);
  });
});
