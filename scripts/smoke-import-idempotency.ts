import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Client } from 'pg';
import { PostgresImportTransactionRepository } from '../libs/infrastructure/src/catalog/import/postgres/postgres-import-transaction.repository';
import { createTypeOrmExecutor } from '../libs/infrastructure/src/shared/postgres/typeorm-executor';
import { loadEnvFile } from '../libs/infrastructure/src/shared/postgres/database-env';

loadEnvFile(join(__dirname, '..', '.env'));

async function main(): Promise<void> {
  const database = new Client({ host: process.env.PG_HOST, port: Number(process.env.PG_PORT ?? '5432'), database: process.env.PG_NAME,
    user: process.env.PG_MIGRATION_USER ?? process.env.PG_USER, password: process.env.PG_MIGRATION_PASSWORD ?? process.env.PG_PASSWORD,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: true } : false });
  await database.connect();
  const company = await database.query<{ companyId: string }>('SELECT id AS "companyId" FROM companies ORDER BY id LIMIT 1');
  const companyId = company.rows[0]?.companyId;
  if (!companyId) { await database.end(); throw new Error('No development company exists'); }
  const idempotencyKey = `catalog-smoke:${randomUUID().replace(/-/g, '')}`;
  const sql = createTypeOrmExecutor(process.env);
  const transactions = new PostgresImportTransactionRepository(sql);
  const reserve = () => transactions.run(companyId, idempotencyKey, async () => null);

  try {
    const results = await Promise.all([reserve(), reserve()]);
    const inserted = results.filter((result) => result.executed).length;
    if (inserted !== 1) throw new Error('Concurrent retries were not deduplicated');
    process.stdout.write('PostgreSQL catalog import reservation is idempotent under concurrent retries.\n');
  } finally {
    await database.query('DELETE FROM catalog_import_batches WHERE company_id = $1 AND idempotency_key = $2', [companyId, idempotencyKey]);
    await sql.close?.();
    await database.end();
  }
}

void main().catch(() => {
  process.stderr.write('Catalog import idempotency smoke check failed.\n');
  process.exitCode = 1;
});
