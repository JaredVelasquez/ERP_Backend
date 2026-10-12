import { randomUUID } from 'node:crypto';
import { PriceError, type PriceChange } from '@domain/inventory/price';
import type { PricePort } from '@domain/inventory/price.port';
import type { CostingMethod } from '@domain/inventory/costing';
import type { Presentation, Product } from '@domain/inventory/product';
import type { ProductPort } from '@domain/inventory/product.port';
import { readProductSort, type ProductSort } from '@domain/inventory/product-sort';
import { likeTerm, pageOffset, type Page, type PageRequest } from '@domain/workspace/page';
import type { SqlExecutor } from '@infrastructure/persistence/sql-executor';

interface ProductJoinRow {
  id: string;
  companyId: string;
  name: string;
  category: string;
  supplier: string | null;
  baseUnit: string;
  tracksExpiry: unknown;
  costingMethod: string | null;
  marginPercent: string | null;
  taxCategoryCode: string;
  active: unknown;
  internalBarcode: string;
  unit: string | null;
  factor: string | null;
  purchasable: unknown;
  sellable: unknown;
  salePrice: string | null;
  manufacturerBarcode: string | null;
}

interface ProductPageRow {
  total: number | string | null;
  id: string | null;
  companyId: string | null;
  name: string | null;
  category: string | null;
  supplier: string | null;
  baseUnit: string | null;
  tracksExpiry: unknown;
  costingMethod: string | null;
  marginPercent: string | null;
  taxCategoryCode: string | null;
  active: unknown;
  internalBarcode: string | null;
  unit: string | null;
  factor: string | null;
  purchasable: unknown;
  sellable: unknown;
  salePrice: string | null;
  manufacturerBarcode: string | null;
}

interface BarcodeRow {
  barcode: string;
}

const PRODUCT_ORDERS: Record<ProductSort['column'], Record<ProductSort['direction'], string>> = {
  name: { asc: 'name ASC, id ASC', desc: 'name DESC, id ASC' },
  category: { asc: 'category ASC, id ASC', desc: 'category DESC, id ASC' },
  supplier: { asc: 'supplier ASC, id ASC', desc: 'supplier DESC, id ASC' },
  presentation: { asc: 'presentation ASC, id ASC', desc: 'presentation DESC, id ASC' },
  factor: { asc: 'factor ASC, id ASC', desc: 'factor DESC, id ASC' },
  barcode: { asc: 'barcode ASC, id ASC', desc: 'barcode DESC, id ASC' },
  salePrice: { asc: 'salePrice ASC, id ASC', desc: 'salePrice DESC, id ASC' },
  stock: { asc: 'id ASC', desc: 'id ASC' },
};

const SHELF_COLUMNS = `
    ISNULL(shelf.unit, N'') AS presentation,
    shelf.factor,
    shelf.sale_price AS salePrice`;

const SHELF_APPLY = `
  OUTER APPLY (
    SELECT TOP (1) unit, factor, sale_price
    FROM dbo.presentations
    WHERE product_id = p.id
    ORDER BY CASE WHEN unit = N'unidad' THEN 0 ELSE 1 END, unit
  ) AS shelf`;

export function productPageSql(sort: ProductSort): string {
  const orderBy = PRODUCT_ORDERS[sort.column][sort.direction];
  const shelf = shelfSql(sort);
  return `
WITH filtered AS (
  SELECT
    p.id,
    p.name,
    p.category,
    ISNULL(p.supplier, N'') AS supplier,
    p.internal_barcode AS barcode${shelf.columns}
  FROM dbo.products AS p${shelf.apply}
  WHERE p.company_id = @companyId
    AND (
      @search = N''
      OR p.name LIKE @like
      OR p.category LIKE @like
      OR ISNULL(p.supplier, N'') LIKE @like
      OR p.internal_barcode LIKE @like
      OR EXISTS (
        SELECT 1
        FROM dbo.presentations AS hit
        WHERE hit.product_id = p.id
          AND ISNULL(hit.manufacturer_barcode, N'') LIKE @like
      )
    )
),
counted AS (
  SELECT COUNT(*) AS total FROM filtered
),
page AS (
  SELECT id,
    ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS sortIndex,
    COUNT(*) OVER() AS windowTotal
  FROM filtered
  ORDER BY ${orderBy}
  OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
)
SELECT
  COALESCE(page.windowTotal, counted.total) AS total,
  p.id,
  p.company_id AS companyId,
  p.name,
  p.category,
  p.supplier,
  p.base_unit AS baseUnit,
  p.tracks_expiry AS tracksExpiry,
  p.costing_method AS costingMethod,
  p.margin_percent AS marginPercent,
  p.tax_category_code AS taxCategoryCode,
  p.active,
  p.internal_barcode AS internalBarcode,
  r.unit,
  r.factor,
  r.purchasable,
  r.sellable,
  r.sale_price AS salePrice,
  r.manufacturer_barcode AS manufacturerBarcode
FROM counted
LEFT JOIN page ON 1 = 1
LEFT JOIN dbo.products AS p ON p.id = page.id
LEFT JOIN dbo.presentations AS r ON r.product_id = p.id
ORDER BY page.sortIndex, r.unit`;
}

