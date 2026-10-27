import type { EntityManager } from 'typeorm';
import type { ProductSort } from '@domain/inventory/catalog/product/product-sort';
import { PriceChangeEntity, PresentationEntity, ProductEntity } from '@infrastructure/catalog/product/postgres/entities/product.entity';

export async function readProducts(manager: EntityManager, companyId: string, productId?: string): Promise<ProductEntity[]> {
  const query = manager.getRepository(ProductEntity).createQueryBuilder('product')
    .leftJoinAndSelect('product.presentations', 'presentation')
    .where('product.companyId = :companyId', { companyId })
    .orderBy("CASE WHEN presentation.unit = 'unidad' THEN 0 ELSE 1 END", 'ASC')
    .addOrderBy('presentation.unit', 'ASC');
  if (productId !== undefined) query.andWhere('product.id = :productId', { productId });
  return query.getMany();
}

export async function readProductPage(
  manager: EntityManager,
  companyId: string,
  search: string,
  sort: ProductSort,
  offset: number,
  pageSize: number,
): Promise<{ items: ProductEntity[]; total: number }> {
  const query = manager.getRepository(ProductEntity).createQueryBuilder('product')
    .leftJoinAndSelect('product.presentations', 'presentation')
    .where('product.companyId = :companyId', { companyId });
  if (search.trim() !== '') {
    const term = `%${search.trim()}%`;
    query.andWhere(`(
      product.name ILIKE :term OR product.category ILIKE :term OR
      COALESCE(product.supplier, '') ILIKE :term OR product.internalBarcode ILIKE :term OR
      EXISTS (
        SELECT 1 FROM presentations matched
        WHERE matched.product_id = product.id AND COALESCE(matched.manufacturer_barcode, '') ILIKE :term
      )
    )`, { term });
  }

  const order = pageSortExpression(query, sort);
  const [items, total] = await query.orderBy(order, sort.direction === 'desc' ? 'DESC' : 'ASC', 'NULLS LAST')
    .addOrderBy('product.id', 'ASC')
    .skip(offset)
    .take(pageSize)
    .getManyAndCount();
  return { items, total };
}

export async function insertProduct(manager: EntityManager, product: ProductEntity, presentations: PresentationEntity[]): Promise<void> {
  await manager.getRepository(ProductEntity).insert(product);
  await manager.getRepository(PresentationEntity).insert(presentations);
}

export async function recordPriceChange(
  manager: EntityManager,
  productId: string,
  unit: string,
  salePrice: number | null,
  change: PriceChangeEntity,
): Promise<boolean> {
  const updated = await manager.getRepository(PresentationEntity).createQueryBuilder()
    .update(PresentationEntity)
    .set({ salePrice: salePrice === null ? null : String(salePrice) })
    .where('productId = :productId AND unit = :unit', { productId, unit })
    .execute();
  if (!updated.affected) return false;
  await manager.getRepository(PriceChangeEntity).insert(change);
  return true;
}

export async function readPriceHistory(manager: EntityManager, companyId: string, productId?: string): Promise<PriceChangeEntity[]> {
  const query = manager.getRepository(PriceChangeEntity).createQueryBuilder('change')
    .where('change.companyId = :companyId', { companyId })
    .orderBy('change.changedAt', 'DESC')
    .addOrderBy('change.id', 'ASC');
  if (productId !== undefined) query.andWhere('change.productId = :productId', { productId });
  return query.getMany();
}

export async function readProductBarcodes(manager: EntityManager, companyId: string): Promise<string[]> {
  const rows = await manager.getRepository(ProductEntity).createQueryBuilder('product')
    .select('product.internalBarcode', 'barcode')
    .where('product.companyId = :companyId', { companyId })
    .getRawMany<{ barcode: string }>();
  return rows.map((row) => row.barcode);
}

function pageSortExpression(query: import('typeorm').SelectQueryBuilder<ProductEntity>, sort: ProductSort): string {
  if (sort.column === 'name') return 'product.name';
  if (sort.column === 'category') return 'product.category';
  if (sort.column === 'supplier') return "COALESCE(product.supplier, '')";
  if (sort.column === 'barcode') return 'product.internalBarcode';
  if (sort.column === 'stock') return 'product.id';
  if (sort.column === 'presentation') return preferredPresentation(query, 'unit', 'sortPresentation');
  if (sort.column === 'factor') return preferredPresentation(query, 'factor', 'sortFactor');
  return preferredPresentation(query, 'salePrice', 'sortSalePrice');
}

function preferredPresentation(query: import('typeorm').SelectQueryBuilder<ProductEntity>, column: 'unit' | 'factor' | 'salePrice', alias: string): string {
  const databaseColumn = column === 'salePrice' ? 'sale_price' : column;
  const expression = `(SELECT preferred.${databaseColumn} FROM presentations preferred
    WHERE preferred.product_id = product.id
    ORDER BY CASE WHEN preferred.unit = 'unidad' THEN 0 ELSE 1 END, preferred.unit
    LIMIT 1)`;
  query.addSelect(expression, alias);
  return alias;
}

