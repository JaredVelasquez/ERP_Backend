import { Inject, Injectable } from '@nestjs/common';
import { ProductError, type Product } from '@domain/inventory/catalog/product/product';
import { PRODUCT_PORT, type CatalogItemTypeFilter, type ProductPort } from '@domain/inventory/catalog/product/product.port';
import { readPageRequest, type Page } from '@domain/workspace/company-list/page';

@Injectable()
export class ListProductsUseCase {
  constructor(@Inject(PRODUCT_PORT) private readonly products: ProductPort) {}

  async execute(companyId: string, pageText = '1', sizeText = '25', search = '', sort = '', itemType: CatalogItemTypeFilter = 'product'): Promise<Page<Product>> {
    if (companyId.trim() === '') {
      throw new ProductError('companyId is required');
    }
    if (itemType !== 'product' && itemType !== 'service' && itemType !== 'all') throw new ProductError('itemType is not supported');
    return this.products.listPage(companyId, readPageRequest(pageText, sizeText, search, sort), itemType);
  }
}