export class SqlProductRepository implements ProductPort, PricePort {
  private readonly sequences = new Map<string, number>();

  constructor(private readonly sql: SqlExecutor) {}

  async nextSequence(companyId: string): Promise<number> {
    const current = this.sequences.get(companyId);
    if (current !== undefined) {
      return this.bump(companyId, current);
    }
    return this.bump(companyId, await this.readMaxSequence(companyId));
  }

  async save(product: Product): Promise<void> {
    await this.sql.transaction(async (session) => {
      await session.query(
        `INSERT INTO dbo.products (
           id, company_id, name, category, supplier, base_unit, tracks_expiry, costing_method,
           margin_percent, tax_category_code, active, internal_barcode
         ) VALUES (
           @id, @companyId, @name, @category, @supplier, @baseUnit, @tracksExpiry, @costingMethod,
           @marginPercent, @taxCategoryCode, @active, @internalBarcode
         )`,
        {
          id: product.id,
          companyId: product.companyId,
          name: product.name,
          category: product.category,
          supplier: product.supplier ?? null,
          baseUnit: product.baseUnit,
          tracksExpiry: bit(product.tracksExpiry),
          costingMethod: product.costingMethod,
          marginPercent: product.marginPercent,
          taxCategoryCode: product.taxCategoryCode,
          active: bit(product.active),
          internalBarcode: product.internalBarcode,
        },
      );
      await session.query(
        `INSERT INTO dbo.presentations (
           id, product_id, unit, factor, purchasable, sellable, sale_price, manufacturer_barcode
         )
         SELECT id, @productId, unit, factor, purchasable, sellable, salePrice, manufacturerBarcode
         FROM OPENJSON(@presentations)
         WITH (
           id uniqueidentifier '$.id',
           unit nvarchar(40) '$.unit',
           factor decimal(18, 4) '$.factor',
           purchasable bit '$.purchasable',
           sellable bit '$.sellable',
           salePrice decimal(18, 2) '$.salePrice',
           manufacturerBarcode nvarchar(64) '$.manufacturerBarcode'
         )`,
        { productId: product.id, presentations: JSON.stringify(presentationPayload(product.presentations)) },
      );
    });
  }

  async find(companyId: string, productId: string): Promise<Product | null> {
    const rows = await this.readJoin(companyId, productId);
    return groupProducts(rows)[0] ?? null;
  }

  async list(companyId: string): Promise<Product[]> {
    return groupProducts(await this.readJoin(companyId, ''));
  }

  async listPage(companyId: string, request: PageRequest): Promise<Page<Product>> {
    const rows = await this.sql.transaction((session) =>
      session.query<ProductPageRow>(productPageSql(readProductSort(request.sort)), {
        companyId,
        search: request.search,
        like: likeTerm(request.search),
        offset: pageOffset(request),
        pageSize: request.pageSize,
      }),
    );
    return {
      items: groupProducts(presentRows(rows)),
      page: request.page,
      pageSize: request.pageSize,
      total: pageTotal(rows),
    };
  }

