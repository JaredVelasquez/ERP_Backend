import { ProductError, type Presentation, type Product } from '@domain/inventory/product';

export interface ResolvedCode {
  product: Product;
  presentation: Presentation | null;
  manufacturerBarcode: string | null;
}

interface ManufacturerHit {
  product: Product;
  presentation: Presentation;
}

export function resolveCompanyCode(products: readonly Product[], code: string): ResolvedCode {
  const normalized = code.trim();
  if (normalized === '') {
    throw new ProductError('Barcode is required');
  }
  const internal = matchInternal(products, normalized);
  if (internal !== null) {
    return internal;
  }
  return matchManufacturer(products, normalized);
}

function matchInternal(products: readonly Product[], code: string): ResolvedCode | null {
  const matches = products.filter((product) => product.internalBarcode === code);
  if (matches.length === 0) {
    return null;
  }
  return oneActive(matches, 'Barcode is duplicated');
}

function matchManufacturer(products: readonly Product[], code: string): ResolvedCode {
  const matches = collectManufacturer(products, code);
  if (matches.length === 0) {
    throw new ProductError('Product was not found');
  }
  const active = matches.filter((hit) => hit.product.active);
  if (active.length !== 1) {
    throw new ProductError(active.length === 0 ? 'Product is inactive' : 'Manufacturer barcode is duplicated');
  }
  const hit = active[0];
  if (hit === undefined) {
    throw new ProductError('Product was not found');
  }
  return { product: hit.product, presentation: hit.presentation, manufacturerBarcode: code };
}

function oneActive(matches: readonly Product[], duplicateMessage: string): ResolvedCode {
  const active = matches.filter((product) => product.active);
  if (active.length !== 1) {
    throw new ProductError(active.length === 0 ? 'Product is inactive' : duplicateMessage);
  }
  const product = active[0];
  if (product === undefined) {
    throw new ProductError('Product was not found');
  }
  return { product, presentation: null, manufacturerBarcode: null };
}

function collectManufacturer(products: readonly Product[], code: string): ManufacturerHit[] {
  const hits: ManufacturerHit[] = [];
  for (const product of products) {
    pushManufacturerHits(hits, product, code);
  }
  return hits;
}

function pushManufacturerHits(hits: ManufacturerHit[], product: Product, code: string): void {
  for (const presentation of product.presentations) {
    pushManufacturerHit(hits, product, presentation, code);
  }
}

function pushManufacturerHit(hits: ManufacturerHit[], product: Product, presentation: Presentation, code: string): void {
  if (presentation.manufacturerBarcode !== code) {
    return;
  }
  hits.push({ product, presentation });
}
