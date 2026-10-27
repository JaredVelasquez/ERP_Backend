import type { PriceChange } from '@domain/inventory/catalog/product/price';
import type { Product } from '@domain/inventory/catalog/product/product';

export interface PricePort {
  record(product: Product, change: PriceChange): Promise<void>;
  history(companyId: string, productId: string): Promise<PriceChange[]>;
  historyForCompany(companyId: string): Promise<PriceChange[]>;
}

export const PRICE_PORT = Symbol('PRICE_PORT');
