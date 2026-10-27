import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PriceError, type PriceChange } from '@domain/inventory/catalog/product/price';
import { PRICE_PORT, type PricePort } from '@domain/inventory/catalog/product/price.port';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/catalog/product/product.port';
import type { Product } from '@domain/inventory/catalog/product/product';

export interface ChangePriceCommand {
  companyId: string;
  productId: string;
  unit: string;
  nextPrice: number;
  reason: string;
  actorId: string;
  at: string;
}

@Injectable()
export class ChangePriceUseCase {
  constructor(
    @Inject(PRODUCT_PORT) private readonly products: ProductPort,
    @Inject(PRICE_PORT) private readonly prices: PricePort,
  ) {}

  async execute(command: ChangePriceCommand): Promise<PriceChange> {
    if (command.reason.trim() === '') {
      throw new PriceError('A price change needs a reason');
    }
    if (command.nextPrice < 0) {
      throw new PriceError('Price cannot be negative');
    }
    const product = await this.products.find(command.companyId, command.productId);
    if (product === null) {
      throw new PriceError('Product was not found');
    }
    const current = presentation(product, command.unit);
    const change: PriceChange = {
      id: randomUUID(),
      companyId: command.companyId,
      productId: command.productId,
      unit: command.unit,
      previousPrice: current.salePrice,
      nextPrice: command.nextPrice,
      reason: command.reason.trim(),
      actorId: command.actorId,
      at: command.at,
    };
    await this.prices.record(replacePrice(product, command.unit, command.nextPrice), change);
    return change;
  }
}

export function presentation(product: Product, unit: string): Product['presentations'][number] {
  const found = product.presentations.find((item) => item.unit === unit);
  if (found === undefined) {
    throw new PriceError('Presentation was not found');
  }
  return found;
}

export function replacePrice(product: Product, unit: string, nextPrice: number): Product {
  return {
    ...product,
    presentations: product.presentations.map((item) => (item.unit === unit ? { ...item, salePrice: nextPrice } : item)),
  };
}
