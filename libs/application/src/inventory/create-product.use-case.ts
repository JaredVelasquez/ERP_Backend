import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { formatInternalBarcode } from '@domain/inventory/barcode';
import type { CostingMethod } from '@domain/inventory/costing';
import { ProductError, assertPresentation, type Presentation, type Product } from '@domain/inventory/product';
import { reclassifyShelf } from '@domain/inventory/shelf';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/product.port';

export interface CreateProductInput {
  companyId: string;
  name: string;
  category: string;
  baseUnit: string;
  tracksExpiry: boolean;
  costingMethod: CostingMethod | null;
  marginPercent: number | null;
  taxCategoryCode: string;
  presentations: Presentation[];
}

@Injectable()
export class CreateProductUseCase {
  constructor(@Inject(PRODUCT_PORT) private readonly products: ProductPort) {}

  async execute(input: CreateProductInput): Promise<Product> {
    assertProduct(input);
    const shelf = reclassifyShelf({ name: input.name, category: input.category, supplier: null });
    const product: Product = {
      id: randomUUID(),
      companyId: input.companyId,
      name: input.name.trim(),
      category: shelf.category,
      supplier: shelf.supplier,
      baseUnit: input.baseUnit.trim(),
      tracksExpiry: input.tracksExpiry,
      costingMethod: input.costingMethod,
      marginPercent: input.marginPercent,
      taxCategoryCode: input.taxCategoryCode,
      active: true,
      internalBarcode: formatInternalBarcode(await this.products.nextSequence(input.companyId)),
      presentations: input.presentations.map((presentation) => ({ ...presentation })),
    };
    await this.products.save(product);
    return product;
  }
}

function assertProduct(input: CreateProductInput): void {
  if (input.companyId.trim() === '' || input.name.trim() === '' || input.baseUnit.trim() === '') {
    throw new ProductError('Company, name, and base unit are required');
  }
  if (input.presentations.length === 0) {
    throw new ProductError('A product needs a presentation');
  }
  for (const presentation of input.presentations) {
    assertPresentation(presentation);
  }
}
