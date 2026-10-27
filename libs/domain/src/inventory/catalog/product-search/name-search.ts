import { ProductError, type Presentation, type Product } from '@domain/inventory/catalog/product/product';

export interface ProductNameHit {
  id: string;
  name: string;
  supplier: string | null;
  internalBarcode: string;
  presentations: Array<{ unit: string; factor: number; salePrice: number | null }>;
}

export function filterProductsByName(products: readonly Product[], query: string): Product[] {
  const fragment = query.trim().toLocaleLowerCase('es-HN');
  if (fragment === '') {
    throw new ProductError('Search text is required');
  }
  return products.filter((product) => product.active && [product.name, product.supplier ?? '', product.internalBarcode,
    ...product.presentations.map((presentation) => presentation.manufacturerBarcode ?? '')]
    .some((value) => value.toLocaleLowerCase('es-HN').includes(fragment)));
}

export function toNameHit(product: Product): ProductNameHit {
  return {
    id: product.id,
    name: product.name,
    supplier: product.supplier ?? null,
    internalBarcode: product.internalBarcode,
    presentations: product.presentations.map(presentationHit),
  };
}

function presentationHit(presentation: Presentation): ProductNameHit['presentations'][number] {
  return { unit: presentation.unit, factor: presentation.factor, salePrice: presentation.salePrice };
}
