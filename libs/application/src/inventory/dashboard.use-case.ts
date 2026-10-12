import { Inject, Injectable } from '@nestjs/common';
import { buildDashboard, inventoryValue, lastDays, type Dashboard } from '@domain/inventory/report';
import { LEDGER_PORT, type InventoryLedgerPort } from '@domain/inventory/ledger.port';
import { PRICE_PORT, type PricePort } from '@domain/inventory/price.port';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/product.port';

@Injectable()
export class DashboardUseCase {
  constructor(
    @Inject(LEDGER_PORT) private readonly ledger: InventoryLedgerPort,
    @Inject(PRODUCT_PORT) private readonly products: ProductPort,
    @Inject(PRICE_PORT) private readonly prices: PricePort,
  ) {}

  async execute(companyId: string, to: string, days = 30): Promise<Dashboard & { inventory: { quantity: number; value: number } }> {
    const period = lastDays(to, days);
    const documents = await this.ledger.listDocuments(companyId);
    const products = await this.products.list(companyId);
    const prices = await this.prices.historyForCompany(companyId);
    const stock = await this.ledger.loadStock(companyId, products.map((product) => product.id));
    return {
      ...buildDashboard({
        ...period,
        documents,
        prices,
        activeProductIds: products.filter((product) => product.active).map((product) => product.id),
      }),
      inventory: inventoryValue(stock.flatMap((row) => row.layers)),
    };
  }
}
