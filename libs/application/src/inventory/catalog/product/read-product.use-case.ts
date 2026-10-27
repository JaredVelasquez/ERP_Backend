import { Inject, Injectable } from '@nestjs/common';
import { ProductError } from '@domain/inventory/catalog/product/product';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/catalog/product/product.port';

@Injectable()
export class ReadProductUseCase {
  constructor(@Inject(PRODUCT_PORT) private readonly products: ProductPort) {}

  async execute(companyId: string, productId: string) {
    if (!productId?.trim()) throw new ProductError('productId is required');
    const product = await this.products.find(companyId, productId);
    if (product === null) throw new ProductError('Product was not found');
    return product;
  }
}
