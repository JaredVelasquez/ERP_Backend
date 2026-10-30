import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { formatInternalBarcode } from '@domain/inventory/catalog/barcode-sheet/barcode';
import type { CostingMethod } from '@domain/inventory/catalog/costing/costing';
import type { SessionRecord } from '@domain/identity/session/session.port';
import { PermissionDeniedError } from '@domain/identity/membership/module-access';
import { PRICE_WORKFLOW_PORT, type PriceWorkflowPort } from '@domain/inventory/catalog/pricing/price-workflow.port';
import { ProductError, assertPresentation, type Presentation, type Product } from '@domain/inventory/catalog/product/product';
import { reclassifyShelf } from '@domain/inventory/stock/shelf/shelf';
import { PRODUCT_PORT, type ProductPort } from '@domain/inventory/catalog/product/product.port';

export interface CreateProductInput {
  companyId: string;
  name: string;
  itemType?: 'product' | 'service';
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
  constructor(
    @Inject(PRODUCT_PORT) private readonly products: ProductPort,
    @Inject(PRICE_WORKFLOW_PORT) private readonly prices: Pick<PriceWorkflowPort, 'settings'>,
  ) {}

  async execute(input: CreateProductInput, actor: Pick<SessionRecord, 'userId' | 'role'>): Promise<Product> {
    assertProduct(input);
    await assertCanCreateSellableProduct(input, actor, this.prices);
    const shelf = reclassifyShelf({ name: input.name, category: input.category, supplier: null });
    const product: Product = {
      id: randomUUID(),
      companyId: input.companyId,
      name: input.name.trim(),
      itemType: input.itemType ?? 'product',
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

async function assertCanCreateSellableProduct(
  input: CreateProductInput,
  actor: Pick<SessionRecord, 'userId' | 'role'>,
  prices: Pick<PriceWorkflowPort, 'settings'>,
): Promise<void> {
  const needsApproval = input.presentations.some((presentation) => presentation.sellable);
  if (!needsApproval || actor.role === 'owner') return;
  const settings = await prices.settings(input.companyId);
  if (settings.designatedApproverId !== actor.userId) throw new PermissionDeniedError();
}

function assertProduct(input: CreateProductInput): void {
  if (input.itemType !== undefined && input.itemType !== 'product' && input.itemType !== 'service') {
    throw new ProductError('Item type is not supported');
  }
  if (input.companyId.trim() === '' || input.name.trim() === '' || input.baseUnit.trim() === '') {
    throw new ProductError('Company, name, and base unit are required');
  }
  if (input.presentations.length === 0) {
    throw new ProductError('A product needs a presentation');
  }
  for (const presentation of input.presentations) {
    assertPresentation(presentation);
  }
  if (input.itemType === 'service' && input.presentations.some((presentation) => presentation.purchasable || !presentation.sellable || presentation.salePrice === null)) {
    throw new ProductError('A service needs a sale price and cannot be purchased as inventory');
  }
}
