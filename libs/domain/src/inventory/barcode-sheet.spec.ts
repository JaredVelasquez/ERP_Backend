import { formatInternalBarcode } from '@domain/inventory/barcode';
import { assembleBarcodeLabels, assertBarcodeSheetIds } from '@domain/inventory/barcode-sheet';
import type { Product } from '@domain/inventory/product';

describe('barcode sheet labels', () => {
  it('keeps the stored code for one product and for many', () => {
    const first = product('sku-1', 'Arroz', '00000042');
    const second = product('sku-2', 'Frijol', '00000007');
    const one = assembleBarcodeLabels([first]);
    const many = assembleBarcodeLabels([first, second]);

    expect(one).toEqual([{ productId: 'sku-1', name: 'Arroz', internalBarcode: '00000042' }]);
    expect(many.map((label) => label.internalBarcode)).toEqual(['00000042', '00000007']);
    expect(many.map((label) => label.internalBarcode)).not.toContain(formatInternalBarcode(1));
    expect(many.map((label) => label.internalBarcode)).not.toContain(formatInternalBarcode(2));
  });

  it('rejects an empty list, a repeated id, and a missing internal code', () => {
    expect(() => assertBarcodeSheetIds([])).toThrow('Barcode sheet needs a product');
    expect(() => assertBarcodeSheetIds(['sku-1', 'sku-1'])).toThrow('Product is duplicated');
    expect(() => assembleBarcodeLabels([product('sku-1', 'Arroz', '')])).toThrow('Internal barcode is required');
    expect(() => assembleBarcodeLabels([product('sku-1', 'Arroz', '00000042'), product('sku-1', 'Arroz', '00000099')])).toThrow(
      'Product is duplicated',
    );
  });
});

function product(id: string, name: string, internalBarcode: string): Product {
  return {
    id,
    companyId: 'company-1',
    name,
    category: 'Abarrotes',
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
