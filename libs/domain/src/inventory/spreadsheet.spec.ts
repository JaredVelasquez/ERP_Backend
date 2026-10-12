import { SpreadsheetError, catalogTemplate, countTemplate, parseCatalog, parseCount, parseCsv } from '@domain/inventory/spreadsheet';

describe('spreadsheet import', () => {
  it('rejects the original price workbook and any file that is not the template', () => {
    expect(() => parseCatalog(parseCsv('PRECIOS,0.25\nCoca,10'), 'company-1', '2026-10-04')).toThrow(SpreadsheetError);
    expect(catalogTemplate().startsWith('sku,nombre,categoria,')).toBe(true);
    expect(countTemplate()).toBe('sku,cantidad\n');
  });

  it('rejects the whole catalog when one row is invalid', () => {
    const table = parseCsv(
      [
        'sku,nombre,categoria,unidad_base,presentacion,factor,costo,precio,cantidad,vencimiento,codigo_fabricante',
        '00000001,Refresco,Bebidas,unidad,caja,48,10,120,1,,',
        '00000002,,Bebidas,unidad,unidad,1,5,15,2,,',
      ].join('\n'),
    );

    expect(() => parseCatalog(table, 'company-1', '2026-10-04')).toThrow('Row 3 is invalid');
  });

  it('plans one opening document and expresses a case of 48 in the base unit', () => {
    const table = parseCsv(
      [
        'sku,nombre,categoria,unidad_base,presentacion,factor,costo,precio,cantidad,vencimiento,codigo_fabricante',
        '00000001,Refresco,Bebidas,unidad,caja,48,10,120,1,,',
      ].join('\n'),
    );
    const imported = parseCatalog(table, 'company-1', '2026-10-04T00:00:00.000Z');

    expect(imported.document.type).toBe('opening');
    expect(imported.document.lines).toHaveLength(1);
    expect(imported.document.lines[0]).toMatchObject({ presentationFactor: 48, quantity: 1, unitCost: 10 });
    expect(imported.rows[0]?.manufacturerBarcode).toBeNull();
  });

  it('proposes a count adjustment and does not confirm it', () => {
    const table = parseCsv(['sku,cantidad', '00000001,8', '00000002,-1'].join('\n'));

    expect(() => parseCount(table, { '00000001': 10, '00000002': 4 }, 'company-1')).toThrow('Row 3 is invalid');
    const draft = parseCount(parseCsv(['sku,cantidad', '00000001,8'].join('\n')), { '00000001': 10 }, 'company-1');
    expect(draft.confirmed).toBe(false);
    expect(draft.document).toMatchObject({ type: 'adjustment', adjustmentDirection: 'out' });
    expect(draft.document.lines[0]).toMatchObject({ quantity: 2 });
  });
});
