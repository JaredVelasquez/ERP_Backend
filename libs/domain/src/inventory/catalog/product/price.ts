import { roundMoney } from '@domain/inventory/catalog/costing/costing';

export class PriceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PriceError';
  }
}

export interface PriceChange {
  id: string;
  companyId: string;
  productId: string;
  unit: string;
  previousPrice: number | null;
  nextPrice: number;
  reason: string;
  actorId: string;
  at: string;
}

export function priceFromMargin(cost: number, marginPercent: number | null): number | null {
  if (cost < 0) {
    throw new PriceError('Cost cannot be negative');
  }
  if (marginPercent === null) {
    return null;
  }
  if (marginPercent < 0) {
    throw new PriceError('Margin cannot be negative');
  }
  return roundMoney(cost * (1 + marginPercent / 100));
}

export function resolveMarginPercent(productPercent: number | null, companyPercent: number | null): number | null {
  if (productPercent !== null) {
    return productPercent;
  }
  return companyPercent;
}
