import { Inject, Injectable } from '@nestjs/common';
import { ProductError, type Product } from '@domain/inventory/product';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/product.port';
import { readPageRequest, type Page } from '@domain/workspace/page';

@Injectable()
export class ListProductsUseCase {
  constructor(@Inject(PRODUCT_PORT) private readonly products: ProductPort) {}

  async execute(companyId: string, pageText = '1', sizeText = '25', search = '', sort = ''): Promise<Page<Product>> {
    if (companyId.trim() === '') {
      throw new ProductError('companyId is required');
    }
    return this.products.listPage(companyId, readPageRequest(pageText, sizeText, search, sort));
  }
}
