import type { CostLayer, CostingMethod } from '@domain/inventory/catalog/costing/costing';
import { onHandQuantity, quoteIssueUnitCost } from '@domain/inventory/catalog/costing/costing';
import type { Presentation, Product } from '@domain/inventory/catalog/product/product';

export interface StockCardView {
  productId: string;
  name: string;
  internalBarcode: string;
  manufacturerBarcode: string | null;
  resolvedUnit: string | null;
  baseQuantity: number;
  unitCost: number | null;
  presentations: Array<{ unit: string; factor: number; salePrice: number | null; purchasable: boolean; sellable: boolean }>;
}

export function buildStockCard(input: {
  product: Product;
  layers: readonly CostLayer[];
  method: CostingMethod;
  manufacturerBarcode: string | null;
  resolvedUnit: string | null;
}): StockCardView {
  return {
    productId: input.product.id,
    name: input.product.name,
    internalBarcode: input.product.internalBarcode,
    manufacturerBarcode: input.manufacturerBarcode,
    resolvedUnit: input.resolvedUnit,
    baseQuantity: onHandQuantity(input.layers),
    unitCost: quoteIssueUnitCost(input.method, input.layers),
    presentations: input.product.presentations.map(cardPresentation),
  };
}

function cardPresentation(presentation: Presentation): StockCardView['presentations'][number] {
  return {
    unit: presentation.unit,
    factor: presentation.factor,
    salePrice: presentation.salePrice,
    purchasable: presentation.purchasable,
    sellable: presentation.sellable,
  };
}
