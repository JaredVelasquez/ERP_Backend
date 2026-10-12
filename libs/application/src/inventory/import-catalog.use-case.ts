import { Inject, Injectable } from '@nestjs/common';
import { ConfirmDocumentUseCase } from '@application/inventory/confirm-document.use-case';
import type { ConfirmedDocument } from '@domain/inventory/ledger.port';
import type { CostingMethod } from '@domain/inventory/costing';
import { parseCatalog, parseCsv, type CatalogRow } from '@domain/inventory/spreadsheet';
import type { Product } from '@domain/inventory/product';
import { reclassifyShelf } from '@domain/inventory/shelf';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/product.port';

@Injectable()
export class ImportCatalogUseCase {
  constructor(
    @Inject(PRODUCT_PORT) private readonly products: ProductPort,
    private readonly confirmDocument: ConfirmDocumentUseCase,
  ) {}

  async execute(csv: string, companyId: string, companyCostingMethod: CostingMethod, receivedAt: string): Promise<ConfirmedDocument | null> {
    const imported = parseCatalog(parseCsv(csv), companyId, receivedAt);
    await Promise.all(imported.rows.map((row) => this.products.save(toProduct(row, companyId))));
    if (imported.document.lines.length === 0) {
      return null;
    }
    return this.confirmDocument.execute({ draft: imported.document, companyCostingMethod, receivedAt });
  }
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
