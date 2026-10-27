import { Inject, Injectable } from '@nestjs/common';
import { filterProductsByName, toNameHit, type ProductNameHit } from '@domain/inventory/catalog/product-search/name-search';
import { ProductError } from '@domain/inventory/catalog/product/product';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/catalog/product/product.port';

@Injectable()
export class SearchProductsByNameUseCase {
  constructor(@Inject(PRODUCT_PORT) private readonly products: ProductPort) {}

  async execute(companyId: string, query: string): Promise<ProductNameHit[]> {
    if (companyId.trim() === '') {
      throw new ProductError('companyId is required');
    }
    const hits = filterProductsByName(await this.products.list(companyId), query);
    return hits.map(toNameHit);
  }
}
