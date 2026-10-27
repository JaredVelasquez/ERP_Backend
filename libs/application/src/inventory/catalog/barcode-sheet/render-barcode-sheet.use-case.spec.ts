import { RenderBarcodeSheetUseCase } from '@application/inventory/catalog/barcode-sheet/render-barcode-sheet.use-case';
import type { Product } from '@domain/inventory/catalog/product/product';
import type { BarcodePort, BarcodePreview, ProductPort } from '@domain/inventory/catalog/product/product.port';
import type { BarcodeSheetPage, PdfPort } from '@domain/inventory/catalog/barcode-sheet/pdf.port';
import type { Page, PageRequest } from '@domain/workspace/company-list/page';

describe('render barcode sheet', () => {
  it('sends the stored codes to the pdf and does not save the sheet', async () => {
    const products = new MemoryProducts();
    const pdf = new RecordingPdf();
    await products.save(sample('sku-1', 'company-1', '00000042', true));
    await products.save(sample('sku-2', 'company-1', '00000007', true));
    products.saves = 0;
    const useCase = new RenderBarcodeSheetUseCase(products, new EchoBarcode(), pdf);

    await useCase.execute('company-1', ['sku-1']);
    await useCase.execute('company-1', ['sku-1', 'sku-2']);

    expect(pdf.pages[0]?.map((page) => page.internalBarcode)).toEqual(['00000042']);
    expect(pdf.pages[1]?.map((page) => page.internalBarcode)).toEqual(['00000042', '00000007']);
    expect(products.saves).toBe(0);
  });

  it('does not render a pdf for a foreign, unknown, inactive, or empty id list', async () => {
    const products = new MemoryProducts();
    const pdf = new RecordingPdf();
    await products.save(sample('sku-1', 'company-2', '00000042', true));
    await products.save(sample('sku-2', 'company-1', '00000007', false));
    const useCase = new RenderBarcodeSheetUseCase(products, new EchoBarcode(), pdf);

    await expect(useCase.execute('company-1', ['sku-1'])).rejects.toThrow('Product was not found');
    await expect(useCase.execute('company-1', ['missing'])).rejects.toThrow('Product was not found');
    await expect(useCase.execute('company-1', ['sku-2'])).rejects.toThrow('Product is inactive');
    await expect(useCase.execute('company-1', [])).rejects.toThrow('Barcode sheet needs a product');
    expect(pdf.pages).toEqual([]);
  });
});

class EchoBarcode implements BarcodePort {
  preview(code: string): BarcodePreview {
    return { code, svg: `<svg>${code}</svg>`, pngBase64: `png-${code}` };
  }
}

class RecordingPdf implements PdfPort {
  readonly pages: BarcodeSheetPage[][] = [];

  renderBarcodeSheet(pages: readonly BarcodeSheetPage[]): Buffer {
    this.pages.push([...pages]);
    return Buffer.from(pages.map((page) => page.internalBarcode).join(','));
  }
}

class MemoryProducts implements ProductPort {
  saves = 0;
  private readonly rows = new Map<string, Product>();

  async nextSequence(): Promise<number> {
    return 1;
  }

  async save(product: Product): Promise<void> {
    this.saves += 1;
    this.rows.set(`${product.companyId}:${product.id}`, product);
  }

  async find(companyId: string, productId: string): Promise<Product | null> {
    return this.rows.get(`${companyId}:${productId}`) ?? null;
  }

  async list(companyId: string): Promise<Product[]> {
    return [...this.rows.values()].filter((product) => product.companyId === companyId);
  }

  async listPage(_companyId: string, request: PageRequest): Promise<Page<Product>> {
    return { items: [], page: request.page, pageSize: request.pageSize, total: 0 };
  }
}

function sample(id: string, companyId: string, internalBarcode: string, active: boolean): Product {
  return {
    id,
    companyId,
    name: 'Arroz',
    category: 'Abarrotes',
    baseUnit: 'unidad',
    tracksExpiry: false,
    costingMethod: null,
    marginPercent: null,
    taxCategoryCode: 'none',
    active,
    internalBarcode,
    presentations: [
      { unit: 'unidad', factor: 1, purchasable: true, sellable: true, salePrice: 20, manufacturerBarcode: null },
    ],
  };
}