  async record(product: Product, change: PriceChange): Promise<void> {
    const presentation = product.presentations.find((item) => item.unit === change.unit);
    if (presentation === undefined) {
      throw new PriceError('Presentation was not found');
    }
    await this.sql.transaction(async (session) => {
      const updated = await session.query<{ id: string }>(
        `UPDATE dbo.presentations
         SET sale_price = @salePrice
         OUTPUT inserted.id AS id
         WHERE product_id = @productId AND unit = @unit`,
        { salePrice: presentation.salePrice, productId: product.id, unit: change.unit },
      );
      if (updated.length === 0) {
        throw new PriceError('Product was not found');
      }
      await session.query(
        `INSERT INTO dbo.price_changes (
           id, company_id, product_id, unit, previous_price, next_price, reason, actor_id, changed_at
         ) VALUES (
           @id, @companyId, @productId, @unit, @previousPrice, @nextPrice, @reason, @actorId, @changedAt
         )`,
        {
          id: change.id,
          companyId: change.companyId,
          productId: change.productId,
          unit: change.unit,
          previousPrice: change.previousPrice,
          nextPrice: change.nextPrice,
          reason: change.reason,
          actorId: change.actorId,
          changedAt: change.at,
        },
      );
    });
  }

  async history(companyId: string, productId: string): Promise<PriceChange[]> {
    const rows = await this.sql.transaction((session) =>
      session.query<PriceChangeRow>(
        `SELECT id, company_id AS companyId, product_id AS productId, unit,
                previous_price AS previousPrice, next_price AS nextPrice, reason,
                actor_id AS actorId, changed_at AS at
         FROM dbo.price_changes
         WHERE company_id = @companyId AND product_id = @productId`,
        { companyId, productId },
      ),
    );
    return rows.map(priceChangeFrom);
  }

  async historyForCompany(companyId: string): Promise<PriceChange[]> {
    const rows = await this.sql.transaction((session) =>
      session.query<PriceChangeRow>(
        `SELECT id, company_id AS companyId, product_id AS productId, unit,
                previous_price AS previousPrice, next_price AS nextPrice, reason,
                actor_id AS actorId, changed_at AS at
         FROM dbo.price_changes
         WHERE company_id = @companyId`,
        { companyId },
      ),
    );
    return rows.map(priceChangeFrom);
  }

  private bump(companyId: string, current: number): number {
    const next = current + 1;
    this.sequences.set(companyId, next);
    return next;
  }

  private async readMaxSequence(companyId: string): Promise<number> {
    const rows = await this.sql.transaction((session) =>
      session.query<BarcodeRow>(
        'SELECT internal_barcode AS barcode FROM dbo.products WHERE company_id = @companyId',
        { companyId },
      ),
    );
    return rows.reduce((max, row) => Math.max(max, barcodeNumber(row.barcode)), 0);
  }

  private async readJoin(companyId: string, productId: string): Promise<ProductJoinRow[]> {
    const filter = productId === '' ? '' : ' AND p.id = @productId';
    return this.sql.transaction((session) =>
      session.query<ProductJoinRow>(
        `SELECT p.id, p.company_id AS companyId, p.name, p.category, p.supplier, p.base_unit AS baseUnit,
                p.tracks_expiry AS tracksExpiry, p.costing_method AS costingMethod,
                p.margin_percent AS marginPercent, p.tax_category_code AS taxCategoryCode,
                p.active, p.internal_barcode AS internalBarcode,
                r.unit, r.factor, r.purchasable, r.sellable, r.sale_price AS salePrice,
                r.manufacturer_barcode AS manufacturerBarcode
         FROM dbo.products p
         LEFT JOIN dbo.presentations r ON r.product_id = p.id
         WHERE p.company_id = @companyId${filter}`,
        { companyId, productId },
      ),
    );
  }
}

interface PriceChangeRow {
  id: string;
  companyId: string;
  productId: string;
  unit: string;
  previousPrice: string | null;
  nextPrice: string;
  reason: string;
  actorId: string;
  at: string;
}

function presentationPayload(presentations: readonly Presentation[]): Array<Record<string, unknown>> {
  return presentations.map((presentation) => ({
    id: randomUUID(),
    unit: presentation.unit,
    factor: presentation.factor,
    purchasable: presentation.purchasable,
    sellable: presentation.sellable,
    salePrice: presentation.salePrice,
    manufacturerBarcode: presentation.manufacturerBarcode,
  }));
}

