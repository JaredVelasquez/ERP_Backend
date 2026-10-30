import { randomUUID } from 'node:crypto';
import { DocumentError } from '@domain/inventory/stock/document/document';
import { PriceError, type PriceChange } from '@domain/inventory/catalog/product/price';
import type { PricePort } from '@domain/inventory/catalog/product/price.port';
import { type CostingMethod, type CostingPolicyChange } from '@domain/inventory/catalog/costing/costing';
import type { CostingPolicyPort } from '@domain/inventory/catalog/costing/costing-policy.port';
import type { Presentation, Product } from '@domain/inventory/catalog/product/product';
import type { CatalogItemTypeFilter, ProductPort } from '@domain/inventory/catalog/product/product.port';
import { readProductSort } from '@domain/inventory/catalog/product/product-sort';
import { pageOffset, type Page, type PageRequest } from '@domain/workspace/company-list/page';
import { CostingPolicyChangeEntity, PriceChangeEntity, PresentationEntity, ProductEntity } from '@infrastructure/catalog/product/postgres/entities/product.entity';
import { changeProductCostingMethod, insertProduct, readPriceHistory, readProductBarcodes, readProductCostingHistory, readProductPage, readProducts, recordPriceChange } from '@infrastructure/catalog/product/postgres/product.queries';
import type { TypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';

export class PostgresProductRepository implements ProductPort, PricePort, CostingPolicyPort {
  private readonly sequences = new Map<string, number>();

  constructor(private readonly database: TypeOrmExecutor) {}

  async nextSequence(companyId: string): Promise<number> {
    const current = this.sequences.get(companyId);
    if (current !== undefined) return this.bump(companyId, current);
    const barcodes = await this.database.withManager((manager) => readProductBarcodes(manager, companyId));
    return this.bump(companyId, barcodes.reduce((max, barcode) => Math.max(max, barcodeNumber(barcode)), 0));
  }

  async save(product: Product): Promise<void> {
    const entity = productEntity(product);
    const presentations = product.presentations.map((presentation) => presentationEntity(product.id, presentation));
    await this.database.transaction(async () => this.database.withManager((manager) => insertProduct(manager, entity, presentations)));
  }

  async find(companyId: string, productId: string): Promise<Product | null> {
    const products = await this.database.withManager((manager) => readProducts(manager, companyId, productId));
    return products[0] ? domainProduct(products[0]) : null;
  }

  async list(companyId: string): Promise<Product[]> {
    const products = await this.database.withManager((manager) => readProducts(manager, companyId));
    return products.map(domainProduct);
  }

  async listPage(companyId: string, request: PageRequest, itemType: CatalogItemTypeFilter = 'product'): Promise<Page<Product>> {
    const page = await this.database.withManager((manager) =>
      readProductPage(manager, companyId, request.search, readProductSort(request.sort), pageOffset(request), request.pageSize, itemType));
    return {
      items: page.items.map(domainProduct),
      page: request.page,
      pageSize: request.pageSize,
      total: page.total,
    };
  }

  async record(product: Product, change: PriceChange): Promise<void> {
    const presentation = product.presentations.find((item) => item.unit === change.unit);
    if (!presentation) throw new PriceError('Presentation was not found');
    const changeEntity = priceChangeEntity(change);
    const updated = await this.database.transaction(() => this.database.withManager((manager) =>
      recordPriceChange(manager, product.id, change.unit, presentation.salePrice, changeEntity)));
    if (!updated) throw new PriceError('Product was not found');
  }

  async history(companyId: string, productId: string): Promise<PriceChange[]> {
    const rows = await this.database.withManager((manager) => readPriceHistory(manager, companyId, productId));
    return rows.map(domainPriceChange);
  }

  async historyForCompany(companyId: string): Promise<PriceChange[]> {
    const rows = await this.database.withManager((manager) => readPriceHistory(manager, companyId));
    return rows.map(domainPriceChange);
  }

  async changeProductCostingMethod(change: CostingPolicyChange): Promise<void> {
    const entity = costingPolicyChangeEntity(change);
    const updated = await this.database.transaction(() => this.database.withManager((manager) =>
      changeProductCostingMethod(manager, change.productId, change.newMethod, entity)));
    if (!updated) throw new DocumentError('Product was not found');
  }

  async productCostingHistory(companyId: string, productId: string): Promise<CostingPolicyChange[]> {
    const rows = await this.database.withManager((manager) => readProductCostingHistory(manager, companyId, productId));
    return rows.map(domainCostingPolicyChange);
  }

  private bump(companyId: string, current: number): number {
    const next = current + 1;
    this.sequences.set(companyId, next);
    return next;
  }
}

function productEntity(product: Product): ProductEntity {
  return Object.assign(new ProductEntity(), {
    id: product.id,
    companyId: product.companyId,
    name: product.name,
    itemType: product.itemType ?? 'product',
    category: product.category,
    supplier: product.supplier ?? null,
    baseUnit: product.baseUnit,
    tracksExpiry: product.tracksExpiry,
    costingMethod: product.costingMethod,
    marginPercent: product.marginPercent === null ? null : String(product.marginPercent),
    taxCategoryCode: product.taxCategoryCode,
    active: product.active,
    internalBarcode: product.internalBarcode,
  });
}

function presentationEntity(productId: string, presentation: Presentation): PresentationEntity {
  return Object.assign(new PresentationEntity(), {
    id: randomUUID(),
    productId,
    unit: presentation.unit,
    factor: String(presentation.factor),
    purchasable: presentation.purchasable,
    sellable: presentation.sellable,
    salePrice: presentation.salePrice === null ? null : String(presentation.salePrice),
    referenceUnitCost: presentation.referenceUnitCost === null || presentation.referenceUnitCost === undefined ? null : String(presentation.referenceUnitCost),
    manufacturerBarcode: presentation.manufacturerBarcode,
  });
}

function priceChangeEntity(change: PriceChange): PriceChangeEntity {
  return Object.assign(new PriceChangeEntity(), {
    id: change.id,
    companyId: change.companyId,
    productId: change.productId,
    unit: change.unit,
    previousPrice: change.previousPrice === null ? null : String(change.previousPrice),
    nextPrice: String(change.nextPrice),
    reason: change.reason,
    actorId: change.actorId,
    changedAt: new Date(change.at),
  });
}

function domainProduct(entity: ProductEntity): Product {
  return {
    id: entity.id,
    companyId: entity.companyId,
    name: entity.name,
    itemType: entity.itemType === 'service' ? 'service' : 'product',
    category: entity.category,
    supplier: entity.supplier,
    baseUnit: entity.baseUnit,
    tracksExpiry: entity.tracksExpiry,
    costingMethod: costingMethod(entity.costingMethod),
    marginPercent: nullableNumber(entity.marginPercent),
    taxCategoryCode: entity.taxCategoryCode,
    active: entity.active,
    internalBarcode: entity.internalBarcode,
    presentations: (entity.presentations ?? []).map((presentation) => ({
      unit: presentation.unit,
      factor: number(presentation.factor),
      purchasable: presentation.purchasable,
      sellable: presentation.sellable,
      salePrice: nullableNumber(presentation.salePrice),
      referenceUnitCost: nullableNumber(presentation.referenceUnitCost),
      manufacturerBarcode: presentation.manufacturerBarcode,
    })),
  };
}

function costingPolicyChangeEntity(change: CostingPolicyChange): CostingPolicyChangeEntity {
  return Object.assign(new CostingPolicyChangeEntity(), {
    id: change.id,
    companyId: change.companyId,
    productId: change.productId,
    previousMethod: change.previousMethod,
    newMethod: change.newMethod,
    reason: change.reason,
    actorId: change.actorId,
    changedAt: new Date(change.at),
  });
}

function domainCostingPolicyChange(entity: CostingPolicyChangeEntity): CostingPolicyChange {
  return {
    id: entity.id,
    companyId: entity.companyId,
    productId: entity.productId,
    previousMethod: costingMethod(entity.previousMethod),
    newMethod: costingMethod(entity.newMethod),
    reason: entity.reason,
    actorId: entity.actorId,
    at: entity.changedAt.toISOString(),
  };
}

function domainPriceChange(entity: PriceChangeEntity): PriceChange {
  return {
    id: entity.id,
    companyId: entity.companyId,
    productId: entity.productId,
    unit: entity.unit,
    previousPrice: nullableNumber(entity.previousPrice),
    nextPrice: number(entity.nextPrice),
    reason: entity.reason,
    actorId: entity.actorId,
    at: entity.changedAt.toISOString(),
  };
}

function costingMethod(value: string | null): CostingMethod | null {
  return value === 'PEPS' || value === 'UEPS' || value === 'FEFO' || value === 'AVERAGE' || value === 'SPECIFIC' ? value : null;
}

function number(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: string | number | null | undefined): number | null {
  return value === null || value === undefined ? null : number(value);
}

function barcodeNumber(value: string): number {
  return /^\d+$/.test(value) ? Number(value) : 0;
}
