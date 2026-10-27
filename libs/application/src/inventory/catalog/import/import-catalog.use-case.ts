import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ConfirmDocumentUseCase } from '@application/inventory/stock/document/confirm-document.use-case';
import { LEDGER_PORT, type ConfirmedDocument, type InventoryLedgerPort } from '@domain/inventory/stock/ledger/ledger.port';
import type { CostingMethod } from '@domain/inventory/catalog/costing/costing';
import { parseCatalog, parseCsv, type CatalogRow } from '@domain/inventory/catalog/import/spreadsheet';
import type { Product } from '@domain/inventory/catalog/product/product';
import type { DraftDocument } from '@domain/inventory/stock/document/document';
import { reclassifyShelf } from '@domain/inventory/stock/shelf/shelf';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/catalog/product/product.port';
import { IMPORT_TRANSACTION_PORT, type ImportTransactionPort } from '@domain/inventory/catalog/import/import-transaction.port';

@Injectable()
export class ImportCatalogUseCase {
  constructor(
    @Inject(PRODUCT_PORT) private readonly products: ProductPort,
    private readonly confirmDocument: ConfirmDocumentUseCase,
    @Optional() @Inject(IMPORT_TRANSACTION_PORT) private readonly transaction?: ImportTransactionPort,
    @Optional() @Inject(LEDGER_PORT) private readonly ledger?: InventoryLedgerPort,
  ) {}

  async execute(csv: string, companyId: string, companyCostingMethod: CostingMethod, receivedAt: string): Promise<ConfirmedDocument | null> {
    const imported = parseCatalog(parseCsv(csv), companyId, receivedAt);
    const digest = createHash('sha256').update(csv.trim()).digest('hex');
    imported.document.idempotencyKey = `catalog:${digest}`;
    const work = async (): Promise<ConfirmedDocument | null> => {
      const existing = await findExistingImport(this.ledger, imported.document, companyId);
      if (existing) return existing;
      for (const row of imported.rows) {
        await this.products.save(toProduct(row, companyId));
      }
      if (imported.document.lines.length === 0) return null;
      return this.confirmDocument.execute({ draft: imported.document, companyCostingMethod, receivedAt });
    };
    if (this.transaction === undefined) return work();
    const execution = await this.transaction.run(companyId, imported.document.idempotencyKey, work);
    if (execution.executed) return execution.result;
    return this.ledger?.findByIdempotency(companyId, imported.document.idempotencyKey) ?? null;
  }
}

async function findExistingImport(
  ledger: InventoryLedgerPort | undefined,
  document: DraftDocument,
  companyId: string,
): Promise<ConfirmedDocument | null | undefined> {
  if (document.lines.length === 0) return null;
  return ledger?.findByIdempotency(companyId, document.idempotencyKey);
}

function toProduct(row: CatalogRow, companyId: string): Product {
  const shelf = reclassifyShelf({ name: row.name, category: row.category, supplier: null });
  return {
    id: row.sku,
    companyId,
    name: row.name,
    category: shelf.category,
    supplier: shelf.supplier,
    baseUnit: row.baseUnit,
    tracksExpiry: row.expiresOn !== null,
    costingMethod: null,
    marginPercent: null,
    taxCategoryCode: 'none',
    active: true,
    internalBarcode: row.sku,
    presentations: [
      {
        unit: row.presentation,
        factor: row.factor,
        purchasable: true,
        sellable: true,
        salePrice: row.salePrice,
        manufacturerBarcode: row.manufacturerBarcode,
      },
    ],
  };
}
