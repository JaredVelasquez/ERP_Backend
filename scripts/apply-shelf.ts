import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { reclassifyShelf } from '@domain/inventory/shelf';
import { loadEnvFile } from '@infrastructure/persistence/database-env';
import { createMssqlExecutor } from '@infrastructure/persistence/mssql-executor';

loadEnvFile(join(__dirname, '..', '.env'));

interface ProductShelfRow {
  id: string;
  name: string;
  category: string;
  supplier: string | null;
}

async function main(): Promise<void> {
  const sql = readFileSync(join(__dirname, '..', 'migrations', '014_shelf_and_ledger.sql'), 'utf8');
  const executor = createMssqlExecutor(process.env);
  const changed = await executor.transaction(async (session) => {
    await session.query(sql, {});
    const rows = await session.query<ProductShelfRow>(
      'SELECT id, name, category, supplier FROM dbo.products',
      {},
    );
    const updates = shelfUpdates(rows);
    if (updates.length === 0) {
      return 0;
    }
    await session.query(
      `UPDATE product
       SET category = source.category, supplier = source.supplier
       FROM dbo.products AS product
       INNER JOIN OPENJSON(@rows) WITH (
         id uniqueidentifier '$.id',
         category nvarchar(100) '$.category',
         supplier nvarchar(100) '$.supplier'
       ) AS source ON source.id = product.id`,
      { rows: JSON.stringify(updates) },
    );
    return updates.length;
  });
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
