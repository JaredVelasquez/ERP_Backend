import { join } from 'node:path';
import { reclassifyShelf } from '@domain/inventory/stock/shelf/shelf';
import { loadEnvFile } from '@infrastructure/shared/postgres/database-env';
import { ProductEntity } from '@infrastructure/catalog/product/postgres/entities/product.entity';
import { createTypeOrmExecutor } from '@infrastructure/shared/postgres/typeorm-executor';

loadEnvFile(join(__dirname, '..', '.env'));

interface ProductShelfRow {
  id: string;
  name: string;
  category: string;
  supplier: string | null;
}

async function main(): Promise<void> {
  const executor = createTypeOrmExecutor(process.env);
  const changed = await executor.transaction(() => executor.withManager(async (manager) => {
    const rows = await manager.getRepository(ProductEntity).createQueryBuilder('product')
      .select('product.id', 'id').addSelect('product.name', 'name').addSelect('product.category', 'category')
      .addSelect('product.supplier', 'supplier').getRawMany<ProductShelfRow>();
    const updates = shelfUpdates(rows);
    for (const update of updates) {
      await manager.getRepository(ProductEntity).createQueryBuilder().update(ProductEntity)
        .set({ category: update.category, supplier: update.supplier }).where('id = :id', { id: update.id }).execute();
    }
    return updates.length;
  }));
  await executor.close?.();
  process.stdout.write(`shelf-ready ${changed}\n`);
  process.exit(0);
}

function shelfUpdates(rows: readonly ProductShelfRow[]): ProductShelfRow[] {
  const updates: ProductShelfRow[] = [];
  for (const row of rows) {
    pushShelfUpdate(updates, row);
  }
  return updates;
}

function pushShelfUpdate(updates: ProductShelfRow[], row: ProductShelfRow): void {
  const next = reclassifyShelf({ name: row.name, category: row.category, supplier: row.supplier });
  if (next.category === row.category && next.supplier === row.supplier) {
    return;
  }
  updates.push({ id: row.id, name: row.name, category: next.category, supplier: next.supplier });
}

void main();
