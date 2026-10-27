import { Inject, Injectable } from '@nestjs/common';
import { ProductError } from '@domain/inventory/catalog/product/product';
import { BARCODE_PORT, PRODUCT_PORT, type BarcodePort, type BarcodePreview, type ProductPort } from '@domain/inventory/catalog/product/product.port';

@Injectable()
export class PreviewBarcodeUseCase {
  constructor(
    @Inject(PRODUCT_PORT) private readonly products: ProductPort,
    @Inject(BARCODE_PORT) private readonly barcodes: BarcodePort,
  ) {}

  async execute(companyId: string, productId: string): Promise<BarcodePreview> {
    const product = await this.products.find(companyId, productId);
    if (product === null) {
      throw new ProductError('Product was not found');
    }
    return this.barcodes.preview(product.internalBarcode);
  }
}
