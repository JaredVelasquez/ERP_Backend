import { PriceError, type PriceChange } from '@domain/inventory/catalog/product/price';
import type { PricePort } from '@domain/inventory/catalog/product/price.port';
import type { Product } from '@domain/inventory/catalog/product/product';
import type { ProductPort } from '@domain/inventory/catalog/product/product.port';
import { readProductSort, sortProducts } from '@domain/inventory/catalog/product/product-sort';
import { slicePage, type Page, type PageRequest } from '@domain/workspace/company-list/page';

export class InMemoryProductRepository implements ProductPort, PricePort {
  private products = new Map<string, Product>();
  private priceHistory = new Map<string, PriceChange[]>();
  private readonly sequences = new Map<string, number>();

  async nextSequence(companyId: string): Promise<number> {
    const next = (this.sequences.get(companyId) ?? 0) + 1;
    this.sequences.set(companyId, next);
    return next;
  }

  async save(product: Product): Promise<void> {
    this.products.set(key(product.companyId, product.id), product);
  }

  async find(companyId: string, productId: string): Promise<Product | null> {
    return this.products.get(key(companyId, productId)) ?? null;
  }

  async list(companyId: string): Promise<Product[]> {
    const products: Product[] = [];
    for (const product of this.products.values()) {
      pushCompanyProduct(products, product, companyId);
    }
    return products;
  }

  async listPage(companyId: string, request: PageRequest): Promise<Page<Product>> {
    return slicePage(orderedMatches(await this.list(companyId), request), request);
  }

  async record(product: Product, change: PriceChange): Promise<void> {
    if (!this.products.has(key(product.companyId, product.id))) {
      throw new PriceError('Product was not found');
    }
    const products = new Map(this.products);
    const priceHistory = new Map(this.priceHistory);
    products.set(key(product.companyId, product.id), product);
    priceHistory.set(product.id, [...(priceHistory.get(product.id) ?? []), change]);
    this.products = products;
    this.priceHistory = priceHistory;
  }

  async history(companyId: string, productId: string): Promise<PriceChange[]> {
    return (this.priceHistory.get(productId) ?? []).filter((change) => change.companyId === companyId);
  }

  async historyForCompany(companyId: string): Promise<PriceChange[]> {
    const changes: PriceChange[] = [];
    for (const history of this.priceHistory.values()) {
      pushCompanyChanges(changes, history, companyId);
    }
    return changes;
  }
}

function orderedMatches(products: readonly Product[], request: PageRequest): Product[] {
  const matched: Product[] = [];
  for (const product of products) {
    pushSearchMatch(matched, product, request);
  }
  return sortProducts(matched, readProductSort(request.sort));
}

function pushSearchMatch(matched: Product[], product: Product, request: PageRequest): void {
  if (request.search !== '' && !productHaystack(product).includes(request.search.toLocaleLowerCase('es-HN'))) {
    return;
  }
  matched.push(product);
}

function productHaystack(product: Product): string {
  return [product.name, product.category, product.supplier ?? '', product.internalBarcode, ...manufacturerCodes(product)]
    .join(' ')
    .toLocaleLowerCase('es-HN');
}

function manufacturerCodes(product: Product): string[] {
  return product.presentations.map((item) => item.manufacturerBarcode ?? '');
}

function pushCompanyProduct(products: Product[], product: Product, companyId: string): void {
  if (product.companyId !== companyId) {
    return;
  }
  products.push(product);
}

function pushCompanyChanges(changes: PriceChange[], history: readonly PriceChange[], companyId: string): void {
  for (const change of history) {
    pushCompanyChange(changes, change, companyId);
  }
}

function pushCompanyChange(changes: PriceChange[], change: PriceChange, companyId: string): void {
  if (change.companyId !== companyId) {
    return;
  }
  changes.push(change);
}

function key(companyId: string, productId: string): string {
  return `${companyId}:${productId}`;
}
