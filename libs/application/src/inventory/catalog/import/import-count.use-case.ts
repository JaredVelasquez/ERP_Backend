import { Inject, Injectable } from '@nestjs/common';
import { parseCount, parseCsv, type CountImport } from '@domain/inventory/catalog/import/spreadsheet';
import { LEDGER_PORT, type InventoryLedgerPort } from '@domain/inventory/stock/ledger/ledger.port';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/catalog/product/product.port';

@Injectable()
export class ImportCountUseCase {
  constructor(
    @Inject(PRODUCT_PORT) private readonly products: ProductPort,
    @Inject(LEDGER_PORT) private readonly ledger: InventoryLedgerPort,
  ) {}

  async execute(csv: string, companyId: string): Promise<CountImport> {
    const products = await this.products.list(companyId);
    const stock = await this.ledger.loadStock(companyId, products.map((product) => product.id));
    const onHand: Record<string, number> = {};
    for (const row of stock) {
      onHand[row.productId] = onHandQuantity(row.layers);
    }
    return parseCount(parseCsv(csv), onHand, companyId);
  }
}

function onHandQuantity(layers: readonly { quantity: number }[]): number {
  return layers.reduce((sum, layer) => sum + layer.quantity, 0);
}
