import type { Presentation, Product } from '@domain/inventory/product';

export type ProductSortColumn =
  | 'name'
  | 'category'
  | 'supplier'
  | 'presentation'
  | 'factor'
  | 'barcode'
  | 'salePrice'
  | 'stock';

export type ProductSortDirection = 'asc' | 'desc';

export interface ProductSort {
  column: ProductSortColumn;
  direction: ProductSortDirection;
}

const COLUMNS: Record<string, ProductSortColumn | undefined> = {
  name: 'name',
  category: 'category',
  supplier: 'supplier',
  presentation: 'presentation',
  factor: 'factor',
  barcode: 'barcode',
  salePrice: 'salePrice',
  stock: 'stock',
};

const DIRECTIONS: Record<string, ProductSortDirection | undefined> = {
  asc: 'asc',
  desc: 'desc',
};

const SORT_VALUE: Record<ProductSortColumn, (product: Product) => string | number> = {
  name: (product) => product.name,
  category: (product) => product.category,
  supplier: (product) => product.supplier ?? '',
  presentation: (product) => shelfOf(product).unit,
  factor: (product) => shelfOf(product).factor,
  barcode: (product) => product.internalBarcode,
  salePrice: (product) => shelfOf(product).salePrice ?? Number.NEGATIVE_INFINITY,
  stock: () => 0,
};

export function readProductSort(raw: string): ProductSort {
  const separator = raw.indexOf(':');
  const columnText = separator < 0 ? raw : raw.slice(0, separator);
  const directionText = separator < 0 ? '' : raw.slice(separator + 1);
  return {
    column: COLUMNS[columnText.trim()] ?? 'name',
    direction: DIRECTIONS[directionText.trim()] ?? 'asc',
  };
}

export function sortProducts(products: readonly Product[], sort: ProductSort): Product[] {
  return [...products].sort((left, right) => compareProducts(left, right, sort));
}

function compareProducts(left: Product, right: Product, sort: ProductSort): number {
  const compared = compareValues(SORT_VALUE[sort.column](left), SORT_VALUE[sort.column](right));
  if (compared !== 0) {
    return directed(compared, sort.direction);
  }
  return left.id.localeCompare(right.id);
}

function directed(compared: number, direction: ProductSortDirection): number {
  if (direction === 'desc') {
    return -compared;
  }
  return compared;
}

function compareValues(left: string | number, right: string | number): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return String(left).localeCompare(String(right), 'es', { numeric: true, sensitivity: 'base' });
}

function shelfOf(product: Product): Presentation {
  const preferred = product.presentations.find((item) => item.unit === 'unidad');
  const shelf = preferred ?? product.presentations[0];
  if (shelf !== undefined) {
    return shelf;
  }
  return {
    unit: '',
    factor: 0,
    purchasable: false,
    sellable: false,
    salePrice: null,
    manufacturerBarcode: null,
  };
}
