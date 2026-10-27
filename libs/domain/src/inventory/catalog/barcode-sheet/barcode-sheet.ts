import { BarcodeError } from '@domain/inventory/catalog/barcode-sheet/barcode';
import type { Product } from '@domain/inventory/catalog/product/product';

export interface BarcodeSheetLabel {
  productId: string;
  name: string;
  internalBarcode: string;
}

export function assertBarcodeSheetIds(productIds: readonly string[]): void {
  if (productIds.length === 0) {
    throw new BarcodeError('Barcode sheet needs a product');
  }
  const seen = new Set<string>();
  for (const productId of productIds) {
    rememberSheetId(seen, productId);
  }
}

export function assembleBarcodeLabels(products: readonly Product[]): BarcodeSheetLabel[] {
  if (products.length === 0) {
    throw new BarcodeError('Barcode sheet needs a product');
  }
  const seen = new Set<string>();
  return products.map((product) => toSheetLabel(seen, product));
}

function rememberSheetId(seen: Set<string>, productId: string): void {
  if (productId.trim() === '') {
    throw new BarcodeError('Product id is required');
  }
  if (seen.has(productId)) {
    throw new BarcodeError('Product is duplicated');
  }
  seen.add(productId);
}

function toSheetLabel(seen: Set<string>, product: Product): BarcodeSheetLabel {
  if (seen.has(product.id)) {
    throw new BarcodeError('Product is duplicated');
  }
  seen.add(product.id);
  if (product.internalBarcode.trim() === '') {
    throw new BarcodeError('Internal barcode is required');
  }
  return {
    productId: product.id,
    name: product.name,
    internalBarcode: product.internalBarcode,
  };
}
