import { roundMoney, roundQuantity } from '@domain/inventory/costing';
import type { CostingMethod } from '@domain/inventory/costing';

export class ProductError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductError';
  }
}

export interface Presentation {
  unit: string;
  factor: number;
  purchasable: boolean;
  sellable: boolean;
  salePrice: number | null;
  manufacturerBarcode: string | null;
}

export interface Product {
  id: string;
  companyId: string;
  name: string;
  category: string;
  supplier?: string | null;
  baseUnit: string;
  tracksExpiry: boolean;
  costingMethod: CostingMethod | null;
  marginPercent: number | null;
  taxCategoryCode: string;
  active: boolean;
  internalBarcode: string;
  presentations: Presentation[];
}

export function toBaseQuantity(factor: number, quantity: number): number {
  if (factor <= 0 || quantity <= 0) {
    throw new ProductError('Quantity and factor must be greater than zero');
  }
  return roundQuantity(factor * quantity);
}

export function unitCostFromPack(packCost: number, factor: number): number {
  if (factor <= 0 || packCost < 0) {
    throw new ProductError('Pack cost needs a positive factor');
  }
  return roundMoney(packCost / factor);
}

export function assertPresentation(presentation: Presentation): void {
  if (presentation.factor <= 0) {
    throw new ProductError('Factor must be greater than zero');
  }
  if (presentation.unit.trim() === '') {
    throw new ProductError('Presentation unit is required');
  }
  if (presentation.sellable && presentation.salePrice === null) {
    throw new ProductError('A sellable presentation needs a price');
  }
  if (presentation.manufacturerBarcode !== null && presentation.manufacturerBarcode.trim() === '') {
    throw new ProductError('Manufacturer barcode cannot be blank');
  }
}
