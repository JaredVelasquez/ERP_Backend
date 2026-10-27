import { ConfirmDocumentUseCase } from '@application/inventory/stock/document/confirm-document.use-case';
import { ImportCatalogUseCase } from '@application/inventory/catalog/import/import-catalog.use-case';
import { ImportCountUseCase } from '@application/inventory/catalog/import/import-count.use-case';
import { CHART_OF_ACCOUNTS, POSTING_RULES, TAX_CATEGORIES } from '@domain/accounting/account/chart';
import { SpreadsheetError } from '@domain/inventory/catalog/import/spreadsheet';
import { InMemoryAccountingRepository } from '@infrastructure/accounting/account/in-memory/in-memory-accounting.repository';
import { InMemoryInventoryLedger } from '@infrastructure/inventory/ledger/in-memory/in-memory-inventory.ledger';
import { InMemoryProductRepository } from '@infrastructure/catalog/product/in-memory/in-memory-product.repository';

const header = 'sku,nombre,categoria,unidad_base,presentacion,factor,costo,precio,cantidad,vencimiento,codigo_fabricante';

describe('catalog import', () => {
  it('writes nothing when one row is invalid or the file is the original workbook', async () => {
    const context = await fixture();

    await expect(context.importer.execute('PRECIOS,0.25\nCoca,10', 'company-1', 'PEPS', '2026-10-04T00:00:00.000Z')).rejects.toThrow(
      SpreadsheetError,
    );
    await expect(
      context.importer.execute(`${header}\n00000001,,Bebidas,unidad,unidad,1,5,15,1,,`, 'company-1', 'PEPS', '2026-10-04T00:00:00.000Z'),
    ).rejects.toThrow(SpreadsheetError);
    expect(await context.products.list('company-1')).toEqual([]);
    expect(await context.ledger.listDocuments('company-1')).toEqual([]);
  });

  it('creates the product and one opening document for a case of 48', async () => {
    const context = await fixture();
    const csv = `${header}\n00000001,Refresco,Bebidas,unidad,caja,48,10,120,1,,`;
    const document = await context.importer.execute(csv, 'company-1', 'PEPS', '2026-10-04T00:00:00.000Z');
    const stock = await context.ledger.loadStock('company-1', ['00000001']);
    const count = await context.counter.execute('sku,cantidad\n00000001,40', 'company-1');

    expect(document?.type).toBe('opening');
    expect(await context.ledger.listDocuments('company-1')).toHaveLength(1);
    expect(stock[0]?.layers[0]?.quantity).toBe(48);
    expect(count.confirmed).toBe(false);
    expect(count.document.adjustmentDirection).toBe('out');
    expect(await context.ledger.listDocuments('company-1')).toHaveLength(1);
  });

  it('records an import with zero opening stock so an identical retry has no side effects', async () => {
    const context = await fixture();
    const csv = `${header}\n00000002,Servilletas,Hogar,paquete,paquete,1,8,12,0,,`;
    const first = await context.importer.execute(csv, 'company-1', 'PEPS', '2026-10-04T00:00:00.000Z');
    const before = await context.products.list('company-1');
    const second = await context.importer.execute(csv, 'company-1', 'PEPS', '2026-10-05T00:00:00.000Z');

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(await context.products.list('company-1')).toEqual(before);
    expect(await context.ledger.listDocuments('company-1')).toEqual([]);
  });
});

async function fixture() {
  const accounting = new InMemoryAccountingRepository();
  const products = new InMemoryProductRepository();
  const ledger = new InMemoryInventoryLedger();
  await accounting.saveChart('company-1', {
    accounts: CHART_OF_ACCOUNTS.map((account) => ({ ...account })),
    rules: POSTING_RULES.map((rule) => ({ ...rule })),
    taxes: TAX_CATEGORIES.map((tax) => ({ ...tax })),
  });
  const confirm = new ConfirmDocumentUseCase(ledger, products, accounting);
  const completedImports = new Set<string>();
  const transaction = {
    async run<T>(companyId: string, idempotencyKey: string, work: () => Promise<T | null>) {
      const key = `${companyId}:${idempotencyKey}`;
      if (completedImports.has(key)) return { executed: false, result: null };
      const result = await work();
      completedImports.add(key);
      return { executed: true, result };
    },
  };
  return {
    products,
    ledger,
    importer: new ImportCatalogUseCase(products, confirm, transaction, ledger),
    counter: new ImportCountUseCase(products, ledger),
  };
}
