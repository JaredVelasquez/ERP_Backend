import { encodeCode128, renderBarcodeSvg } from '@domain/inventory/catalog/barcode-sheet/barcode';
import type { BarcodePort, BarcodePreview } from '@domain/inventory/catalog/product/product.port';
import { renderBarcodePng } from '@infrastructure/catalog/barcode-sheet/barcode/png-barcode';

export class Code128BarcodeAdapter implements BarcodePort {
  preview(code: string): BarcodePreview {
    const modules = encodeCode128(code);
    return {
      code,
      svg: renderBarcodeSvg(code, modules),
      pngBase64: renderBarcodePng(modules).toString('base64'),
    };
  }
}
