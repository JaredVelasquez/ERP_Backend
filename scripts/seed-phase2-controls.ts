import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Client } from 'pg';
import { loadEnvFile } from '../libs/infrastructure/src/shared/postgres/database-env';

loadEnvFile(join(__dirname, '..', '.env'));

async function main(): Promise<void> {
  const client = new Client({
    host: required('PG_HOST'), port: Number(process.env.PG_PORT ?? '5432'), database: required('PG_NAME'),
    user: process.env.PG_MIGRATION_USER ?? required('PG_USER'), password: process.env.PG_MIGRATION_PASSWORD ?? required('PG_PASSWORD'),
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: true } : false,
  });
  await client.connect();
  try {
    const companies = await client.query<{ id: string }>('SELECT id FROM companies ORDER BY created_at LIMIT 1');
    const companyId = companies.rows[0]?.id;
    if (!companyId) throw new Error('No company exists');
    await client.query('BEGIN');
    await client.query(`INSERT INTO warehouses(id, company_id, name, code, active, is_default)
      VALUES($1, $2, 'Sucursal de demostración', 'BOD-002', true, false)
      ON CONFLICT(company_id, code) DO NOTHING`, [randomUUID(), companyId]);
    await client.query(`INSERT INTO accounting_periods(id, company_id, name, starts_on, ends_on)
      VALUES($1, $2, 'Octubre 2026', '2026-10-01', '2026-10-31')
      ON CONFLICT(company_id, starts_on, ends_on) DO NOTHING`, [randomUUID(), companyId]);
    await client.query('COMMIT');
    process.stdout.write(`Phase 2 sample controls ready for ${companyId}.\n`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

function required(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

void main();
