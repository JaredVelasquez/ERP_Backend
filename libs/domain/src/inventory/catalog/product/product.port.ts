import type { Product } from '@domain/inventory/catalog/product/product';
import type { Page, PageRequest } from '@domain/workspace/company-list/page';

export interface ProductPort {
  nextSequence(companyId: string): Promise<number>;
  save(product: Product): Promise<void>;
  find(companyId: string, productId: string): Promise<Product | null>;
  list(companyId: string): Promise<Product[]>;
  listPage(companyId: string, request: PageRequest): Promise<Page<Product>>;
}

export const PRODUCT_PORT = Symbol('PRODUCT_PORT');

export interface BarcodePreview {
  code: string;
  svg: string;
  pngBase64: string;
}

export interface BarcodePort {
  preview(code: string): BarcodePreview;
}

export const BARCODE_PORT = Symbol('BARCODE_PORT');
