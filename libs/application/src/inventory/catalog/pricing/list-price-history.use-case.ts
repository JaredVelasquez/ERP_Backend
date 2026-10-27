import { Inject, Injectable } from '@nestjs/common';
import { PriceError, type PriceChange } from '@domain/inventory/catalog/product/price';
import { PRICE_PORT, type PricePort } from '@domain/inventory/catalog/product/price.port';

@Injectable()
export class ListPriceHistoryUseCase {
  constructor(@Inject(PRICE_PORT) private readonly prices: PricePort) {}

  async execute(companyId: string): Promise<PriceChange[]> {
    if (companyId.trim() === '') {
      throw new PriceError('companyId is required');
    }
    return this.prices.historyForCompany(companyId);
  }
}