function shelfSql(sort: ProductSort): { columns: string; apply: string } {
  if (sort.column !== 'presentation' && sort.column !== 'factor' && sort.column !== 'salePrice') {
    return { columns: '', apply: '' };
  }
  return { columns: `,${SHELF_COLUMNS}`, apply: SHELF_APPLY };
}

function presentRows(rows: readonly ProductPageRow[]): ProductJoinRow[] {
  const present: ProductJoinRow[] = [];
  for (const row of rows) {
    pushPresent(present, row);
  }
  return present;
}

function pushPresent(present: ProductJoinRow[], row: ProductPageRow): void {
  if (row.id === null || row.companyId === null || row.name === null || row.category === null || row.baseUnit === null || row.taxCategoryCode === null || row.internalBarcode === null) {
    return;
  }
  present.push({
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    category: row.category,
    supplier: row.supplier,
    baseUnit: row.baseUnit,
    tracksExpiry: row.tracksExpiry,
    costingMethod: row.costingMethod,
    marginPercent: row.marginPercent,
    taxCategoryCode: row.taxCategoryCode,
    active: row.active,
    internalBarcode: row.internalBarcode,
    unit: row.unit,
    factor: row.factor,
    purchasable: row.purchasable,
    sellable: row.sellable,
    salePrice: row.salePrice,
    manufacturerBarcode: row.manufacturerBarcode,
  });
}

function pageTotal(rows: readonly ProductPageRow[]): number {
  const parsed = Number(rows[0]?.total ?? 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

function groupProducts(rows: readonly ProductJoinRow[]): Product[] {
  const products: Product[] = [];
  const index = new Map<string, Product>();
  for (const row of rows) {
    pushJoined(products, index, row);
  }
  return products;
}

function pushJoined(products: Product[], index: Map<string, Product>, row: ProductJoinRow): void {
  const existing = index.get(row.id);
  if (existing === undefined) {
    const created = productFrom(row);
    index.set(row.id, created);
    products.push(created);
    pushPresentation(created, row);
    return;
  }
  pushPresentation(existing, row);
}

function pushPresentation(product: Product, row: ProductJoinRow): void {
  if (row.unit === null || row.unit.trim() === '') {
    return;
  }
  product.presentations.push({
    unit: row.unit,
    factor: asNumber(row.factor),
    purchasable: asFlag(row.purchasable),
    sellable: asFlag(row.sellable),
    salePrice: asNullableNumber(row.salePrice),
    manufacturerBarcode: blankToNull(row.manufacturerBarcode),
  });
}

function productFrom(row: ProductJoinRow): Product {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    category: row.category,
    supplier: row.supplier,
    baseUnit: row.baseUnit,
    tracksExpiry: asFlag(row.tracksExpiry),
    costingMethod: costingMethod(row.costingMethod),
    marginPercent: asNullableNumber(row.marginPercent),
    taxCategoryCode: row.taxCategoryCode,
    active: asFlag(row.active),
    internalBarcode: row.internalBarcode,
    presentations: [],
  };
}

function priceChangeFrom(row: PriceChangeRow): PriceChange {
  return {
    id: row.id,
    companyId: row.companyId,
    productId: row.productId,
    unit: row.unit,
    previousPrice: asNullableNumber(row.previousPrice),
    nextPrice: asNumber(row.nextPrice),
    reason: row.reason,
    actorId: row.actorId,
    at: row.at,
  };
}

function costingMethod(value: string | null): CostingMethod | null {
  if (value === 'PEPS' || value === 'UEPS' || value === 'FEFO' || value === 'AVERAGE' || value === 'SPECIFIC') {
    return value;
  }
  return null;
}

function barcodeNumber(value: string): number {
  if (!/^\d+$/.test(value)) {
    return 0;
  }
  return Number(value);
}

function bit(value: boolean): number {
  if (value) {
    return 1;
  }
  return 0;
}

function asFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'True' || value === 'true';
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? '');
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return asNumber(value);
}

function blankToNull(value: string | null): string | null {
  if (value === null || value.trim() === '') {
    return null;
  }
  return value;
}
