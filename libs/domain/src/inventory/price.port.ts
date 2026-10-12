import type { PriceChange } from '@domain/inventory/price';
import type { Product } from '@domain/inventory/product';

export interface PricePort {
  record(product: Product, change: PriceChange): Promise<void>;
  history(companyId: string, productId: string): Promise<PriceChange[]>;
  historyForCompany(companyId: string): Promise<PriceChange[]>;
}

export const PRICE_PORT = Symbol('PRICE_PORT');
