import { Inject, Injectable } from '@nestjs/common';
import { assembleBarcodeLabels, assertBarcodeSheetIds, type BarcodeSheetLabel } from '@domain/inventory/barcode-sheet';
import { BarcodeError } from '@domain/inventory/barcode';
import { PDF_PORT, type BarcodeSheetPage, type PdfPort } from '@domain/inventory/pdf.port';
import { ProductError, type Product } from '@domain/inventory/product';
import { BARCODE_PORT, PRODUCT_PORT, type BarcodePort, type ProductPort } from '@domain/inventory/product.port';

@Injectable()
export class RenderBarcodeSheetUseCase {
  constructor(
    @Inject(PRODUCT_PORT) private readonly products: ProductPort,
    @Inject(BARCODE_PORT) private readonly barcodes: BarcodePort,
    @Inject(PDF_PORT) private readonly pdf: PdfPort,
  ) {}

  async execute(companyId: string, productIds: readonly string[]): Promise<Buffer> {
    if (companyId.trim() === '') {
      throw new ProductError('companyId is required');
    }
    assertBarcodeSheetIds(productIds);
    const labels = assembleBarcodeLabels(await this.loadActive(companyId, productIds));
    return this.pdf.renderBarcodeSheet(paintSheet(this.barcodes, labels));
  }

  private async loadActive(companyId: string, productIds: readonly string[]): Promise<Product[]> {
    const loaded: Product[] = [];
    for (const productId of productIds) {
      loaded.push(await this.requireActive(companyId, productId));
    }
    return loaded;
  }

  private async requireActive(companyId: string, productId: string): Promise<Product> {
    const product = await this.products.find(companyId, productId);
    if (product === null) {
      throw new BarcodeError('Product was not found');
    }
    if (!product.active) {
      throw new BarcodeError('Product is inactive');
    }
    return product;
  }
}

function paintSheet(barcodes: BarcodePort, labels: readonly BarcodeSheetLabel[]): BarcodeSheetPage[] {
  return labels.map((label) => paintLabel(barcodes, label));
}

function paintLabel(barcodes: BarcodePort, label: BarcodeSheetLabel): BarcodeSheetPage {
  const preview = barcodes.preview(label.internalBarcode);
  if (preview.code !== label.internalBarcode) {
    throw new BarcodeError('Internal barcode must stay the stored code');
  }
  return { name: label.name, internalBarcode: label.internalBarcode, pngBase64: preview.pngBase64 };
}
