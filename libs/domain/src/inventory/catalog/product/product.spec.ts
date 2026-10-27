import { BarcodeError, encodeCode128, formatInternalBarcode, renderBarcodeSvg } from '@domain/inventory/catalog/barcode-sheet/barcode';
import { ProductError, assertPresentation, toBaseQuantity, unitCostFromPack } from '@domain/inventory/catalog/product/product';

describe('presentations', () => {
  it('expresses a case of 48 in the base unit and splits the pack cost', () => {
    expect(toBaseQuantity(48, 1)).toBe(48);
    expect(toBaseQuantity(48, 2)).toBe(96);
    expect(unitCostFromPack(480, 48)).toBe(10);
  });

  it('keeps weight as the quantity of that operation', () => {
    expect(toBaseQuantity(1, 2.5)).toBe(2.5);
  });

  it('allows a presentation without a manufacturer barcode and keeps its sale price', () => {
    const presentation = {
      unit: 'caja',
      factor: 48,
      purchasable: true,
      sellable: true,
      salePrice: 120,
      manufacturerBarcode: null,
    };

    expect(() => assertPresentation(presentation)).not.toThrow();
    expect(presentation.salePrice).toBe(120);
  });

  it('rejects a sellable presentation without a price', () => {
    expect(() =>
      assertPresentation({
        unit: 'unidad',
        factor: 1,
        purchasable: true,
        sellable: true,
        salePrice: null,
        manufacturerBarcode: null,
      }),
    ).toThrow(ProductError);
  });
});

describe('internal barcode', () => {
  it('previews a numeric Code 128 as SVG bars and readable text', () => {
    const code = formatInternalBarcode(1);
    const modules = encodeCode128(code);
    const svg = renderBarcodeSvg(code, modules);

    expect(code).toBe('00000001');
    expect(modules.some((module) => module)).toBe(true);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('>00000001</text>');
  });

  it('rejects a barcode that is not an even numeric code', () => {
    expect(() => encodeCode128('12A')).toThrow(BarcodeError);
    expect(() => encodeCode128('123')).toThrow(BarcodeError);
  });
});
